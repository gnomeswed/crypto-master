import { SMCChecklist } from './types';

interface Candle {
  t: number; o: string; h: string; l: string; c: string; v: string;
}

export async function fetchKlines(symbol: string, interval: string, limit: number = 200): Promise<Candle[]> {
  const url = `/api/bybit?path=/v5/market/kline&category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}&_t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (data.result?.list) {
    return data.result.list.map((k: any) => ({
      t: parseInt(k[0]), o: k[1], h: k[2], l: k[3], c: k[4], v: k[5]
    })).reverse();
  }
  return [];
}

export function detectSweep(candles: Candle[], level: number, type: 'HIGH' | 'LOW'): boolean {
  if (candles.length < 2 || level === 0) return false;
  const last = candles[candles.length - 1];
  const lastHigh = parseFloat(last.h);
  const lastLow = parseFloat(last.l);
  const lastClose = parseFloat(last.c);
  if (type === 'HIGH') return lastHigh > level && lastClose < level;
  return lastLow < level && lastClose > level;
}

export function identifyLevels(dayCandles: Candle[]) {
  if (dayCandles.length < 2) return { pdh: 0, pdl: 0 };
  const prevDay = dayCandles[dayCandles.length - 2];
  return { pdh: parseFloat(prevDay.h), pdl: parseFloat(prevDay.l) };
}

export function getCurrentSession() {
  const now = new Date();
  const hour = now.getUTCHours();
  if (hour >= 0 && hour < 6) return { name: 'Ásia', icon: '🇯🇵', color: 'text-blue-400' };
  if (hour >= 8 && hour < 12) return { name: 'Londres', icon: '🇬🇧', color: 'text-emerald-400' };
  if (hour >= 13 && hour < 17) return { name: 'Nova York', icon: '🇺🇸', color: 'text-brand-400' };
  return { name: 'Inter-Sessão', icon: '🌙', color: 'text-slate-500' };
}

export async function analyzePair(pairName: string) {
  const symbol = pairName.endsWith('USDT') ? pairName : `${pairName}USDT`;
  const daily = await fetchKlines(symbol, 'D', 2);
  const { pdh, pdl } = identifyLevels(daily);

  const m15 = await fetchKlines(symbol, '15', 50);
  if (m15.length === 0) return { pair: pairName, score: 0, checklist: emptyChecklist(), indicators: { L: 0, S: 0, B: 0, O: 0 } };

  const currentPrice = parseFloat(m15[m15.length - 1].c);
  const sweepHigh = detectSweep(m15, pdh, 'HIGH');
  const sweepLow = detectSweep(m15, pdl, 'LOW');

  let currentScore = 0;
  const reasons: string[] = [];
  const checklist = emptyChecklist();
  const indicators = { L: 0, S: 0, B: 0, O: 0 };

  const session = getCurrentSession();

  // Cálculo de Probabilidade (Bias) de 0 a 100
  // 50 = Neutro, < 50 = Short, > 50 = Long
  let bias = 50;

  const distL = Math.abs(currentPrice - pdl) / currentPrice;
  const distH = Math.abs(currentPrice - pdh) / currentPrice;

  if (pdh > 0 && pdl > 0) {
    checklist.liquidezIdentificada = true;
    currentScore += 1;
    indicators.L = 2;
  }

  if (checklist.liquidezIdentificada) {
    checklist.contextoMacroAlinhado = true;
    currentScore += 1;
  }

  if (sweepHigh || sweepLow) {
    checklist.sweepConfirmado = true;
    currentScore += 3;
    indicators.S = 2;
    // Sweep de topo (Short) puxa o bias para baixo, sweep de fundo (Long) puxa para cima
    bias = sweepLow ? 75 : 25;
  } else {
    // Se não varreu, o bias é influenciado pela proximidade
    if (distL < 0.01) bias += 10;
    if (distH < 0.01) bias -= 10;
  }

  if (m15.length > 2) {
    const prevH = parseFloat(m15[m15.length - 2].h);
    const prevL = parseFloat(m15[m15.length - 2].l);
    if ((sweepLow && currentPrice > prevH) || (sweepHigh && currentPrice < prevL)) {
      checklist.chochOuBos = true;
      currentScore += 2;
      indicators.B = 2;
      // Confirmação aumenta a convicção do bias
      bias = (bias > 50) ? 90 : 10;
    }
  }

  if (distL < 0.003 || distH < 0.003) {
    checklist.orderBlockQualidade = true;
    checklist.entradaNaReacao = true;
    currentScore += 2;
    indicators.O = 2;
  }

  if (checklist.sweepConfirmado && checklist.chochOuBos) {
    checklist.rrMinimoTresUm = true;
    currentScore += 1;
  }

  // Ajuste fino de Bias baseado no score total
  if (currentScore > 5) {
    bias = (bias > 50) ? Math.min(bias + 10, 95) : Math.max(bias - 10, 5);
  }

  let setup = null;
  if (currentScore >= 8) {
    const isLong = sweepLow;
    const sl = isLong ? pdl * 0.999 : pdh * 1.001;
    const riskPrice = Math.abs(currentPrice - sl);
    const tp = isLong ? currentPrice + (riskPrice * 3) : currentPrice - (riskPrice * 3);
    setup = { entry: currentPrice, sl, tp, rr: 3.0, timestamp: Date.now(), session: session.name };
  }

  return {
    pair: pairName, score: currentScore, checklist, indicators,
    action: (sweepLow ? 'Long' : sweepHigh ? 'Short' : 'Aguardar') as any,
    price: currentPrice, levels: { pdh, pdl }, reasons, setup, session, bias
  };
}

function emptyChecklist(): SMCChecklist {
  return {
    liquidezIdentificada: false, sweepConfirmado: false, chochOuBos: false,
    orderBlockQualidade: false, contextoMacroAlinhado: false,
    volumeAlinhado: false, rrMinimoTresUm: false, entradaNaReacao: false
  };
}
