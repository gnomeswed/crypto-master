'use client';

import { useSignals } from '@/lib/SignalContext';
import {
  Clock, BarChart3, Target, CheckCircle2, ExternalLink,
  Zap, ShieldCheck, ZapOff, LayoutGrid, Info, Timer
} from 'lucide-react';
import { useEffect, useState } from 'react';

// ─── Elapsed Time Hook ────────────────────────────────────
function useElapsed(dataHora: string) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = Date.now() - new Date(dataHora).getTime();
      const m = Math.floor(diff / 60000);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) return `${d}d ${h % 24}h`;
      if (h > 0) return `${h}h ${m % 60}min`;
      return `${m}min`;
    };
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 30_000);
    return () => clearInterval(id);
  }, [dataHora]);
  return elapsed;
}

// ─── Duração estimada por timeframe ──────────────────────
function estimatedDuration(tf?: string): { label: string; warn: boolean } {
  const map: Record<string, { label: string; warn: boolean }> = {
    '5':   { label: '30min – 2h',  warn: true  },
    'M5':  { label: '30min – 2h',  warn: true  },
    '15':  { label: '2h – 6h',    warn: false },
    'M15': { label: '2h – 6h',    warn: false },
    '60':  { label: '8h – 24h',   warn: false },
    'H1':  { label: '8h – 24h',   warn: false },
    '240': { label: '1 – 3 dias', warn: false },
    'H4':  { label: '1 – 3 dias', warn: false },
    'D':   { label: '3 – 7 dias', warn: false },
    'D1':  { label: '3 – 7 dias', warn: false },
  };
  return map[tf || ''] || { label: '2h – 8h', warn: false };
}

