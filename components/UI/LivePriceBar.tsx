'use client';

import { useEffect, useState } from 'react';
import { Pair, PAIR_TO_SYMBOL } from '@/lib/types';

interface TickerItem {
  pair: Pair;
  lastPrice: number;
  changePercent: number;
}

const TRACKED_PAIRS: Pair[] = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'];

export default function LivePriceBar() {
  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  const [loading, setLoading] = useState(true);

  const fetchTickers = async () => {
    try {
      const results: TickerItem[] = [];
      await Promise.allSettled(
        TRACKED_PAIRS.map(async (pair) => {
          const symbol = PAIR_TO_SYMBOL[pair];
          const res = await fetch(
            `/api/bybit?path=/v5/market/tickers&category=linear&symbol=${symbol}`
          );
          const data = await res.json();
          if (data.result?.list?.[0]) {
            const item = data.result.list[0];
            results.push({
              pair,
              lastPrice: parseFloat(item.lastPrice),
              changePercent: parseFloat(item.price24hPcnt) * 100,
            });
          }
        })
      );
      // Manter ordem original
      const ordered = TRACKED_PAIRS.map((p) => results.find((r) => r.pair === p)).filter(
        Boolean
      ) as TickerItem[];
      setTickers(ordered);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickers();
    const interval = setInterval(fetchTickers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-2">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-xs font-bold tracking-widest uppercase"
            style={{ color: 'var(--green)' }}
          >
            ⬡ CRYPTO MASTER
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            SMC DASHBOARD
          </span>
        </div>

        {/* Tickers */}
        <div className="flex items-center gap-6 overflow-x-auto">
          {loading ? (
            <span
              className="font-mono text-xs animate-pulse"
              style={{ color: 'var(--text-muted)' }}
            >
              Conectando à Bybit...
            </span>
          ) : (
            tickers.map((t) => (
              <div key={t.pair} className="flex items-center gap-2 shrink-0">
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t.pair}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t.lastPrice >= 1000
                    ? t.lastPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : t.lastPrice.toFixed(4)}
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: t.changePercent >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {t.changePercent >= 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
                </span>
              </div>
            ))
          )}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="live-dot" />
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            BYBIT LIVE · {lastUpdate}
          </span>
        </div>
      </div>
    </div>
  );
}
