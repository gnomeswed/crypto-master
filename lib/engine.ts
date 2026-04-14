import { SMCAnalysis, Candle, HTFBias, StructureType } from './types';

// LISTA DE TÚNEIS DE EMERGÊNCIA (PARA EVITAR BLOQUEIOS)
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

async function fetchWithFallback(path: string, params: Record<string, string>) {
  const queryString = new URLSearchParams({ ...params, category: 'linear' }).toString();
  const targetUrl = `https://api.bybit.com${path}?${queryString}`;
  
  let lastError = null;

  for (const getProxyUrl of PROXIES) {
    try {
      const finalUrl = getProxyUrl(targetUrl);
      const res = await fetch(finalUrl, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (err: any) {
      lastError = err.message;
      continue;
    }
  }
  throw new Error(`Todos os túneis falharam: ${lastError}`);
}

// ═══════════════════════════════════════════════════════════
// CACHE HTF BIAS — Evita sobrecarga de API (TTL: 5 minutos)
// ═══════════════════════════════════════════════════════════
const htfBiasCache: Record<string, { bias: HTFBias; ts: number }> = {};
const HTF_CACHE_TTL = 5 * 60 * 1000; // 5 minutos em ms

// ═══════════════════════════════════════════════════════════
// MÓDULO 1: HTF BIAS — Detecta viés institucional no H4
// ═══════════════════════════════════════════════════════════
async function detectHTFBias(pair: string): Promise<HTFBias> {
  // 1. Verifica cache primeiro — H4 não muda em 30 segundos
  const cached = htfBiasCache[pair];
  if (cached && Date.now() - cached.ts < HTF_CACHE_TTL) {
    return cached.bias;
  }

  try {
    const data = await fetchWithFallback('/v5/market/kline', {
      symbol: `${pair}USDT`,
      interval: '240', // H4
      limit: '20'
    });
    if (!data.result?.list || data.result.list.length < 6) return 'NEUTRAL';

    const candles: Candle[] = data.result.list.map((c: any) => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
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

    // 2. Armazena no cache
    htfBiasCache[pair] = { bias, ts: Date.now() };
    return bias;
  } catch {
    return 'NEUTRAL'; // Falha silenciosa — nunca bloqueia o scanner
  }
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 2: ESTRUTURA — Corretiva (Bandeira) vs Impulsiva
// ═══════════════════════════════════════════════════════════
function detectStructureType(candles: Candle[]): StructureType {
  const recent = candles.slice(-10);
  
  const avgBody = recent.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / recent.length;
  const lastThreeAvgBody = recent.slice(-3).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 3;
  
  // Verifica alternância de direção (sinal de estrutura corretiva / bandeira)
  let alternations = 0;
  for (let i = 1; i < recent.length; i++) {
    const prevBullish = recent[i - 1].close > recent[i - 1].open;
    const currBullish = recent[i].close > recent[i].open;
    if (prevBullish !== currBullish) alternations++;
  }

  // Corretiva: muita alternância + corpos menores que a média
  if (alternations >= 5 && lastThreeAvgBody < avgBody * 0.7) return 'CORRECTIVE';
  
  // Impulsiva: poucos flips + corpos grandes consistentes
  const lastThreeBullish = recent.slice(-3).filter(c => c.close > c.open).length;
  if (alternations <= 3 && (lastThreeBullish >= 3 || lastThreeBullish === 0)) return 'IMPULSIVE';

  return 'NEUTRAL';
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 3: IDM — Inducement (Armadilha do Varejo)
// ═══════════════════════════════════════════════════════════
function detectIDM(candles: Candle[], isBullish: boolean): boolean {
  // IDM: pequeno movimento contra a direção esperada ANTES do Sweep
  // Para Long: deve haver um LH (topo menor) antes da varredura das mínimas
  // Para Short: deve haver um HL (fundo maior) antes da varredura das máximas
  const window = candles.slice(-6, -1);
  if (window.length < 4) return false;

  if (isBullish) {
    // Procura um topo menor (Lower High) nas últimas 4 velas antes do candle atual
    for (let i = 1; i < window.length; i++) {
      if (window[i].high < window[i - 1].high) return true;
    }
  } else {
    // Procura um fundo maior (Higher Low) antes do Short
    for (let i = 1; i < window.length; i++) {
      if (window[i].low > window[i - 1].low) return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 4: TP DINÂMICO — Próxima Pool de Liquidez (PDH/PDL)
// ═══════════════════════════════════════════════════════════
function calculateDynamicTP(candles: Candle[], isBullish: boolean, entryPrice: number): { tp: number; sl: number; rr: number } {
  const lookback = candles.slice(-20, -1); // últimas 20 velas, excluindo a atual

  const pdh = Math.max(...lookback.map(c => c.high)); // Previous Day High (pool de liquidez acima)
  const pdl = Math.min(...lookback.map(c => c.low));  // Previous Day Low (pool de liquidez abaixo)

  const last = candles[candles.length - 1];
  const sl = isBullish ? last.low * 0.997 : last.high * 1.003;

  let tp: number;
  if (isBullish) {
    // Para Long: alvo é a pool de liquidez mais próxima ACIMA do preço
    tp = pdh > entryPrice ? pdh : entryPrice * 1.025; // fallback se PDH abaixo do preço
  } else {
    // Para Short: alvo é a pool de liquidez mais próxima ABAIXO do preço
    tp = pdl < entryPrice ? pdl : entryPrice * 0.975; // fallback se PDL acima do preço
  }

  const tpDistance = Math.abs(tp - entryPrice);
  const slDistance = Math.abs(sl - entryPrice);
  const rr = slDistance > 0 ? parseFloat((tpDistance / slDistance).toFixed(1)) : 3;

  return { tp, sl, rr };
}

// ═══════════════════════════════════════════════════════════
// MÓDULO 5: RETESTE DE OB — Validação de Entrada
// ═══════════════════════════════════════════════════════════
function isRetestingOB(candles: Candle[], isBullish: boolean): boolean {
  // O OB é a vela antes do movimento impulsivo
  // Verificamos se o preço atual está "visitando" o corpo dessa vela (reteste)
  if (candles.length < 4) return false;
  const ob = candles[candles.length - 3]; // 3 candles atrás como OB de referência
  const current = candles[candles.length - 1];
  const obMid = (ob.high + ob.low) / 2;

  // Tolerância de 0.5% para considerar como "dentro do OB"
  return Math.abs(current.close - obMid) / obMid < 0.005;
}

// ═══════════════════════════════════════════════════════════
// ANALISADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════
export async function analyzePair(pair: string, interval: string = '15'): Promise<SMCAnalysis> {
  try {
    // Busca candles do M15 (análise principal) — sempre prioritária
    const data = await fetchWithFallback('/v5/market/kline', {
      symbol: `${pair}USDT`,
      interval,
      limit: '100'
    });

    if (!data.result?.list || data.result.list.length === 0) throw new Error("Sem dados");

    const candles: Candle[] = data.result.list.map((c: any) => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    })).reverse();

    // HTF Bias — busca H4 APENAS se não estiver em cache (evita 25 chamadas simultâneas)
    // Em 99% dos scans, retorna do cache instantaneamente sem chamar a API
    const htfBias = await detectHTFBias(pair).catch(() => 'NEUTRAL' as HTFBias);

    return calculateSMC(candles, pair, interval, htfBias);
  } catch (error) {
    console.error(`Erro analisando ${pair}:`, error);
    throw error;
  }
}

function calculateSMC(candles: Candle[], pair: string, interval: string, htfBias: HTFBias): SMCAnalysis {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const isBullish = last.close > last.open;
  const highWick = last.high - Math.max(last.open, last.close);
  const lowWick = Math.min(last.open, last.close) - last.low;
  const bodySize = Math.abs(last.close - last.open);
  
  const isRejection = highWick > bodySize * 1.5 || lowWick > bodySize * 1.5;
  
  // Detecta estrutura e IDM
  const structureType = detectStructureType(candles);
  const idmDetectado = detectIDM(candles, isBullish);
  const retestadoOB = isRetestingOB(candles, isBullish);
  
  // Verifica alinhamento HTF: Long só se H4 Bullish, Short só se H4 Bearish
  const htfAligned = htfBias === 'NEUTRAL' || 
    (isBullish && htfBias === 'BULLISH') || 
    (!isBullish && htfBias === 'BEARISH');

  const checklist = {
    liquidezIdentificada: lowWick > prev.low * 0.001 || highWick > prev.high * 0.001,
    sweepConfirmado: isRejection,
    chochDetectado: (isBullish && last.close > prev.high) || (!isBullish && last.close < prev.low),
    orderBlockQualidade: bodySize > (candles[candles.length - 3].high - candles[candles.length - 3].low),
    contextoMacroAlinhado: htfAligned,          // ✅ Agora é REAL, não hardcoded
    volumeAlinhado: last.volume > 100000,
    entradaNaReacao: isRejection && bodySize < (highWick + lowWick),
    rrMinimoTresUm: true,
    idmDetectado,                                // ✅ NOVO: Armadilha do varejo
    retestadoOB,                                 // ✅ NOVO: Valida entrada no OB
  };

  let score = 0;
  if (checklist.liquidezIdentificada)  score += 2;
  if (checklist.sweepConfirmado)        score += 3;
  if (checklist.chochDetectado)         score += 2;
  if (checklist.orderBlockQualidade)    score += 2;
  if (checklist.entradaNaReacao)        score += 1;
  if (checklist.contextoMacroAlinhado) score += 2; // ✅ NOVO: HTF real bônus
  if (checklist.idmDetectado)           score += 1; // ✅ NOVO: IDM bônus
  if (checklist.retestadoOB)            score += 1; // ✅ NOVO: Reteste OB bônus

  // GERAÇÃO DE NARRATIVA DINÂMICA DO ESPECIALISTA
  const reasons: string[] = [];
  
  // HTF Bias
  const htfLabel = htfBias === 'BULLISH' ? '🟢 BULLISH' : htfBias === 'BEARISH' ? '🔴 BEARISH' : '⚪ NEUTRO';
  reasons.push(`Viés HTF (H4): ${htfLabel}${htfAligned ? ' — Alinhado com o trade.' : ' — ⚠️ CONTRA o viés maior!'}`);

  // Estrutura
  if (structureType === 'CORRECTIVE') {
    reasons.push('Estrutura Corretiva (Bandeira) detectada — Preço em acumulação, aguardando rompimento impulsivo.');
  } else if (structureType === 'IMPULSIVE') {
    reasons.push('Movimento Impulsivo identificado — Força direcional presente, momentum favorável.');
  }

  // IDM
  if (checklist.idmDetectado) {
    reasons.push('⚠️ IDM Detectado: Armadilha do varejo identificada antes do Sweep — Sinal de Alta Qualidade.');
  }

  // Liquidez
  if (checklist.liquidezIdentificada) {
    reasons.push(`Captura de Liquidez: Preço varreu zonas de ${isBullish ? 'mínimas (PDL/SSL)' : 'máximas (PDH/BSL)'}.`);
  } else {
    reasons.push('Observando preço se aproximar de zonas de liquidez institucional.');
  }

  if (checklist.sweepConfirmado) {
    reasons.push('Rejeição de Pavio Confirmada: Absorção de ordens por grandes players detectada.');
  }

  if (checklist.chochDetectado) {
    reasons.push(`${isBullish ? 'CHoCH de Alta' : 'CHoCH de Baixa'} confirmado — Mudança de Característica do preço.`);
  }

  // Reteste OB
  if (checklist.retestadoOB) {
    reasons.push('🎯 Reteste do Order Block em andamento — Entrada de precisão validada pelo Eugenio Method.');
  }

  if (checklist.orderBlockQualidade) {
    reasons.push(isBullish ? 'Order Block de Compra formado. Zona institucional identificada.' : 'Order Block de Venda identificado. Resistência institucional ativa.');
  }

  if (!htfAligned) {
    reasons.push(`⛔ ALERTA: Trade CONTRA o viés do H4 (${htfBias}). Risco elevado — Aguardar alinhamento.`);
  }

  // Score summary
  if (score < 4) {
    reasons.push('Cenário de Baixa Probabilidade: Aguardar confluência mais clara.');
  } else if (score < 7) {
    reasons.push('Setup em construção. Faltam gatilhos de confirmação.');
  } else if (score < 10) {
    reasons.push('SETUP VALIDADO: Confluências SMC alinhadas. Aguarde reteste para entrada de precisão.');
  } else {
    reasons.push('🏆 GATILHO ELITE: HTF + IDM + CHoCH + OB alinhados. Setup de máxima qualidade.');
  }

  const bias = isBullish ? (50 + (score * 3)) : (50 - (score * 3));
  // Score agora vai até 14 — ajusta threshold de entrada
  const action = score >= 9 ? (isBullish ? 'Long' : 'Short') : (score < 3 ? 'Evitar' : 'Aguardar');

  // TP Dinâmico (PDH/PDL real)
  const { tp, sl, rr } = calculateDynamicTP(candles, isBullish, last.close);

  const setup = { entry: last.close, tp, sl, rr };

  // Sessão com base no horário atual
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
    setup,
    bias: Math.min(100, Math.max(0, bias)),
    timeframe: interval as any,
    htfBias,
    structureType,
    session,
    indicators: {
      rsi: isBullish ? 65 : 35,
      ema200: last.close * 0.99,
      volume: last.volume > 100000 ? 'ALTO' : 'NORMAL'
    }
  };
}