// ─── Trade Card Isolado ────────────────────────────────────
function TradeCard({
  trade, currentPrice, onOpenChart, onClose
}: {
  trade: any;
  currentPrice: number;
  onOpenChart: () => void;
  onClose: (positive: boolean) => void;
}) {
  const elapsed  = useElapsed(trade.dataHora);
  const duration = estimatedDuration(trade.timeframe);

  const isLong    = trade.direcao === 'LONG';
  const capital   = trade.capitalSimulado || 0;
  const lev       = trade.alavancagem || 1;

  let pnlUsdt = 0, pnlPcnt = 0, distToTP = 0, distToSL = 0;
  let maxProfitUsdt = 0, maxLossUsdt = 0;

  if (trade.precoEntrada && currentPrice > 0) {
    const diff     = isLong ? (currentPrice - trade.precoEntrada) : (trade.precoEntrada - currentPrice);
    const movePcnt = diff / trade.precoEntrada;
    pnlPcnt  = movePcnt * lev * 100;
    pnlUsdt  = capital * movePcnt * lev;

    if (trade.targetTP)  distToTP = Math.abs(currentPrice - trade.targetTP)  / currentPrice * 100;
    if (trade.precoStop) distToSL = Math.abs(currentPrice - trade.precoStop) / currentPrice * 100;

    if (trade.targetTP) {
      const tpDiff = isLong ? (trade.targetTP - trade.precoEntrada) : (trade.precoEntrada - trade.targetTP);
      maxProfitUsdt = Math.max(0, capital * (tpDiff / trade.precoEntrada) * lev);
    }
    if (trade.precoStop) {
      const slDiff = isLong ? (trade.precoEntrada - trade.precoStop) : (trade.precoStop - trade.precoEntrada);
      maxLossUsdt = Math.max(0, capital * (slDiff / trade.precoEntrada) * lev);
    }
  }

  const isProfit = pnlUsdt >= 0;

  const showBreakEven = (() => {
    if (!trade.targetTP || !trade.precoEntrada || currentPrice <= 0) return false;
    const midWay = trade.precoEntrada + (trade.targetTP - trade.precoEntrada) * 0.5;
    return isLong ? currentPrice >= midWay : currentPrice <= midWay;
  })();

  return (
    <div className="saas-card p-6 bg-slate-900/40 border-2 border-slate-800/50 hover:border-brand-500/30 transition-all flex flex-col gap-4 relative overflow-hidden">
      {/* Glow */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[80px] rounded-full transition-all duration-1000 ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/5'}`} />

      {/* ── HEADER: Par + PnL ── */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${isLong ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-500 border border-red-500/40'}`}>
            {trade.par.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <h4 className="text-xl font-black text-white tracking-tighter">{trade.par}</h4>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isLong ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                {trade.direcao} {lev}X
              </span>
              {trade.timeframe && (
                <span className="text-[8px] font-bold text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded">
                  M{trade.timeframe}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <div>
                <span className="text-slate-600 text-[8px] block uppercase">Entrada</span>
                <span className="text-slate-300 font-bold">${trade.precoEntrada ? trade.precoEntrada.toFixed(4) : '---'}</span>
              </div>
              <div className="w-px h-5 bg-slate-800" />
              <div>
                <span className="text-slate-600 text-[8px] block uppercase flex items-center gap-1">
                  Mark <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse inline-block" />
                </span>
                <span className="text-brand-400 font-bold">${currentPrice > 0 ? currentPrice.toFixed(4) : '---'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black font-mono tracking-tighter ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
            {isProfit ? '+' : ''}{pnlPcnt.toFixed(2)}%
          </div>
          <div className={`text-[10px] font-bold mt-0.5 ${isProfit ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
            {isProfit ? '+' : '-'}${Math.abs(pnlUsdt).toFixed(2)} USDT
          </div>
        </div>
      </div>

      {/* ── TEMPO ── */}
      <div className="flex flex-wrap gap-2 relative z-10">
        <div className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-800 px-2.5 py-1.5 rounded-xl">
          <Clock className="w-3 h-3 text-slate-500" />
          <div>
            <span className="text-[7px] text-slate-600 uppercase font-bold block">Abertura</span>
            <span className="text-[9px] font-mono text-slate-300 font-bold">
              {new Date(trade.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-800 px-2.5 py-1.5 rounded-xl">
          <Timer className="w-3 h-3 text-brand-400" />
          <div>
            <span className="text-[7px] text-slate-600 uppercase font-bold block">Aberta há</span>
            <span className="text-[9px] font-mono text-brand-400 font-bold">{elapsed}</span>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 border px-2.5 py-1.5 rounded-xl ${duration.warn ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/70 border-slate-800'}`}>
          <BarChart3 className={`w-3 h-3 ${duration.warn ? 'text-amber-400' : 'text-slate-500'}`} />
          <div>
            <span className={`text-[7px] uppercase font-bold block ${duration.warn ? 'text-amber-500/70' : 'text-slate-600'}`}>Duração Est.</span>
            <span className={`text-[9px] font-mono font-bold ${duration.warn ? 'text-amber-400' : 'text-slate-300'}`}>{duration.label}</span>
          </div>
        </div>
      </div>

      {/* ── BREAK EVEN ALERT ── */}
      {showBreakEven && (
        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-2xl px-4 py-2.5 animate-pulse relative z-10">
          <span className="text-amber-400 text-[10px] font-black uppercase tracking-wider">🎯 50% do Alvo Atingido — Mover SL para Break Even!</span>
        </div>
      )}

      {/* ── CENÁRIOS P&L ── */}
      <div className="grid grid-cols-3 gap-2 relative z-10">
        <div className={`p-3 rounded-2xl border flex flex-col items-center text-center ${isProfit ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/5 border-red-500/20'}`}>
          <span className={`text-[7px] font-black uppercase mb-1 ${isProfit ? 'text-emerald-500/70' : 'text-red-500/60'}`}>P&L Atual</span>
          <span className={`text-sm font-mono font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{isProfit ? '+' : '-'}${Math.abs(pnlUsdt).toFixed(2)}</span>
          <span className={`text-[8px] font-bold mt-0.5 ${isProfit ? 'text-emerald-500/50' : 'text-red-500/50'}`}>{isProfit ? '+' : ''}{pnlPcnt.toFixed(2)}%</span>
        </div>
        <div className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center text-center">
          <span className="text-[7px] font-black text-emerald-500/60 uppercase mb-1">Máx. Ganho</span>
          <span className="text-sm font-mono font-black text-emerald-400">{maxProfitUsdt > 0 ? `+$${maxProfitUsdt.toFixed(2)}` : '---'}</span>
          <span className="text-[8px] text-slate-500 font-bold mt-0.5">${trade.targetTP ? trade.targetTP.toFixed(3) : '---'}</span>
        </div>
        <div className="p-3 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center text-center">
          <span className="text-[7px] font-black text-red-500/60 uppercase mb-1">Máx. Loss</span>
          <span className="text-sm font-mono font-black text-red-400">{maxLossUsdt > 0 ? `-$${maxLossUsdt.toFixed(2)}` : '---'}</span>
          <span className="text-[8px] text-slate-500 font-bold mt-0.5">${trade.precoStop ? trade.precoStop.toFixed(3) : '---'}</span>
        </div>
      </div>

      {/* ── GRID TP/SL/RR ── */}
      <div className="grid grid-cols-3 gap-2 relative z-10">
        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center text-center">
          <span className="text-[7px] font-bold text-emerald-500/60 uppercase mb-1">Take Profit</span>
          <span className="text-xs font-mono text-emerald-400 font-black">${trade.targetTP ? trade.targetTP.toFixed(4) : '---'}</span>
          <span className="text-[8px] text-slate-500 font-bold mt-0.5">+{distToTP.toFixed(2)}%</span>
        </div>
        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center text-center">
          <span className="text-[7px] font-bold text-red-500/60 uppercase mb-1">Stop Loss</span>
          <span className="text-xs font-mono text-red-400 font-black">${trade.precoStop ? trade.precoStop.toFixed(4) : '---'}</span>
          <span className="text-[8px] text-slate-500 font-bold mt-0.5">-{distToSL.toFixed(2)}%</span>
        </div>
        <div className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center text-center">
          <span className="text-[7px] font-bold text-blue-500/60 uppercase mb-1">Relação RR</span>
          <span className="text-xs font-mono text-blue-400 font-black">1:{trade.rr || '3.0'}</span>
          <span className="text-[8px] text-slate-500 font-bold mt-0.5">SMC Setup</span>
        </div>
      </div>

      {/* ── RELATÓRIO ── */}
      <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 relative z-10">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
          <ShieldCheck className="w-3 h-3 text-blue-500" /> Relatório Tático
        </span>
        <div className="space-y-1">
          {trade.checklist && Object.entries(trade.checklist).filter(([_, v]) => v).slice(0, 3).map(([key]) => (
            <div key={key} className="flex items-center gap-2 text-[9px] text-slate-400">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
              <span>Confluência {key.replace(/([A-Z])/g, ' $1').toLowerCase()} validada.</span>
            </div>
          ))}
          <p className="text-[8px] text-slate-500 italic mt-1.5 opacity-60">
            Setup M{trade.timeframe || 15} — duração estimada: {duration.label}.
          </p>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      <div className="flex gap-2 relative z-10">
        <button onClick={onOpenChart}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
          <ExternalLink className="w-3 h-3" /> Gráfico
        </button>
        <button onClick={() => onClose(pnlUsdt >= 0)}
          className="px-5 py-3 bg-slate-100 hover:bg-white text-slate-900 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">
          Fechar
        </button>
      </div>
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════╗
// ║                  PORTFOLIO VIEW                          ║
// ╚══════════════════════════════════════════════════════════╝
export default function PortfolioView() {
  const { activeTrades, scannedSignals, setSelectedPair, setActiveView, activePrices } = useSignals();

  const totalPnL = activeTrades.reduce((acc, trade) => {
    const priceInfo = scannedSignals.find(p => p.pair === trade.par);
    if (!priceInfo || !trade.precoEntrada) return acc;
    const currentPrice = activePrices[trade.par] || parseFloat(priceInfo.lastPrice);
    const isLong = trade.direcao === 'LONG';
    const diff = isLong ? (currentPrice - trade.precoEntrada) : (trade.precoEntrada - currentPrice);
    return acc + (trade.capitalSimulado || 0) * (diff / trade.precoEntrada) * (trade.alavancagem || 1);
  }, 0);

  return (
    <div className="flex flex-col gap-6 h-full pb-10">

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 text-brand-500" /> Lucro Flutuante
          </span>
          <h3 className={`text-3xl font-black font-mono tracking-tighter ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </h3>
          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mt-1">
            <div className={`h-full ${totalPnL >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: '100%' }} />
          </div>
        </div>
        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-500" /> Posições Abertas
          </span>
          <h3 className="text-3xl font-black text-white">{activeTrades.length}</h3>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Monitorando em tempo real</p>
        </div>
        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-3 h-3 text-brand-400" /> ROI Médio
          </span>
          <h3 className="text-3xl font-black text-brand-400">
            {activeTrades.length > 0 ? (totalPnL / (activeTrades.length * 2)).toFixed(2) : '0.00'}%
          </h3>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Leverage {activeTrades[0]?.alavancagem || 10}x</p>
        </div>
      </div>

      {/* TÍTULO */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
          <LayoutGrid className="w-4 h-4 text-brand-500" /> Posições em Andamento
        </h2>
      </div>

      {/* LISTA DE TRADES */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {activeTrades.length === 0 ? (
          <div className="col-span-full saas-card p-20 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2">
            <ZapOff className="w-12 h-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Nenhuma Operação Aberta</h3>
            <p className="text-xs text-slate-600 mt-2">O scanner continua monitorando o mercado por setups de elite (Score ≥ 11/16).</p>
          </div>
        ) : activeTrades.map(trade => {
          const priceInfo = scannedSignals.find(p => p.pair === trade.par);
          const currentPrice = activePrices[trade.par] || parseFloat(priceInfo?.lastPrice || '0');
          return (
            <TradeCard
              key={trade.id}
              trade={trade}
              currentPrice={currentPrice}
              onOpenChart={() => { setSelectedPair(trade.par); setActiveView('DASHBOARD'); }}
              onClose={async (positive) => {
                if (confirm('Deseja realmente encerrar esta posição?')) {
                  const { closeTrade } = (window as any).signalContextActions || {};
                  if (closeTrade) await closeTrade(trade.id, positive ? 'GREEN' : 'LOSS');
                }
              }}
            />
          );
        })}
      </div>

      {/* DICA */}
      <div className="saas-card p-4 bg-brand-500/5 border-brand-500/10 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h5 className="text-xs font-bold text-white uppercase tracking-tight">Dica do Agente Specialist</h5>
          <p className="text-[10px] text-slate-500 leading-tight">
            Mova o SL para Break Even ao atingir 50% do alvo. Scalp (⚡ M5/M15): feche antes de 6h. Swing (H1+): pode manter overnight com SL protegido.
          </p>
        </div>
      </div>

    </div>
  );
}
