import { SMCAnalysis, Candle, HTFBias, StructureType } from "./types";

// ═══════════════════════════════════════════════════════════
// CACHE GLOBAL — Anti-bloqueio Binance (Limitado para MTF)
// ═══════════════════════════════════════════════════════════
interface CacheEntry<T> { data: T; ts: number; }
const klineCache: Record<string, CacheEntry<any>> = {};
const HTF_TTL = 30_000; // 30s de cache

async function fetchBinanceKline(pair: string, interval: string, limit: string) {
  const mapInterval = (iv: string) => iv === "15" ? "15m" : iv === "60" ? "1h" : iv === "240" ? "4h" : iv === "D" ? "1d" : iv + "m";
  const binanceIv = mapInterval(interval);
  const targetUrl = `https://api.binance.com/api/v3/klines?symbol=${pair}USDT&interval=${binanceIv}&limit=${limit}`;
  
  if (klineCache[targetUrl] && Date.now() - klineCache[targetUrl].ts < HTF_TTL) {
    return klineCache[targetUrl].data;
  }

  const res = await fetch(targetUrl, { cache: "no-store", keepalive: true });
  if (!res.ok) throw new Error("Falha na API da Binance " + res.status);
  const data = await res.json();
  klineCache[targetUrl] = { data, ts: Date.now() };
  return data;
}

// ═══════════════════════════════════════════════════════════
// HELPER: RSI
// ═══════════════════════════════════════════════════════════
function calculateRSI(candles: Candle[], length = 14): number[] {
  const rsi = new Array(candles.length).fill(na());
  if (candles.length < length + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= length; avgLoss /= length;
  rsi[length] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = length + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (length - 1) + Math.max(d, 0)) / length;
    avgLoss = (avgLoss * (length - 1) + Math.max(-d, 0)) / length;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function na() { return NaN; }
function isNa(val: number) { return Number.isNaN(val) || val === null || val === undefined; }

// ═══════════════════════════════════════════════════════════
// TV: PIVOTS, STRUCTURE & TRENDLINES
// ═══════════════════════════════════════════════════════════
function pivotHigh(candles: Candle[], src: "high" | "close", left: number, right: number, currIdx: number): number {
  if (currIdx - left < 0 || currIdx + right >= candles.length) return na();
  const val = src === "high" ? candles[currIdx].high : Math.max(candles[currIdx].open, candles[currIdx].close);
  for (let i = currIdx - left; i <= currIdx + right; i++) {
    if (i === currIdx) continue;
    const cmp = src === "high" ? candles[i].high : Math.max(candles[i].open, candles[i].close);
    if (cmp > val) return na();
  }
  return val;
}

function pivotLow(candles: Candle[], src: "low" | "close", left: number, right: number, currIdx: number): number {
  if (currIdx - left < 0 || currIdx + right >= candles.length) return na();
  const val = src === "low" ? candles[currIdx].low : Math.min(candles[currIdx].open, candles[currIdx].close);
  for (let i = currIdx - left; i <= currIdx + right; i++) {
    if (i === currIdx) continue;
    const cmp = src === "low" ? candles[i].low : Math.min(candles[i].open, candles[i].close);
    if (cmp < val) return na();
  }
  return val;
}

function lineValueAt(t1: number, p1: number, t2: number, p2: number, tNow: number) {
  if (isNa(t1) || isNa(t2) || isNa(p1) || isNa(p2) || t1 === t2) return na();
  const slope = (p2 - p1) / (t2 - t1);
  return p2 + slope * (tNow - t2);
}

// ═══════════════════════════════════════════════════════════
// TV: RSI DIVERGENCES
// ═══════════════════════════════════════════════════════════
interface DivState {
  bullDivRecent: boolean;
  bearDivRecent: boolean;
  hiddenBullRecent: boolean;
  hiddenBearRecent: boolean;
}

function analyzeRsiDiv(candles: Candle[], rsiArr: number[], left=5, right=5, rangeLower=5, rangeUpper=60): DivState {
  let plFoundIdx = -1, plFoundRsi = na(), plFoundPrice = na();
  let phFoundIdx = -1, phFoundRsi = na(), phFoundPrice = na();
  
  let bullDivLast = -1, bearDivLast = -1, hBullLast = -1, hBearLast = -1;

  for (let i = left; i < candles.length - right; i++) {
    // Check local RSI pivot bounds
    let isPl = true, isPh = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (rsiArr[j] <= rsiArr[i]) isPl = false;
      if (rsiArr[j] >= rsiArr[i]) isPh = false;
    }

    if (isPl) {
      if (plFoundIdx !== -1) {
        const bars = i - plFoundIdx;
        if (bars >= rangeLower && bars <= rangeUpper) {
           const priceLL = candles[i].low < plFoundPrice;
           const rsiHL   = rsiArr[i] > plFoundRsi;
           if (priceLL && rsiHL) bullDivLast = i + right;

           const priceHL = candles[i].low > plFoundPrice;
           const rsiLL   = rsiArr[i] < plFoundRsi;
           if (priceHL && rsiLL) hBullLast = i + right;
        }
      }
      plFoundIdx = i; plFoundRsi = rsiArr[i]; plFoundPrice = candles[i].low;
    }

    if (isPh) {
       if (phFoundIdx !== -1) {
        const bars = i - phFoundIdx;
        if (bars >= rangeLower && bars <= rangeUpper) {
           const priceHH = candles[i].high > phFoundPrice;
           const rsiLH   = rsiArr[i] < phFoundRsi;
           if (priceHH && rsiLH) bearDivLast = i + right;

           const priceLH = candles[i].high < phFoundPrice;
           const rsiHH   = rsiArr[i] > phFoundRsi;
           if (priceLH && rsiHH) hBearLast = i + right;
        }
      }
      phFoundIdx = i; phFoundRsi = rsiArr[i]; phFoundPrice = candles[i].high;
    }
  }

  const lastBarIdx = candles.length - 1;
  return {
    bullDivRecent: bullDivLast !== -1 && (lastBarIdx - bullDivLast <= 20),
    bearDivRecent: bearDivLast !== -1 && (lastBarIdx - bearDivLast <= 20),
    hiddenBullRecent: hBullLast !== -1 && (lastBarIdx - hBullLast <= 20),
    hiddenBearRecent: hBearLast !== -1 && (lastBarIdx - hBearLast <= 20)
  };
}

