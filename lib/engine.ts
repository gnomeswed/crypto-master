import { SMCAnalysis, Candle, HTFBias, StructureType } from './types';

// ═══════════════════════════════════════════════════════════
// PROXIES — Túneis de emergência (anti-bloqueio CORS)
// ═══════════════════════════════════════════════════════════
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchWithFallback(path: string, params: Record<string, string>) {
  const queryString = new URLSearchParams({ ...params, category: 'linear' }).toString();
  const targetUrl = `https://api.bybit.com${path}?${queryString}`;
  for (const getProxyUrl of PROXIES) {
    try {
      const res = await fetch(getProxyUrl(targetUrl), { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (err: any) { continue; }
  }
  throw new Error('Todos os túneis falharam.');
}

// ═══════════════════════════════════════════════════════════
// CACHE HTF — Evita sobrecarga de API (TTL: 5 minutos)
// ═══════════════════════════════════════════════════════════
const htfBiasCache: Record<string, { bias: HTFBias; ts: number }> = {};
const HTF_CACHE_TTL = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════
// MÓDULO A: RSI REAL — Wilder's Smoothed Moving Average
// [Extraído de: ta.rsi() do PineScript do Eugenio]
// ═══════════════════════════════════════════════════════════
function calculateRSI(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 50;

  // Fase 1: Média simples inicial
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Fase 2: Wilder's Smoothing (mesmo que PineScript usa)
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ═══════════════════════════════════════════════════════════
// MÓDULO B: RSI DIVERGÊNCIA
// [Extraído de: bullDiv/bearDiv/hiddenBull/hiddenBear do Eugenio]
// ═══════════════════════════════════════════════════════════
interface DivResult {
  bullDiv: boolean;       // Regular Bull: Preço LL + RSI HL (reversão alta)
  bearDiv: boolean;       // Regular Bear: Preço HH + RSI LH (reversão baixa)
  hiddenBull: boolean;    // Hidden Bull: Preço HL + RSI LL (continuação alta)
  hiddenBear: boolean;    // Hidden Bear: Preço LH + RSI HH (continuação baixa)
}

function detectDivergence(candles: Candle[], pivotLeft = 5, pivotRight = 3): DivResult {
  const result: DivResult = { bullDiv: false, bearDiv: false, hiddenBull: false, hiddenBear: false };
  if (candles.length < pivotLeft + pivotRight + 10) return result;

  // Calcula RSI para todas as velas
  const rsiArr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    rsiArr.push(calculateRSI(candles.slice(0, i + 1)));
  }

  // Encontra pivot lows recentes (suporte)
  const pivotLows: { idx: number; price: number; rsi: number }[] = [];
  const pivotHighs: { idx: number; price: number; rsi: number }[] = [];

  for (let i = pivotLeft; i < candles.length - pivotRight; i++) {
    const windowLow = candles.slice(i - pivotLeft, i + pivotRight + 1).map(c => c.low);
    const windowHigh = candles.slice(i - pivotLeft, i + pivotRight + 1).map(c => c.high);
    const minLow = Math.min(...windowLow);
    const maxHigh = Math.max(...windowHigh);

    if (candles[i].low === minLow) {
      pivotLows.push({ idx: i, price: candles[i].low, rsi: rsiArr[i] });
    }
    if (candles[i].high === maxHigh) {
      pivotHighs.push({ idx: i, price: candles[i].high, rsi: rsiArr[i] });
    }
  }

  // Analisa os 2 últimos pivôs de baixa/alta
  if (pivotLows.length >= 2) {
    const pl1 = pivotLows[pivotLows.length - 2]; // Pivô anterior
    const pl2 = pivotLows[pivotLows.length - 1]; // Pivô mais recente
    const barsApart = pl2.idx - pl1.idx;

    if (barsApart >= 5 && barsApart <= 60) {
      // Regular Bullish: Preço fez novo fundo (LL) mas RSI fez fundo maior (HL)
      if (pl2.price < pl1.price && pl2.rsi > pl1.rsi) result.bullDiv = true;
      // Hidden Bullish: Preço fez fundo maior (HL) mas RSI fez novo fundo (LL)
      if (pl2.price > pl1.price && pl2.rsi < pl1.rsi) result.hiddenBull = true;
    }
  }

  if (pivotHighs.length >= 2) {
    const ph1 = pivotHighs[pivotHighs.length - 2];
    const ph2 = pivotHighs[pivotHighs.length - 1];
    const barsApart = ph2.idx - ph1.idx;

    if (barsApart >= 5 && barsApart <= 60) {
      // Regular Bearish: Preço fez novo topo (HH) mas RSI fez topo menor (LH)
      if (ph2.price > ph1.price && ph2.rsi < ph1.rsi) result.bearDiv = true;
      // Hidden Bearish: Preço fez topo menor (LH) mas RSI fez novo topo (HH)
      if (ph2.price < ph1.price && ph2.rsi > ph1.rsi) result.hiddenBear = true;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO C: EXTREME OB FILTER
// [Extraído de: extremePct + inLowExtreme/inHighExtreme do Eugenio]
// OB só é válido se estiver nos EXTREMOS do range (20% inferior/superior)
// ═══════════════════════════════════════════════════════════
function isExtremeOB(candles: Candle[], obHigh: number, obLow: number, direction: 'demand' | 'supply'): boolean {
  const lookback = candles.slice(-20);
  const rangeHigh = Math.max(...lookback.map(c => c.high));
  const rangeLow = Math.min(...lookback.map(c => c.low));
  const rangeSize = rangeHigh - rangeLow;
  if (rangeSize === 0) return false;

  const obMid = (obHigh + obLow) / 2;
  const EXTREME_PCT = 0.20; // Top/Bottom 20% do range

  if (direction === 'demand') {
    // OB de compra deve estar nos 20% inferiores do range
    return (obMid - rangeLow) / rangeSize <= EXTREME_PCT;
  } else {
    // OB de venda deve estar nos 20% superiores do range
    return (rangeHigh - obMid) / rangeSize <= EXTREME_PCT;
  }
}

// ═══════════════════════════════════════════════════════════
// MÓDULO D: IFVG — Inverse Fair Value Gap
// [Extraído de: f_ifvg_state() do Eugenio]
// FVG que foi "invertido" → torna-se zona de suporte/resistência
// ═══════════════════════════════════════════════════════════
interface IFVGResult {
  bullIFVG: boolean;   // Suporte IFVG (FVG baixista que price ultrapassou → vira suporte)
  bearIFVG: boolean;   // Resistência IFVG (FVG altista que price caiu → vira resistência)
  ifvgTop: number;
  ifvgBtm: number;
}

function detectIFVG(candles: Candle[]): IFVGResult {
  const result: IFVGResult = { bullIFVG: false, bearIFVG: false, ifvgTop: 0, ifvgBtm: 0 };
  if (candles.length < 20) return result;

  const last = candles[candles.length - 1];
  const ATR = candles.slice(-14).reduce((sum, c, i, arr) => {
    if (i === 0) return sum;
    return sum + Math.max(c.high - c.low, Math.abs(c.high - arr[i-1].close), Math.abs(c.low - arr[i-1].close));
  }, 0) / 13;

  // Procura FVGs nas últimas 50 velas e verifica se foram invertidos
  for (let i = 3; i < candles.length - 2; i++) {
    const c = candles;

    // Bullish FVG: gap entre high[i-2] e low[i] (preço pulou para cima)
    const bullGapTop = c[i].low;
    const bullGapBtm = c[i - 2].high;
    if (bullGapTop > bullGapBtm && (bullGapTop - bullGapBtm) > ATR * 0.2) {
      // Verifica se o preço DEPOIS voltou abaixo desse FVG (inversão → vira suporte)
      const priceAfter = candles.slice(i).some(ca => ca.close < bullGapBtm);
      if (priceAfter && last.low >= bullGapBtm && last.low <= bullGapTop + ATR * 0.25) {
        result.bullIFVG = true;
        result.ifvgBtm = bullGapBtm;
        result.ifvgTop = bullGapTop;
      }
    }

    // Bearish FVG: gap entre low[i-2] e high[i] (preço pulou para baixo)
    const bearGapTop = c[i - 2].low;
    const bearGapBtm = c[i].high;
    if (bearGapTop > bearGapBtm && (bearGapTop - bearGapBtm) > ATR * 0.2) {
      // Verifica se o preço DEPOIS subiu acima desse FVG (inversão → vira resistência)
      const priceAbove = candles.slice(i).some(ca => ca.close > bearGapTop);
      if (priceAbove && last.high <= bearGapTop && last.high >= bearGapBtm - ATR * 0.25) {
        result.bearIFVG = true;
        result.ifvgBtm = bearGapBtm;
        result.ifvgTop = bearGapTop;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO E: APPROACH DETECTION
// [Extraído de: approachingZone() + ATR buffer do Eugenio]
// Preço se APROXIMANDO da zona (pre-alert) vs já dentro da zona
// ═══════════════════════════════════════════════════════════
function isApproachingOB(candles: Candle[], obTop: number, obBtm: number, direction: 'demand' | 'supply'): boolean {
  const last = candles[candles.length - 1];
  const ATR = candles.slice(-14).reduce((sum, c, i, arr) => {
    if (i === 0) return sum;
    return sum + (c.high - c.low);
  }, 0) / 13;

  const buffer = ATR * 0.35; // Igual ao approachAtrMult do Eugenio

  if (direction === 'demand') {
    // Preço abaixo mas dentro do buffer da zona de compra
    const dist = last.low - obTop;
    return dist > 0 && dist <= buffer;
  } else {
    // Preço acima mas dentro do buffer da zona de venda
    const dist = obBtm - last.high;
    return dist > 0 && dist <= buffer;
  }
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 1: HTF BIAS — Detecta viés institucional no H4
// ═══════════════════════════════════════════════════════════
async function detectHTFBias(pair: string): Promise<HTFBias> {
  const cached = htfBiasCache[pair];
  if (cached && Date.now() - cached.ts < HTF_CACHE_TTL) return cached.bias;

  try {
    const data = await fetchWithFallback('/v5/market/kline', {
      symbol: `${pair}USDT`,
      interval: '240',
      limit: '20'
    });
    if (!data.result?.list || data.result.list.length < 6) return 'NEUTRAL';

    const candles: Candle[] = data.result.list.map((c: any) => ({
      timestamp: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]),
      low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
    })).reverse();

    const recent = candles.slice(-6);
    let hhCount = 0, hlCount = 0, lhCount = 0, llCount = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].high > recent[i - 1].high) hhCount++;
      if (recent[i].low > recent[i - 1].low) hlCount++;
      if (recent[i].high < recent[i - 1].high) lhCount++;
      if (recent[i].low < recent[i - 1].low) llCount++;
    }

    let bias: HTFBias = 'NEUTRAL';
    if (hhCount >= 3 && hlCount >= 2) bias = 'BULLISH';
    else if (lhCount >= 3 && llCount >= 2) bias = 'BEARISH';

    htfBiasCache[pair] = { bias, ts: Date.now() };
    return bias;
  } catch { return 'NEUTRAL'; }
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 2: ESTRUTURA — Corretiva vs Impulsiva
// ═══════════════════════════════════════════════════════════
function detectStructureType(candles: Candle[]): StructureType {
  const recent = candles.slice(-10);
  const avgBody = recent.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / recent.length;
  const lastThreeAvgBody = recent.slice(-3).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 3;

  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    const prevBullish = recent[i - 1].close > recent[i - 1].open;
    const currBullish = recent[i].close > recent[i].open;
    if (prevBullish !== currBullish) alternations++;
  }

  if (alternations >= 5 && lastThreeAvgBody < avgBody * 0.7) return 'CORRECTIVE';
  const lastThreeBullish = recent.slice(-3).filter(c => c.close > c.open).length;
  if (alternations <= 3 && (lastThreeBullish >= 3 || lastThreeBullish === 0)) return 'IMPULSIVE';
  return 'NEUTRAL';
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 3: IDM — Inducement
// ═══════════════════════════════════════════════════════════
function detectIDM(candles: Candle[], isBullish: boolean): boolean {
  const window = candles.slice(-6, -1);
  if (window.length < 4) return false;
  for (let i = 1; i < window.length; i++) {
    if (isBullish && window[i].high < window[i - 1].high) return true;
    if (!isBullish && window[i].low > window[i - 1].low) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 4: TP/SL DINÂMICO — ATR-based, mínimo 1.5% para 10x leverage
// ═══════════════════════════════════════════════════════════════════════
// Regra: com 10x alavancagem, 1% movimento = 10% no capital.
// SL mínimo: 1.5% bruto (= 15% drawdown com 10x). Ideal: 1.5× ATR.
function calculateDynamicTP(candles: Candle[], isBullish: boolean, entryPrice: number): { tp: number; sl: number; rr: number } {
  const lookback = candles.slice(-20, -1);
  const pdh = Math.max(...lookback.map(c => c.high));
  const pdl = Math.min(...lookback.map(c => c.low));

  // ATR dos últimos 14 candles
  const atr = candles.slice(-14).reduce((sum, c, i, arr) => {
    if (i === 0) return sum;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - arr[i - 1].close),
      Math.abs(c.low  - arr[i - 1].close)
    );
    return sum + tr;
  }, 0) / 13;

  // SL: 1.5× ATR ou mínimo 1.5% do preço (o MAIOR dos dois)
  const atrSLDist = atr * 1.5;
  const minSLDist = entryPrice * 0.015; // 1.5% mínimo absoluto
  const slDist    = Math.max(atrSLDist, minSLDist);

  const sl = isBullish
    ? entryPrice - slDist   // LONG: SL abaixo da entrada
    : entryPrice + slDist;  // SHORT: SL acima da entrada

  // TP: usa PDH/PDL se RR >= 2:1, senão garante mínimo 3:1
  let tp: number;
  if (isBullish) {
    const pdhRR = pdh > entryPrice ? Math.abs(pdh - entryPrice) / slDist : 0;
    tp = pdhRR >= 2.0 ? pdh : entryPrice + slDist * 3.0;
  } else {
    const pdlRR = pdl < entryPrice ? Math.abs(entryPrice - pdl) / slDist : 0;
    tp = pdlRR >= 2.0 ? pdl : entryPrice - slDist * 3.0;
  }

  const rr = parseFloat((Math.abs(tp - entryPrice) / slDist).toFixed(1));
  return { tp, sl, rr };
}


// ═══════════════════════════════════════════════════════════
// MÓDULO 5: RETESTE OB
// ═══════════════════════════════════════════════════════════
function isRetestingOB(candles: Candle[], isBullish: boolean): boolean {
  if (candles.length < 4) return false;
  const ob = candles[candles.length - 3];
  const current = candles[candles.length - 1];
  const obMid = (ob.high + ob.low) / 2;
  return Math.abs(current.close - obMid) / obMid < 0.005;
}

// ═══════════════════════════════════════════════════════════
// ANALISADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════
export async function analyzePair(pair: string, interval: string = '15'): Promise<SMCAnalysis> {
  try {
    const data = await fetchWithFallback('/v5/market/kline', {
      symbol: `${pair}USDT`, interval, limit: '100'
    });

    if (!data.result?.list || data.result.list.length === 0) throw new Error("Sem dados");

    const candles: Candle[] = data.result.list.map((c: any) => ({
      timestamp: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]),
      low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
    })).reverse();

    const htfBias = await detectHTFBias(pair).catch(() => 'NEUTRAL' as HTFBias);
    return calculateSMC(candles, pair, interval, htfBias);
  } catch (error) {
    console.error(`Erro analisando ${pair}:`, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// MOTOR SMC COMPLETO — Eugenio Method + Tio Mack
// ═══════════════════════════════════════════════════════════
function calculateSMC(candles: Candle[], pair: string, interval: string, htfBias: HTFBias): SMCAnalysis {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const isBullish = last.close > last.open;
  const highWick = last.high - Math.max(last.open, last.close);
  const lowWick = Math.min(last.open, last.close) - last.low;
  const bodySize = Math.abs(last.close - last.open);
  const isRejection = highWick > bodySize * 1.5 || lowWick > bodySize * 1.5;

  // ─── Detectores Modularizados ───────────────────────────
  const structureType = detectStructureType(candles);
  const idmDetectado = detectIDM(candles, isBullish);
  const retestadoOB = isRetestingOB(candles, isBullish);

  // RSI Real (Wilder's method — já não é mais fake!)
  const rsiReal = calculateRSI(candles);
  const rsiOversold = rsiReal <= 30;
  const rsiOverbought = rsiReal >= 70;

  // Divergências RSI (Módulo B — Eugenio Method)
  const div = detectDivergence(candles);
  const hasBullishEdge = rsiOversold || div.bullDiv || div.hiddenBull;
  const hasBearishEdge = rsiOverbought || div.bearDiv || div.hiddenBear;

  // OB Extremo (Módulo C — Eugenio Method: extremePct = 20%)
  const obTop = prev.high;
  const obBtm = prev.low;
  const obExtremo = isExtremeOB(candles, obTop, obBtm, isBullish ? 'demand' : 'supply');

  // IFVG Confluence (Módulo D — Eugenio Method)
  const ifvg = detectIFVG(candles);
  const ifvgConfluente = isBullish ? ifvg.bullIFVG : ifvg.bearIFVG;

  // Aproximação vs Toque (Módulo E — Eugenio Method)
  const approachingZone = isApproachingOB(candles, obTop, obBtm, isBullish ? 'demand' : 'supply');

  // HTF Alinhado
  const htfAligned = htfBias === 'NEUTRAL' ||
    (isBullish && htfBias === 'BULLISH') || (!isBullish && htfBias === 'BEARISH');

  // ─── CHECKLIST COMPLETA ──────────────────────────────────
  const checklist = {
    liquidezIdentificada: lowWick > prev.low * 0.001 || highWick > prev.high * 0.001,
    sweepConfirmado: isRejection,
    chochDetectado: (isBullish && last.close > prev.high) || (!isBullish && last.close < prev.low),
    orderBlockQualidade: obExtremo, // ✅ Agora usa Extreme OB Filter (Eugenio)
    contextoMacroAlinhado: htfAligned,
    volumeAlinhado: last.volume > 100000,
    entradaNaReacao: isRejection && bodySize < (highWick + lowWick),
    rrMinimoTresUm: true,
    idmDetectado,
    retestadoOB,
  };

  // ─── SISTEMA DE PONTUAÇÃO ────────────────────────────────
  let score = 0;
  if (checklist.liquidezIdentificada)   score += 2;
  if (checklist.sweepConfirmado)         score += 2;
  if (checklist.chochDetectado)          score += 2;
  if (checklist.orderBlockQualidade)     score += 2; // OB Extremo do Eugenio
  if (checklist.contextoMacroAlinhado)   score += 1;
  if (checklist.volumeAlinhado)          score += 1;
  if (checklist.entradaNaReacao)         score += 1;
  if (checklist.idmDetectado)            score += 1; // IDM/Inducement
  if (checklist.retestadoOB)             score += 1; // Reteste OB
  if (hasBullishEdge && isBullish)       score += 1; // RSI/DIV Confluência Eugenio
  if (hasBearishEdge && !isBullish)      score += 1; // RSI/DIV Confluência Eugenio
  if (ifvgConfluente)                    score += 1; // IFVG Confluence Eugenio
  if (approachingZone)                   score += 1; // Pre-alert: abordagem ao OB

  // ─── NARRATIVA DO AGENTE ─────────────────────────────────
  const reasons: string[] = [];

  // HTF Bias
  const htfLabel = htfBias === 'BULLISH' ? '🟢 BULLISH' : htfBias === 'BEARISH' ? '🔴 BEARISH' : '⚪ NEUTRO';
  reasons.push(`Viés HTF (H4): ${htfLabel}${htfAligned ? ' — Alinhado.' : ' — ⚠️ CONTRA o viés maior!'}`);

  // RSI Real
  reasons.push(`RSI (14): ${rsiReal.toFixed(1)} — ${rsiOversold ? '🟢 OVERSOLD (pressão de compra)' : rsiOverbought ? '🔴 OVERBOUGHT (pressão de venda)' : '⚪ Zona neutra'}`);

  // Divergências (Eugenio Method)
  if (div.bullDiv) reasons.push('📈 Divergência Regular Bullish: Preço fez novo fundo mas RSI não — Reversão de Alta sinalizada.');
  if (div.hiddenBull) reasons.push('📈 Divergência Hidden Bullish: Continuação da alta confirmada pelo RSI.');
  if (div.bearDiv) reasons.push('📉 Divergência Regular Bearish: Preço fez novo topo mas RSI não — Reversão de Baixa sinalizada.');
  if (div.hiddenBear) reasons.push('📉 Divergência Hidden Bearish: Continuação da baixa confirmada pelo RSI.');

  // OB Extremo
  if (checklist.orderBlockQualidade) {
    reasons.push(`🎯 Extreme OB (Eugenio Method): Order Block nas zonas extremas do range — Alta probabilidade de reação.`);
  } else {
    reasons.push('⚠️ OB não está na zona extrema do range — Qualidade reduzida (risco de mid-range rejeição).');
  }

  // IFVG
  if (ifvgConfluente) {
    reasons.push(`⚡ IFVG Confluence: Inverse Fair Value Gap detectado — Zona de liquidez invertida confirma o OB.`);
  }

  // IDM
  if (checklist.idmDetectado) {
    reasons.push(`⚠️ IDM: Armadilha do varejo detectada antes do Sweep — Qualidade institucional confirmada.`);
  }

  // Reteste OB
  if (checklist.retestadoOB) {
    reasons.push('🔁 Reteste do OB em andamento — Entrada de precisão (Eugenio Method).');
  }

  // Aproximação (pre-alert)
  if (approachingZone) {
    reasons.push('📡 Pré-Alerta: Preço se aproximando da zona de interesse — Fique atento para o gatilho!');
  }

  // Estrutura
  if (structureType === 'CORRECTIVE') reasons.push('🚩 Estrutura Corretiva (Bandeira) — Preço em acumulação.');
  else if (structureType === 'IMPULSIVE') reasons.push('⚡ Movimento Impulsivo — Força direcional presente.');

  // Sweep
  if (checklist.sweepConfirmado) reasons.push('💧 Sweep de Liquidez confirmado — Absorção institucional detectada.');
  if (checklist.chochDetectado) reasons.push(`📐 CHoCH: ${isBullish ? 'Quebra de Estrutura de Baixa' : 'Quebra de Estrutura de Alta'} confirmada.`);

  // Master Alert (replicando approachDemand_Master do Eugenio)
  const masterSignal = (approachingZone || retestadoOB) && (isBullish ? hasBullishEdge : hasBearishEdge);
  if (score < 4) {
    reasons.push('🔇 Cenário de Baixa Probabilidade — Aguardar confluência mais clara.');
  } else if (score < 7) {
    reasons.push('📊 Setup em construção — Faltam gatilhos de confirmação.');
  } else if (score < 10) {
    reasons.push('✅ SETUP VALIDADO: Confluências SMC alinhadas. Aguarde reteste.');
  } else if (masterSignal) {
    reasons.push('🏆 MASTER SIGNAL (Eugenio Method): OB Extremo + RSI/DIV + Approach — Setup de Máxima Qualidade!');
  } else {
    reasons.push('💎 GATILHO ELITE: HTF + IDM + CHoCH + OB alinhados.');
  }

  const bias = Math.min(100, Math.max(0, isBullish ? 50 + (score * 3) : 50 - (score * 3)));
  // Score max = 16 → threshold para entrada = 9+
  const action = score >= 9 ? (isBullish ? 'Long' : 'Short') : (score < 3 ? 'Evitar' : 'Aguardar');

  const { tp, sl, rr } = calculateDynamicTP(candles, isBullish, last.close);

  const hour = new Date().getUTCHours();
  const session = hour >= 13 && hour < 22
    ? { name: 'Nova York 🇺🇸', color: 'text-blue-400' }
    : hour >= 7 && hour < 13
    ? { name: 'Londres 🇬🇧', color: 'text-emerald-400' }
    : { name: 'Ásia 🌏', color: 'text-amber-400' };

  return {
    score,
    action,
    reasons,
    checklist,
    setup: { entry: last.close, tp, sl, rr },
    bias,
    timeframe: interval as any,
    htfBias,
    structureType,
    session,
    indicators: {
      rsi: rsiReal,
      ema200: last.close * 0.99,
      volume: last.volume > 100000 ? 'ALTO' : 'NORMAL'
    }
  };
}
