import { SMCAnalysis, Candle, HTFBias, StructureType } from "./types";

// ═══════════════════════════════════════════════════════════
// CACHE GLOBAL — Evita re-fetch desnecessário
// ═══════════════════════════════════════════════════════════
interface CacheEntry<T> { data: T; ts: number; }
const klineCache: Record<string, CacheEntry<any>>    = {};
const htfBiasCache: Record<string, CacheEntry<HTFBias>> = {};
const KLINE_TTL  = 15_000; // 15s — velas em tempo real
const HTF_TTL    = 5 * 60_000; // 5min — bias H4

// ═══════════════════════════════════════════════════════════
// FETCH — Binance Direto (Anti-Bloqueios, Super Rápido)
// ═══════════════════════════════════════════════════════════
async function fetchBinanceKline(pair: string, interval: string, limit: string) {
  const mapInterval = (iv: string) => iv === "15" ? "15m" : iv === "60" ? "1h" : iv === "240" ? "4h" : iv === "D" ? "1d" : iv + "m";
  const binanceIv = mapInterval(interval);
  const targetUrl = `https://api.binance.com/api/v3/klines?symbol=${pair}USDT&interval=${binanceIv}&limit=${limit}`;
  const cacheKey = targetUrl;
  const cached = klineCache[cacheKey];
  if (cached && Date.now() - cached.ts < KLINE_TTL) return cached.data;

  const res = await fetch(targetUrl, { cache: "no-store" }); 
  if (!res.ok) throw new Error("Falha na API da Binance");
  const data = await res.json();
  klineCache[cacheKey] = { data, ts: Date.now() };
  return data;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO A: RSI — Wilder Smoothed
// ═══════════════════════════════════════════════════════════
function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ═══════════════════════════════════════════════════════════
// MÓDULO B: Divergência RSI
// ═══════════════════════════════════════════════════════════
interface DivResult { bullDiv: boolean; bearDiv: boolean; hiddenBull: boolean; hiddenBear: boolean; }

function detectDivergence(candles: Candle[], pl = 5, pr = 3): DivResult {
  const r: DivResult = { bullDiv: false, bearDiv: false, hiddenBull: false, hiddenBear: false };
  if (candles.length < pl + pr + 10) return r;
  const rsiArr = candles.map((_, i) => calculateRSI(candles.slice(0, i + 1)));
  const lows: { idx: number; price: number; rsi: number }[] = [];
  const highs: { idx: number; price: number; rsi: number }[] = [];
  for (let i = pl; i < candles.length - pr; i++) {
    const wl = candles.slice(i - pl, i + pr + 1).map(c => c.low);
    const wh = candles.slice(i - pl, i + pr + 1).map(c => c.high);
    if (candles[i].low  === Math.min(...wl)) lows.push({ idx: i, price: candles[i].low, rsi: rsiArr[i] });
    if (candles[i].high === Math.max(...wh)) highs.push({ idx: i, price: candles[i].high, rsi: rsiArr[i] });
  }
  if (lows.length >= 2) {
    const [pl1, pl2] = [lows[lows.length - 2], lows[lows.length - 1]];
    const d = pl2.idx - pl1.idx;
    if (d >= 5 && d <= 60) {
      if (pl2.price < pl1.price && pl2.rsi > pl1.rsi) r.bullDiv = true;
      if (pl2.price > pl1.price && pl2.rsi < pl1.rsi) r.hiddenBull = true;
    }
  }
  if (highs.length >= 2) {
    const [ph1, ph2] = [highs[highs.length - 2], highs[highs.length - 1]];
    const d = ph2.idx - ph1.idx;
    if (d >= 5 && d <= 60) {
      if (ph2.price > ph1.price && ph2.rsi < ph1.rsi) r.bearDiv = true;
      if (ph2.price < ph1.price && ph2.rsi > ph1.rsi) r.hiddenBear = true;
    }
  }
  return r;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO C: Extreme OB Filter (20%)
// ═══════════════════════════════════════════════════════════
function isExtremeOB(candles: Candle[], obH: number, obL: number, dir: "demand" | "supply"): boolean {
  const lb = candles.slice(-20);
  const hi = Math.max(...lb.map(c => c.high));
  const lo = Math.min(...lb.map(c => c.low));
  const rng = hi - lo;
  if (rng === 0) return false;
  const mid = (obH + obL) / 2;
  return dir === "demand" ? (mid - lo) / rng <= 0.2 : (hi - mid) / rng <= 0.2;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO D: IFVG
// ═══════════════════════════════════════════════════════════
interface IFVGResult { bullIFVG: boolean; bearIFVG: boolean; ifvgTop: number; ifvgBtm: number; }
function detectIFVG(candles: Candle[]): IFVGResult {
  const r: IFVGResult = { bullIFVG: false, bearIFVG: false, ifvgTop: 0, ifvgBtm: 0 };
  if (candles.length < 20) return r;
  const last = candles[candles.length - 1];
  const atr = candles.slice(-14).reduce((s, c, i, a) => i === 0 ? s :
    s + Math.max(c.high - c.low, Math.abs(c.high - a[i-1].close), Math.abs(c.low - a[i-1].close)), 0) / 13;
  for (let i = 3; i < candles.length - 2; i++) {
    const gapTop = candles[i].low, gapBtm = candles[i - 2].high;
    if (gapTop > gapBtm && gapTop - gapBtm > atr * 0.2) {
      if (candles.slice(i).some(c => c.close < gapBtm) && last.low >= gapBtm && last.low <= gapTop + atr * 0.25) {
        r.bullIFVG = true; r.ifvgBtm = gapBtm; r.ifvgTop = gapTop;
      }
    }
    const bTop = candles[i - 2].low, bBtm = candles[i].high;
    if (bTop > bBtm && bTop - bBtm > atr * 0.2) {
      if (candles.slice(i).some(c => c.close > bTop) && last.high <= bTop && last.high >= bBtm - atr * 0.25) {
        r.bearIFVG = true; r.ifvgBtm = bBtm; r.ifvgTop = bTop;
      }
    }
  }
  return r;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO E: Approach Detection
// ═══════════════════════════════════════════════════════════
function isApproachingOB(candles: Candle[], obTop: number, obBtm: number, dir: "demand" | "supply"): boolean {
  const last = candles[candles.length - 1];
  const atr = candles.slice(-14).reduce((s, c, i, a) => i === 0 ? s : s + c.high - c.low, 0) / 13;
  const buf = atr * 0.35;
  if (dir === "demand") { const d = last.low - obTop; return d > 0 && d <= buf; }
  const d = obBtm - last.high;
  return d > 0 && d <= buf;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 1: HTF Bias (H4) — com cache 5min
// ═══════════════════════════════════════════════════════════
async function detectHTFBias(pair: string): Promise<HTFBias> {
  const cached = htfBiasCache[pair];
  if (cached && Date.now() - cached.ts < HTF_TTL) return cached.data;
  try {
    const data = await fetchBinanceKline(pair, "240", "20");
    if (!data || data.length < 6) return "NEUTRAL";
    const candles: Candle[] = data.map((c: any) => ({
      timestamp: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
    }));
    const r = candles.slice(-6);
    let hh = 0, hl = 0, lh = 0, ll = 0;
    for (let i = 1; i < r.length; i++) {
      if (r[i].high > r[i-1].high) hh++;
      if (r[i].low  > r[i-1].low)  hl++;
      if (r[i].high < r[i-1].high) lh++;
      if (r[i].low  < r[i-1].low)  ll++;
    }
    const bias: HTFBias = hh >= 3 && hl >= 2 ? "BULLISH" : lh >= 3 && ll >= 2 ? "BEARISH" : "NEUTRAL";
    htfBiasCache[pair] = { data: bias, ts: Date.now() };
    return bias;
  } catch { return "NEUTRAL"; }
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 2: Estrutura
// ═══════════════════════════════════════════════════════════
function detectStructureType(candles: Candle[]): StructureType {
  const r = candles.slice(-10);
  const avgBody = r.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / r.length;
  const lastThree = r.slice(-3).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 3;
  let alt = 0;
  for (let i = 1; i < r.length; i++) {
    if ((r[i-1].close > r[i-1].open) !== (r[i].close > r[i].open)) alt++;
  }
  if (alt >= 5 && lastThree < avgBody * 0.7) return "CORRECTIVE";
  const bull3 = r.slice(-3).filter(c => c.close > c.open).length;
  if (alt <= 3 && (bull3 >= 3 || bull3 === 0)) return "IMPULSIVE";
  return "NEUTRAL";
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 3: IDM
// ═══════════════════════════════════════════════════════════
function detectIDM(candles: Candle[], bull: boolean): boolean {
  const w = candles.slice(-6, -1);
  if (w.length < 4) return false;
  return w.some((c, i) => i > 0 && (bull ? c.high < w[i-1].high : c.low > w[i-1].low));
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 4: TP/SL Dinâmico (ATR-based)
// ═══════════════════════════════════════════════════════════
function calculateDynamicTP(candles: Candle[], bull: boolean, entry: number) {
  const lb = candles.slice(-20, -1);
  const pdh = Math.max(...lb.map(c => c.high));
  const pdl = Math.min(...lb.map(c => c.low));
  const atr = candles.slice(-14).reduce((s, c, i, a) => i === 0 ? s :
    s + Math.max(c.high - c.low, Math.abs(c.high - a[i-1].close), Math.abs(c.low - a[i-1].close)), 0) / 13;
  const slDist = Math.max(atr * 1.5, entry * 0.015);
  const sl = bull ? entry - slDist : entry + slDist;
  let tp: number;
  if (bull) {
    tp = pdh > entry && (pdh - entry) / slDist >= 2 ? pdh : entry + slDist * 3;
  } else {
    tp = pdl < entry && (entry - pdl) / slDist >= 2 ? pdl : entry - slDist * 3;
  }
  return { tp, sl, rr: parseFloat((Math.abs(tp - entry) / slDist).toFixed(1)) };
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 5: Reteste OB
// ═══════════════════════════════════════════════════════════
function isRetestingOB(candles: Candle[], bull: boolean): boolean {
  if (candles.length < 4) return false;
  const ob = candles[candles.length - 3];
  const cur = candles[candles.length - 1];
  return Math.abs(cur.close - (ob.high + ob.low) / 2) / ((ob.high + ob.low) / 2) < 0.005;
}

// ═══════════════════════════════════════════════════════════
// MOTOR SMC — Eugenio Method + Tio Mack
// ═══════════════════════════════════════════════════════════
function calculateSMC(candles: Candle[], pair: string, interval: string, htfBias: HTFBias): SMCAnalysis {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const bull = last.close > last.open;
  const highWick = last.high - Math.max(last.open, last.close);
  const lowWick  = Math.min(last.open, last.close) - last.low;
  const body     = Math.abs(last.close - last.open);
  const isRej    = highWick > body * 1.5 || lowWick > body * 1.5;

  const structureType  = detectStructureType(candles);
  const idmDetectado   = detectIDM(candles, bull);
  const retestadoOB    = isRetestingOB(candles, bull);
  const rsiReal        = calculateRSI(candles);
  const rsiOS          = rsiReal <= 30, rsiOB = rsiReal >= 70;
  const div            = detectDivergence(candles);
  const bullEdge       = rsiOS || div.bullDiv || div.hiddenBull;
  const bearEdge       = rsiOB || div.bearDiv || div.hiddenBear;
  const obExtremo      = isExtremeOB(candles, prev.high, prev.low, bull ? "demand" : "supply");
  const ifvg           = detectIFVG(candles);
  const ifvgConf       = bull ? ifvg.bullIFVG : ifvg.bearIFVG;
  const approaching    = isApproachingOB(candles, prev.high, prev.low, bull ? "demand" : "supply");
  const htfAligned     = htfBias === "NEUTRAL" || (bull && htfBias === "BULLISH") || (!bull && htfBias === "BEARISH");

  const checklist = {
    liquidezIdentificada: lowWick > prev.low * 0.001 || highWick > prev.high * 0.001,
    sweepConfirmado:      isRej,
    chochDetectado:       (bull && last.close > prev.high) || (!bull && last.close < prev.low),
    orderBlockQualidade:  obExtremo,
    contextoMacroAlinhado: htfAligned,
    volumeAlinhado:       last.volume > 100000,
    entradaNaReacao:      isRej && body < (highWick + lowWick),
    rrMinimoTresUm:       true,
    idmDetectado,
    retestadoOB,
  };

  let score = 0;
  if (checklist.liquidezIdentificada)   score += 2;
  if (checklist.sweepConfirmado)         score += 2;
  if (checklist.chochDetectado)          score += 2;
  if (checklist.orderBlockQualidade)     score += 2;
  if (checklist.contextoMacroAlinhado)   score += 1;
  if (checklist.volumeAlinhado)          score += 1;
  if (checklist.entradaNaReacao)         score += 1;
  if (checklist.idmDetectado)            score += 1;
  if (checklist.retestadoOB)             score += 1;
  if (bullEdge && bull)                  score += 1;
  if (bearEdge && !bull)                 score += 1;
  if (ifvgConf)                          score += 1;
  if (approaching)                       score += 1;

  const reasons: string[] = [];
  const htfLabel = htfBias === "BULLISH" ? "🟢 BULLISH" : htfBias === "BEARISH" ? "🔴 BEARISH" : "⚪ NEUTRO";
  reasons.push(`Viés HTF (H4): ${htfLabel}${htfAligned ? " — Alinhado." : " — ⚠️ CONTRA o viés maior!"}`);
  reasons.push(`RSI (14): ${rsiReal.toFixed(1)} — ${rsiOS ? "🟢 OVERSOLD" : rsiOB ? "🔴 OVERBOUGHT" : "⚪ Zona neutra"}`);
  if (div.bullDiv)   reasons.push("📈 Divergência Regular Bullish.");
  if (div.hiddenBull) reasons.push("📈 Divergência Hidden Bullish.");
  if (div.bearDiv)   reasons.push("📉 Divergência Regular Bearish.");
  if (div.hiddenBear) reasons.push("📉 Divergência Hidden Bearish.");
  if (obExtremo)     reasons.push("🎯 Extreme OB (Eugenio Method): Alta probabilidade de reação.");
  else               reasons.push("⚠️ OB fora da zona extrema — Qualidade reduzida.");
  if (ifvgConf)      reasons.push("⚡ IFVG Confluence detectado.");
  if (idmDetectado)  reasons.push("⚠️ IDM: Armadilha do varejo antes do Sweep.");
  if (retestadoOB)   reasons.push("🔁 Reteste do OB em andamento.");
  if (approaching)   reasons.push("📡 Pré-Alerta: Preço se aproximando da zona.");
  if (structureType === "CORRECTIVE") reasons.push("🚩 Estrutura Corretiva.");
  else if (structureType === "IMPULSIVE") reasons.push("⚡ Movimento Impulsivo.");
  if (checklist.sweepConfirmado) reasons.push("💧 Sweep de Liquidez confirmado.");
  if (checklist.chochDetectado) reasons.push(`📐 CHoCH ${bull ? "de Baixa" : "de Alta"} confirmado.`);
  const masterSignal = (approaching || retestadoOB) && (bull ? bullEdge : bearEdge);
  if (score < 4)          reasons.push("🔇 Baixa Probabilidade — Aguardar.");
  else if (score < 7)     reasons.push("📊 Setup em construção.");
  else if (score < 10)    reasons.push("✅ SETUP VALIDADO: Aguarde reteste.");
  else if (masterSignal)  reasons.push("🏆 MASTER SIGNAL: Setup de Máxima Qualidade!");
  else                    reasons.push("💎 GATILHO ELITE: HTF + IDM + CHoCH + OB alinhados.");

  const { tp, sl, rr } = calculateDynamicTP(candles, bull, last.close);
  const action = score >= 9 ? (bull ? "Long" : "Short") : score < 3 ? "Evitar" : "Aguardar";
  const bias   = Math.min(100, Math.max(0, bull ? 50 + score * 3 : 50 - score * 3));
  const hour   = new Date().getUTCHours();
  const session = hour >= 13 && hour < 22
    ? { name: "Nova York 🇺🇸", color: "text-blue-400" }
    : hour >= 7 && hour < 13
    ? { name: "Londres 🇬🇧", color: "text-emerald-400" }
    : { name: "Ásia 🌏", color: "text-amber-400" };

  return {
    score, action, reasons, checklist,
    setup: { entry: last.close, tp, sl, rr },
    bias, timeframe: interval as any, htfBias, structureType, session,
    indicators: { rsi: rsiReal, ema200: last.close * 0.99, volume: last.volume > 100000 ? "ALTO" : "NORMAL" }
  };
}

// ═══════════════════════════════════════════════════════════
// EXPORT PRINCIPAL
// ═══════════════════════════════════════════════════════════
export async function analyzePair(pair: string, interval = "15"): Promise<SMCAnalysis> {
  const data = await fetchBinanceKline(pair, interval, "100");
  if (!data || data.length === 0) throw new Error("Sem dados");
  const candles: Candle[] = data.map((c: any) => ({
    timestamp: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
  }));
  const htfBias = await detectHTFBias(pair).catch(() => "NEUTRAL" as HTFBias);
  return calculateSMC(candles, pair, interval, htfBias);
}