// ═══════════════════════════════════════════════════════════
// MOTOR EUGENIO: STATE MEMORY DE OTE & TRENDLINES
// ═══════════════════════════════════════════════════════════
interface ObBox {
  top: number; btm: number; cls: number; hasIfvg: boolean; isMitigated: boolean;
}

interface EugenioState {
  dZones: ObBox[]; sZones: ObBox[];
  bullTL: number; bearTL: number;
}

function processEugenioTF(candles: Candle[]): EugenioState {
  const atrArr = candles.map((c, i, a) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - a[i-1].close), Math.abs(c.low - a[i-1].close)));
  const smoothAtr = (idx: number) => atrArr.slice(Math.max(0, idx - 13), idx + 1).reduce((s, x) => s + x, 0) / 14;

  let extremPct = 0.20, impMult = 0.8, maxDistMult = 5.0;
  let killMult = 1.10, mitPct = 0.50, tlBufMult = 0.25;

  let lastPH = na(), prevPH = na(), lastPHT = na(), prevPHT = na();
  let lastPL = na(), prevPL = na(), lastPLT = na(), prevPLT = na();

  let lastBearL = na(), lastBearH = na(), lastBullL = na(), lastBullH = na();

  let dZones: ObBox[] = [], sZones: ObBox[] = [];

  for (let i = 50; i < candles.length - 1; i++) {
    const ph = pivotHigh(candles, "high", 5, 5, i - 5);
    const pl = pivotLow(candles, "low", 5, 5, i - 5);

    if (!isNa(ph)) { prevPH = lastPH; prevPHT = lastPHT; lastPH = ph; lastPHT = i - 5; }
    if (!isNa(pl)) { prevPL = lastPL; prevPLT = lastPLT; lastPL = pl; lastPLT = i - 5; }

    const c = candles[i].close, o = candles[i].open, h = candles[i].high, l = candles[i].low;
    const atr = smoothAtr(i);
    const body = Math.abs(c - o);

    if (c < o) { lastBearL = l; lastBearH = h; }
    if (c > o) { lastBullL = l; lastBullH = h; }

    const bullImpulse = c > o && body >= impMult * atr;
    const bearImpulse = c < o && body >= impMult * atr;

    // Structure bias for current bar
    const bullBias = !isNa(lastPH) && !isNa(prevPH) && !isNa(lastPL) && !isNa(prevPL) && lastPH > prevPH && lastPL > prevPL;
    const bearBias = !isNa(lastPH) && !isNa(prevPH) && !isNa(lastPL) && !isNa(prevPL) && lastPH < prevPH && lastPL < prevPL;
    const biasVal = bullBias ? 1 : bearBias ? -1 : 0;

    let newD = false, dTop = na(), dBtm = na(), dBreak = false;
    let newS = false, sTop = na(), sBtm = na(), sBreak = false;

    if (bullImpulse && !isNa(lastBearL)) {
      if (Math.abs(c - lastBearL) <= atr * maxDistMult) {
        newD = true; dTop = lastBearH; dBtm = lastBearL;
        dBreak = !isNa(lastPH) && c > lastPH;
      }
    }
    if (bearImpulse && !isNa(lastBullH)) {
      if (Math.abs(c - lastBullH) <= atr * maxDistMult) {
        newS = true; sTop = lastBullH; sBtm = lastBullL;
        sBreak = !isNa(lastPL) && c < lastPL;
      }
    }

    // Classify
    const tlBuf = atr * tlBufMult;
    const curBullTL = lineValueAt(prevPLT, prevPL, lastPLT, lastPL, i);
    const curBearTL = lineValueAt(prevPHT, prevPH, lastPHT, lastPH, i);

    if (newD) {
      const mid = (dTop + dBtm) / 2;
      const pos = (!isNa(lastPH) && !isNa(lastPL) && lastPH !== lastPL) ? (mid - lastPL) / (lastPH - lastPL) : na();
      const extOk = pos <= extremPct && dBreak;
      const tlOk = !isNa(curBullTL) && Math.abs(mid - curBullTL) <= tlBuf && biasVal >= 0;
      const cls = extOk ? 1 : tlOk ? 2 : 0;
      if (cls > 0) dZones.push({ top: dTop, btm: dBtm, cls, hasIfvg: false, isMitigated: false });
    }

    if (newS) {
      const mid = (sTop + sBtm) / 2;
      const pos = (!isNa(lastPH) && !isNa(lastPL) && lastPH !== lastPL) ? (mid - lastPL) / (lastPH - lastPL) : na();
      const extOk = pos >= (1 - extremPct) && sBreak;
      const tlOk = !isNa(curBearTL) && Math.abs(mid - curBearTL) <= tlBuf && biasVal <= 0;
      const cls = extOk ? 1 : tlOk ? 2 : 0;
      if (cls > 0) sZones.push({ top: sTop, btm: sBtm, cls, hasIfvg: false, isMitigated: false });
    }

    // Mitigation Maintenance for Current Bar
    for (let j = dZones.length - 1; j >= 0; j--) {
      const box = dZones[j];
      const h_ = box.top - box.btm;
      if (!box.isMitigated && l <= box.btm + h_ * mitPct) box.isMitigated = true;
      if (l <= box.btm - h_ * (killMult - 1)) dZones.splice(j, 1);
    }
    for (let j = sZones.length - 1; j >= 0; j--) {
      const box = sZones[j];
      const h_ = box.top - box.btm;
      if (!box.isMitigated && h >= box.btm + h_ * mitPct) box.isMitigated = true;
      if (h >= box.top + h_ * (killMult - 1)) sZones.splice(j, 1);
    }
  }

  const lastBarIdx = candles.length - 1;
  const bullTLLive = lineValueAt(prevPLT, prevPL, lastPLT, lastPL, lastBarIdx);
  const bearTLLive = lineValueAt(prevPHT, prevPH, lastPHT, lastPH, lastBarIdx);

  // Maintain max 6 zones
  return {
    dZones: dZones.slice(-6),
    sZones: sZones.slice(-6),
    bullTL: bullTLLive, bearTL: bearTLLive
  };
}

