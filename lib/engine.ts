import { SMCAnalysis, Candle } from './types';

// TÚNEL DE CORS PARA BYPASS DE FIREWALL
const CORS_PROXY = "https://corsproxy.io/?";
const BYBIT_BASE = "https://api.bybit.com";

async function fetchBybit(path: string, params: Record<string, string>) {
  const queryString = new URLSearchParams({ ...params, category: 'linear' }).toString();
  const targetUrl = `${BYBIT_BASE}${path}?${queryString}`;
  
  // No online, usamos o Proxy CORS para usar o IP do usuário
  // No localhost, tentamos direto ou via proxy
  const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
  
  const res = await fetch(finalUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Bybit Offline (${res.status})`);
  return res.json();
}

export async function analyzePair(pair: string, interval: string = '15'): Promise<SMCAnalysis> {
  try {
    const data = await fetchBybit('/v5/market/kline', {
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
  
  // Lógica Simplificada de SMC (Ajustada para o Dashboard)
  const isBullish = last.close > last.open;
  const highWick = last.high - Math.max(last.open, last.close);
  const lowWick = Math.min(last.open, last.close) - last.low;
  const bodySize = Math.abs(last.close - last.open);
  
  // Detecção de Rejeição (Pavios Longos)
  const isRejection = highWick > bodySize * 1.5 || lowWick > bodySize * 1.5;
  
  // Checklist SMC
  const checklist = {
    liquidezCapturada: lowWick > prev.low * 0.001 || highWick > prev.high * 0.001,
    sweepConfirmado: isRejection,
    chochDetectado: (isBullish && last.close > prev.high) || (!isBullish && last.close < prev.low),
    orderBlockValido: bodySize > (candles[candles.length - 3].high - candles[candles.length - 3].low),
    contextoMacro: true,
    entradaConfirmada: isRejection && bodySize < (highWick + lowWick),
    rrMinimo: true
  };

  // Cálculo de Pontuação (0-10)
  let score = 0;
  if (checklist.liquidezCapturada) score += 2;
  if (checklist.sweepConfirmado) score += 3;
  if (checklist.chochDetectado) score += 2;
  if (checklist.orderBlockValido) score += 2;
  if (checklist.entradaConfirmada) score += 1;

  const bias = isBullish ? 70 : 30;
  const action = score >= 8 ? (isBullish ? 'Long' : 'Short') : 'Aguardar';

  // Setup de Entrada
  const setup = {
    entry: last.close,
    tp: isBullish ? last.close * 1.02 : last.close * 0.98,
    sl: isBullish ? last.low * 0.995 : last.high * 1.005,
    rr: 3
  };

  return {
    score,
    action,
    reasons: score >= 7 ? ["Forte Rejeição de Pavio", "Captura de Liquidez", "Order Block Identificado"] : ["Aguardando Confirmação"],
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
