import { MarketData, PAIR_TO_SYMBOL, Pair } from './types';
import { checkRateLimit } from './rateLimiter';
import logger from './logger';

const BYBIT_BASE = 'https://api.bybit.com';

async function fetchBybit<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = `bybit_${path}`;
  if (!checkRateLimit(key)) {
    logger.warn(`Rate limit exceeded for ${key}`);
    throw new Error('Rate limit exceeded');
  }

  const url = new URL(BYBIT_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      logger.error(`Bybit API error: ${res.status} for ${url.toString()}`);
      throw new Error(`Bybit API error: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    logger.error('Erro ao fazer fetch para Bybit:', error);
    throw error;
  }
}

function detectEqualLevels(prices: number[], threshold = 0.0005): number[] {
  const zones: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      const diff = Math.abs(prices[i] - prices[j]) / prices[i];
      if (diff < threshold) {
        zones.push((prices[i] + prices[j]) / 2);
      }
    }
  }
  const unique = [...new Set(zones.map((z) => Math.round(z * 100) / 100))];
  return unique.sort((a, b) => b - a).slice(0, 5);
}

export async function fetchMarketData(pair: Pair): Promise<MarketData> {
  const symbol = PAIR_TO_SYMBOL[pair];

  const [tickerData, dailyKlines, hourlyKlines] = await Promise.all([
    fetchBybit<{ retCode: number; result: { list: Array<{ lastPrice: string; prevPrice24h: string; price24hPcnt: string }> } }>(
      '/v5/market/tickers',
      { category: 'linear', symbol }
    ),
    fetchBybit<{ retCode: number; result: { list: string[][] } }>(
      '/v5/market/kline',
      { category: 'linear', symbol, interval: 'D', limit: '4' }
    ),
    fetchBybit<{ retCode: number; result: { list: string[][] } }>(
      '/v5/market/kline',
      { category: 'linear', symbol, interval: '60', limit: '48' }
    ),
  ]);

  const ticker = tickerData.result.list[0];
  const lastPrice = parseFloat(ticker.lastPrice);
  const prevPrice24h = parseFloat(ticker.prevPrice24h);
  const changePercent = parseFloat(ticker.price24hPcnt) * 100;

  // PDH/PDL — índice 1 = dia anterior (índice 0 = dia atual em formação)
  let PDH: number | null = null;
  let PDL: number | null = null;
  if (dailyKlines.result.list.length >= 2) {
    const prevDay = dailyKlines.result.list[1]; // [startTime, open, high, low, close, volume, turnover]
    PDH = parseFloat(prevDay[2]);
    PDL = parseFloat(prevDay[3]);
  }

  // EQH/EQL detectados nas últimas 48h (H1)
  const hourlyData = hourlyKlines.result.list;
  const highs = hourlyData.map((k) => parseFloat(k[2]));
  const lows = hourlyData.map((k) => parseFloat(k[3]));
  const EQH = detectEqualLevels(highs);
  const EQL = detectEqualLevels(lows);

  // Asia Range: sessão asiática = 00h–03h BRT = 03h–06h UTC
  // Filtrar candles H1 dentro do horário asiático do dia corrente
  const now = Date.now();
  const todayMidnightUTC = new Date();
  todayMidnightUTC.setUTCHours(0, 0, 0, 0);
  const asiaStart = todayMidnightUTC.getTime() + 3 * 3600 * 1000; // 03:00 UTC
  const asiaEnd = todayMidnightUTC.getTime() + 6 * 3600 * 1000;   // 06:00 UTC

  const asiaCandles = hourlyData.filter((k) => {
    const ts = parseInt(k[0]);
    return ts >= asiaStart && ts < asiaEnd;
  });

  let asiaHigh: number | null = null;
  let asiaLow: number | null = null;
  if (asiaCandles.length > 0) {
    asiaHigh = Math.max(...asiaCandles.map((k) => parseFloat(k[2])));
    asiaLow = Math.min(...asiaCandles.map((k) => parseFloat(k[3])));
  }

  return {
    symbol,
    lastPrice,
    prevPrice24h,
    changePercent,
    PDH,
    PDL,
    EQH,
    EQL,
    asiaHigh,
    asiaLow,
    timestamp: now,
  };
}

export async function fetchMultipleTickers(pairs: Pair[]): Promise<Record<string, { lastPrice: number; changePercent: number }>> {
  const results: Record<string, { lastPrice: number; changePercent: number }> = {};

  await Promise.allSettled(
    pairs.map(async (pair) => {
      const symbol = PAIR_TO_SYMBOL[pair];
      try {
        const data = await fetchBybit<{
          retCode: number;
          result: { list: Array<{ lastPrice: string; price24hPcnt: string }> };
        }>('/v5/market/tickers', { category: 'linear', symbol });
        const item = data.result.list[0];
        results[pair] = {
          lastPrice: parseFloat(item.lastPrice),
          changePercent: parseFloat(item.price24hPcnt) * 100,
        };
      } catch {
        // silently fail per pair
      }
    })
  );

  return results;
}