// ═══════════════════════════════════════════════════════════
// EXTREME OB + IFVG ENGINE ENTRY
// ═══════════════════════════════════════════════════════════
export async function analyzePair(pair: string, interval = "5"): Promise<SMCAnalysis> {
  const currentIv = interval;
  const parentIv = currentIv === "5" ? "15" : "60";
  const gpIv     = currentIv === "5" ? "60" : "240";

  const [curRaw, parRaw, gpRaw] = await Promise.all([
    fetchBinanceKline(pair, currentIv, "1000"),
    fetchBinanceKline(pair, parentIv, "1000"),
    fetchBinanceKline(pair, gpIv, "1000")
  ]);

  if (!curRaw || curRaw.length < 100) throw new Error("Sem dados");

  const mapCandle = (c: any) => ({
    timestamp: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
  });

  const curC = curRaw.map(mapCandle);
  const parC = parRaw.map(mapCandle);
  const gpC  = gpRaw.map(mapCandle);

  const lastCur = curC[curC.length - 1];
  const curAtr  = calculateAtr(curC);

  // TV RSI / DIVERGENCE (Current)
  const rsiCurArr = calculateRSI(curC, 14);
  const curRsi = rsiCurArr[curC.length - 1];
  const divState = analyzeRsiDiv(curC, rsiCurArr);
  const demandHasRSI = curRsi <= 30;
  const supplyHasRSI = curRsi >= 70;
  const demandHasDiv = divState.bullDivRecent || divState.hiddenBullRecent;
  const supplyHasDiv = divState.bearDivRecent || divState.hiddenBearRecent;

  // Process states
  const curState = processEugenioTF(curC);
  const parState = processEugenioTF(parC);
  const gpState  = processEugenioTF(gpC);

  // Approach Check (Buf = 0.35 * ATR)
  const appBuf = Math.max(curAtr * 0.35, lastCur.close * 0.001);
  const checkApp = (boxes: ObBox[], demand: boolean) => {
    for (const b of boxes) {
      if (b.isMitigated) continue;
      if (demand) {
        const d = lastCur.low - b.top;
        if (d > 0 && d <= appBuf && lastCur.close >= b.btm) return true;
      } else {
        const d = b.btm - lastCur.high;
        if (d > 0 && d <= appBuf && lastCur.close <= b.top) return true;
      }
    }
    return false;
  };

  const checkTouch = (boxes: ObBox[], demand: boolean) => {
    for (const b of boxes) {
      if (b.isMitigated) continue;
      if (!(lastCur.high < b.btm || lastCur.low > b.top)) return true;
    }
    return false;
  };

  const appCurD = checkApp(curState.dZones, true);
  const appCurS = checkApp(curState.sZones, false);
  const appParD = checkApp(parState.dZones, true);
  const appParS = checkApp(parState.sZones, false);
  const appGpD  = checkApp(gpState.dZones, true);
  const appGpS  = checkApp(gpState.sZones, false);

  const appCurDMaster = appCurD && (demandHasRSI || demandHasDiv);
  const appParDMaster = appParD && (demandHasRSI || demandHasDiv);
  const appGpDMaster  = appGpD  && (demandHasRSI || demandHasDiv);
  const masterDemand  = appCurDMaster || appParDMaster || appGpDMaster;

  const appCurSMaster = appCurS && (supplyHasRSI || supplyHasDiv);
  const appParSMaster = appParS && (supplyHasRSI || supplyHasDiv);
  const appGpSMaster  = appGpS  && (supplyHasRSI || supplyHasDiv);
  const masterSupply  = appCurSMaster || appParSMaster || appGpSMaster;

  // Trendline Checks (Buf = 0.15 * ATR)
  const tlBuf = curAtr * 0.15;
  const isTlTouch = (val: number, price: number) => !isNa(val) && Math.abs(price - val) <= tlBuf;
  const touchCurBullTL = isTlTouch(curState.bullTL, lastCur.low);
  const touchCurBearTL = isTlTouch(curState.bearTL, lastCur.high);
  const touchGpBullTL  = isTlTouch(gpState.bullTL, lastCur.low);
  const touchGpBearTL  = isTlTouch(gpState.bearTL, lastCur.high);

  const premiumGpBull = touchGpBullTL && (demandHasRSI || demandHasDiv);
  const premiumGpBear = touchGpBearTL && (supplyHasRSI || supplyHasDiv);

  // Build Results
  let score = 0;
  const reasons: string[] = [];

  const srcD = appCurDMaster ? "CURRENT" : appParDMaster ? "PARENT" : "GRANDPARENT";
  const srcS = appCurSMaster ? "CURRENT" : appParSMaster ? "PARENT" : "GRANDPARENT";

  if (masterDemand) {
    score += 12;
    reasons.push(`🔵 MASTER OB (${srcD}) | APPROACHING DEMAND`);
  }
  if (masterSupply) {
    score += 12;
    reasons.push(`🔴 MASTER OB (${srcS}) | APPROACHING SUPPLY`);
  }
  if (premiumGpBull) {
    score += 15;
    reasons.push(`💎 PREMIUM TL BULL | GRANDPARENT TOUCH`);
  }
  if (premiumGpBear) {
    score += 15;
    reasons.push(`💎 PREMIUM TL BEAR | GRANDPARENT TOUCH`);
  }

  // Pre-alerts building
  if (demandHasRSI) reasons.push("📉 Cur RSI OVERSOLD (<30)");
  if (supplyHasRSI) reasons.push("📈 Cur RSI OVERBOUGHT (>70)");
  if (divState.bullDivRecent) reasons.push("🐂 Bull Div detectada");
  if (divState.hiddenBullRecent) reasons.push("🐂 Hidden Bull detectada");
  if (divState.bearDivRecent) reasons.push("🐻 Bear Div detectada");
  if (divState.hiddenBearRecent) reasons.push("🐻 Hidden Bear detectada");

  if (checkTouch(curState.dZones, true)) reasons.push("🔥 TOUCHE DZone Current (Possível Reação Intraday)");
  if (checkTouch(curState.sZones, false)) reasons.push("🔥 TOUCHE SZone Current (Possível Rejeição Intraday)");

  score += (demandHasRSI ? 2 : 0) + (demandHasDiv ? 2 : 0);
  score += (supplyHasRSI ? 2 : 0) + (supplyHasDiv ? 2 : 0);

  const isLong = masterDemand || premiumGpBull;
  const isShort= masterSupply || premiumGpBear;
  
  const setupSlDist = Math.max(curAtr * 1.5, lastCur.close * 0.01);
  const setupSl = isLong ? lastCur.close - setupSlDist : lastCur.close + setupSlDist;
  const setupTp = isLong ? lastCur.close + setupSlDist * 3 : lastCur.close - setupSlDist * 3;

  const htfBias = gpC[gpC.length - 1].close > gpC[gpC.length - 6].close ? "BULLISH" : "BEARISH";
  
  return {
    score: score,
    action: isLong ? "Long" : isShort ? "Short" : score >= 4 ? "Aguardar" : "Evitar",
    reasons,
    checklist: {
      liquidezIdentificada: masterDemand || masterSupply,
      sweepConfirmado: premiumGpBull || premiumGpBear,
      chochDetectado: false,
      orderBlockQualidade: masterDemand || masterSupply,
      contextoMacroAlinhado: (isLong && htfBias === "BULLISH") || (isShort && htfBias === "BEARISH"),
      volumeAlinhado: lastCur.volume > 100000,
      entradaNaReacao: checkTouch(curState.dZones, true) || checkTouch(curState.sZones, false),
      rrMinimoTresUm: true,
      idmDetectado: false, // Legacy SMC placeholder
      retestadoOB: masterDemand || masterSupply,
    },
    setup: { entry: lastCur.close, tp: setupTp, sl: setupSl, rr: 3.0 },
    bias: isLong ? 80 : isShort ? 20 : 50,
    timeframe: "M5",
    htfBias,
    structureType: "IMPULSIVE",
    session: { name: "EugenioStyle", color: "text-purple-400" },
    indicators: { rsi: curRsi, ema200: 0, volume: lastCur.volume > 100000 ? "ALTO" : "NORMAL" }
  };
}

function calculateAtr(candles: Candle[]): number {
  const lb = candles.slice(-14);
  return lb.reduce((s, c, i, a) => i === 0 ? s : Math.max(c.high - c.low, Math.abs(c.high - a[i-1].close), Math.abs(c.low - a[i-1].close)) + s, 0) / 13;
}
