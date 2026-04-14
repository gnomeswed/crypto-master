'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LineStyle, CandlestickSeries } from 'lightweight-charts';
import { Pair, Timeframe, PAIR_TO_SYMBOL, TIMEFRAME_LABELS } from '@/lib/types';

interface SMCLevels {
  PDH: number | null;
  PDL: number | null;
  EQH: number[];
  EQL: number[];
  asiaHigh: number | null;
  asiaLow: number | null;
}

interface Props {
  pair: Pair;
  timeframe: Timeframe;
  levels?: SMCLevels;
}

const BYBIT_INTERVAL: Record<Timeframe, string> = {
  M1: '1', M5: '5', M15: '15', H1: '60', H4: '240', D1: 'D',
};

const CANDLE_LIMIT: Record<Timeframe, number> = {
  M1: 120, M5: 100, M15: 96, H1: 72, H4: 60, D1: 90,
};

export default function CandleChart({ pair, timeframe, levels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastCandle, setLastCandle] = useState<{ o: number; h: number; l: number; c: number } | null>(null);

  const fetchAndRender = async () => {
    const symbol = PAIR_TO_SYMBOL[pair];
    const interval = BYBIT_INTERVAL[timeframe];
    const limit = CANDLE_LIMIT[timeframe];

    try {
      const res = await fetch(
        `/api/bybit?path=/v5/market/kline&category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data = await res.json();
      const rawList: string[][] = data.result?.list ?? [];
      if (rawList.length === 0) throw new Error('no data');

      // Bybit returns newest first — reverse for chart
      const candles: CandlestickData[] = rawList
        .slice()
        .reverse()
        .map((k) => ({
          time: (parseInt(k[0]) / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

      const last = candles[candles.length - 1];
      setLastPrice(last.close);
      setLastCandle({ o: last.open, h: last.high, l: last.low, c: last.close });

      if (seriesRef.current) {
        seriesRef.current.setData(candles);
      }

      setLoading(false);
      setError(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#111111' },
        textColor: '#737373',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#404040', style: LineStyle.Dashed },
        horzLine: { color: '#404040', style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#262626',
        textColor: '#737373',
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // --green
      downColor: '#f43f5e', // --red
      borderUpColor: '#10b981',
      borderDownColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Add SMC level lines
  useEffect(() => {
    if (!chartRef.current || !levels) return;

    const priceLinesConfig = [
      levels.PDH && { price: levels.PDH, color: '#ef4444', label: 'PDH', lineWidth: 1, lineStyle: LineStyle.Dashed },
      levels.PDL && { price: levels.PDL, color: '#22c55e', label: 'PDL', lineWidth: 1, lineStyle: LineStyle.Dashed },
      levels.asiaHigh && { price: levels.asiaHigh, color: '#f5a623', label: 'Asia H', lineWidth: 1, lineStyle: LineStyle.Dotted },
      levels.asiaLow && { price: levels.asiaLow, color: '#f5a623', label: 'Asia L', lineWidth: 1, lineStyle: LineStyle.Dotted },
      ...levels.EQH.slice(0, 2).map((p, i) => ({ price: p, color: '#f87171', label: `EQH${i + 1}`, lineWidth: 1, lineStyle: LineStyle.Dotted })),
      ...levels.EQL.slice(0, 2).map((p, i) => ({ price: p, color: '#4ade80', label: `EQL${i + 1}`, lineWidth: 1, lineStyle: LineStyle.Dotted })),
    ].filter(Boolean);

    if (seriesRef.current) {
      priceLinesConfig.forEach((cfg) => {
        if (cfg && seriesRef.current) {
          seriesRef.current.createPriceLine({
            price: cfg.price as number,
            color: cfg.color,
            lineWidth: cfg.lineWidth as 1,
            lineStyle: cfg.lineStyle,
            axisLabelVisible: true,
            title: cfg.label,
          });
        }
      });
    }
  }, [levels]);

  // Fetch on pair/timeframe change
  useEffect(() => {
    setLoading(true);
    fetchAndRender();
    const interval = setInterval(fetchAndRender, 30000);
    return () => clearInterval(interval);
  }, [pair, timeframe]);

  const formatPrice = (p: number) =>
    p >= 100
      ? p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : p.toFixed(5);

  return (
    <div
      className="card flex flex-col"
      style={{ background: 'var(--bg-surface)', minHeight: 420 }}
    >
      {/* Chart header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {pair}/USDT
          </span>
          <span
            className="font-mono text-xs px-2 py-0.5"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {timeframe}
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            PERPETUAL FUTURES
          </span>
        </div>

        {/* OHLC display */}
        {lastCandle && (
          <div className="hidden sm:flex items-center gap-4">
            {[
              { label: 'A', value: lastCandle.o, color: 'var(--text-secondary)' },
              { label: 'M', value: lastCandle.h, color: 'var(--green)' },
              { label: 'B', value: lastCandle.l, color: 'var(--red)' },
              { label: 'F', value: lastCandle.c, color: lastCandle.c >= lastCandle.o ? 'var(--green)' : 'var(--red)' },
            ].map((item) => (
              <div key={item.label} className="font-mono text-xs">
                <span style={{ color: 'var(--text-muted)' }}>{item.label}: </span>
                <span style={{ color: item.color }}>{formatPrice(item.value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live price */}
        {lastPrice && (
          <div className="font-mono text-lg font-bold" style={{ color: lastCandle && lastCandle.c >= lastCandle.o ? 'var(--green)' : 'var(--red)' }}>
            ${formatPrice(lastPrice)}
          </div>
        )}
      </div>

      {/* SMC levels legend */}
      {levels && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-1.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: '#0d0d0d' }}
        >
          {levels.PDH && (
            <div className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, background: '#ef4444', borderTop: '2px dashed #ef4444' }} />
              <span className="font-mono text-xs" style={{ color: '#ef4444' }}>PDH ${formatPrice(levels.PDH)}</span>
            </div>
          )}
          {levels.PDL && (
            <div className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, borderTop: '2px dashed #22c55e' }} />
              <span className="font-mono text-xs" style={{ color: '#22c55e' }}>PDL ${formatPrice(levels.PDL)}</span>
            </div>
          )}
          {levels.asiaHigh && (
            <div className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, borderTop: '2px dotted #f5a623' }} />
              <span className="font-mono text-xs" style={{ color: '#f5a623' }}>Asia H ${formatPrice(levels.asiaHigh)}</span>
            </div>
          )}
          {levels.asiaLow && (
            <div className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, borderTop: '2px dotted #f5a623' }} />
              <span className="font-mono text-xs" style={{ color: '#f5a623' }}>Asia L ${formatPrice(levels.asiaLow)}</span>
            </div>
          )}
          {levels.EQH.slice(0,2).map((z, i) => (
            <div key={`eqh-${i}`} className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, borderTop: '2px dotted #f87171' }} />
              <span className="font-mono text-xs" style={{ color: '#f87171' }}>EQH ${formatPrice(z)}</span>
            </div>
          ))}
          {levels.EQL.slice(0,2).map((z, i) => (
            <div key={`eql-${i}`} className="flex items-center gap-1">
              <div style={{ width: 16, height: 2, borderTop: '2px dotted #4ade80' }} />
              <span className="font-mono text-xs" style={{ color: '#4ade80' }}>EQL ${formatPrice(z)}</span>
            </div>
          ))}
          {!levels.PDH && !levels.PDL && !levels.asiaHigh && (
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Selecione um par para carregar os níveis →
            </span>
          )}
        </div>
      )}

      {/* Chart area */}
      <div className="relative flex-1" style={{ minHeight: 340 }}>
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div className="text-center">
              <div className="font-mono text-xs animate-pulse" style={{ color: 'var(--green)' }}>
                ◎ Carregando candles {pair}/USDT {timeframe}...
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Bybit API v5
              </div>
            </div>
          </div>
        )}
        {error && !loading && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'var(--bg-surface)' }}
          >
            <div className="font-mono text-xs text-center" style={{ color: 'var(--red)' }}>
              ✕ Erro ao carregar dados. Verifique conexão.<br />
              <button onClick={fetchAndRender} className="mt-2" style={{ color: 'var(--blue)' }}>
                ↻ Tentar novamente
              </button>
            </div>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 340 }} />
      </div>
    </div>
  );
}
