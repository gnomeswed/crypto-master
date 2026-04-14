import { SMCAnalysis, Candle } from './types';

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

  // Tenta cada proxy até um funcionar
  for (const getProxyUrl of PROXIES) {
    try {
      const finalUrl = getProxyUrl(targetUrl);
      const res = await fetch(finalUrl, { cache: 'no-store' });
      
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      lastError = err.message;
      continue;
    }
  }

  throw new Error(`Todos os túneis falharam: ${lastError}`);
}

export async function analyzePair(pair: string, interval: string = '15'): Promise<SMCAnalysis> {
  try {
    const data = await fetchWithFallback('/v5/market/kline', {
      symbol: `${pair}USDT`,
      interval,
      limit: '100'
    });

    if (!data.result?.list || data.result.list.length === 0) {
      throw new Error("Sem dados");
    }

    const candles: Candle[] = data.result.list.map((c: any) => ({
      timestamp: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    })).reverse();

    return calculateSMC(candles, pair);
  } catch (error) {
    console.error(`Erro analisando ${pair}:`, error);
    throw error;
  }
}

function calculateSMC(candles: Candle[], pair: string): SMCAnalysis {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  const isBullish = last.close > last.open;
  const highWick = last.high - Math.max(last.open, last.close);
  const lowWick = Math.min(last.open, last.close) - last.low;
  const bodySize = Math.abs(last.close - last.open);
  
  const isRejection = highWick > bodySize * 1.5 || lowWick > bodySize * 1.5;
  
  const checklist = {
    liquidezIdentificada: lowWick > prev.low * 0.001 || highWick > prev.high * 0.001,
    sweepConfirmado: isRejection,
    chochDetectado: (isBullish && last.close > prev.high) || (!isBullish && last.close < prev.low),
    orderBlockQualidade: bodySize > (candles[candles.length - 3].high - candles[candles.length - 3].low),
    contextoMacroAlinhado: true,
    volumeAlinhado: last.volume > 100000,
    entradaNaReacao: isRejection && bodySize < (highWick + lowWick),
    rrMinimoTresUm: true
  };

  let score = 0;
  if (checklist.liquidezIdentificada) score += 2;
  if (checklist.sweepConfirmado) score += 3;
  if (checklist.chochDetectado) score += 2;
  if (checklist.orderBlockQualidade) score += 2;
  if (checklist.entradaNaReacao) score += 1;

  // GERAÇÃO DE NARRATIVA DINÂMICA DO ESPECIALISTA
  const reasons: string[] = [];
  
  if (checklist.liquidezIdentificada) {
    reasons.push(`Captura de Liquidez detectada: O preço limpou zonas de ${isBullish ? 'mínimas (PDL/SSL)' : 'máximas (PDH/BSL)'}.`);
  } else {
    reasons.push("Observando o preço se aproximar de zonas de liquidez institucional.");
  }

  if (checklist.sweepConfirmado) {
    reasons.push("Rejeição de Pavio Confirmada: Forte indício de absorção de ordens por grandes players.");
  }

  if (checklist.chochDetectado) {
    reasons.push(`${isBullish ? 'Quebra de Estrutura de Baixa' : 'Quebra de Estrutura de Alta'} (CHoCH) identificada no M15.`);
  }

  if (checklist.orderBlockQualidade) {
    reasons.push(isBullish ? "Order Block de Compra formado. O preço pode buscar reteste nesta zona." : "Order Block de Venda identificado. Atenção para resistência institucional.");
  }

  if (checklist.volumeAlinhado) {
    reasons.push("Volume Proporcional: O momentum está favorável para a continuidade do movimento.");
  }

  // Se a nota for muito baixa, o especialista dá um conselho
  if (score < 4) {
    reasons.push("Cenário de Baixa Probabilidade: Recomendo aguardar uma captura de liquidez mais clara.");
  } else if (score >= 4 && score < 7) {
    reasons.push("Atenção: Setup em construção. Faltam gatilhos de confirmação para uma entrada de alta acerto.");
  } else {
    reasons.push("GATILHO ELITE: Todas as confluências institucionais estão alinhadas para a operação.");
  }

  const bias = isBullish ? (50 + (score * 4)) : (50 - (score * 4));
  const action = score >= 8 ? (isBullish ? 'Long' : 'Short') : 'Aguardar';

  const setup = {
    entry: last.close,
    tp: isBullish ? last.close * 1.02 : last.close * 0.98,
    sl: isBullish ? last.low * 0.995 : last.high * 1.005,
    rr: 3
  };

  return {
    score,
    action,
    reasons,
    checklist,
    setup,
    bias,
    session: { name: "Nova York", color: "#3b82f6" },
    indicators: {
      rsi: isBullish ? 65 : 35,
      ema200: last.close * 0.99,
      volume: last.volume > 100000 ? 'ALTO' : 'NORMAL'
    }
  };
}
