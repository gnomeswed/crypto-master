'use client';

import { useSignals } from '@/lib/SignalContext';
import { loadSignals } from '@/lib/storage';
import {
  TrendingUp, CheckCircle2, XCircle, Activity, Zap, Target,
  ChevronDown, ChevronUp, X, ArrowUpCircle, ArrowDownCircle, Clock
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Signal } from '@/lib/types';

// ─── Drawer Modal (Reutilizável) ──────────────────────────
function Drawer({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="relative ml-auto w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Linha de histórico ────────────────────────────────────
function HistoryRow({ signal, onSelect }: { signal: Signal; onSelect: (pair: string) => void }) {
  const isWin  = signal.resultado === 'GREEN';
  const isOpen = signal.resultado === 'ABERTO';
  return (
    <div
      onClick={() => !isOpen && onSelect(signal.par)}
      className="flex items-center justify-between p-3 rounded-xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40 transition-all cursor-pointer group"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">{signal.par}/USDT</span>
          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${signal.direcao === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {signal.direcao}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
          <Clock className="w-2.5 h-2.5" />
          {new Date(signal.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          {signal.pontuacao && <span className="text-slate-600">• Score: {signal.pontuacao}/16</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${isWin ? 'bg-emerald-500 text-white' : isOpen ? 'bg-slate-700 text-slate-400 animate-pulse' : 'bg-red-500/90 text-white'}`}>
          {signal.resultado}
        </span>
        {signal.lucroFinalUsdt != null && (
          <span className={`text-[9px] font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
            {isWin ? '+' : ''}${signal.lucroFinalUsdt.toFixed(2)}
          </span>
        )}
        {signal.precoEntrada && (
          <span className="text-[8px] font-mono text-slate-600">${parseFloat(String(signal.precoEntrada)).toFixed(4)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Signal Card (no drawer) ──────────────────────────────
function SignalCard({ signal, onSelect }: { signal: any; onSelect: (pair: string) => void }) {
  const isLong  = signal.action === 'Long';
  const isShort = signal.action === 'Short';
  const isScalp = signal.timeframe === 'M5' || signal.timeframe === '5' || signal.timeframe === '15' || signal.timeframe === 'M15';
  const scoreColor = signal.score >= 11 ? 'text-brand-400' : signal.score >= 9 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <button
      onClick={() => onSelect(signal.pair)}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left hover:scale-[1.01] active:scale-[0.99] ${isLong ? 'border-emerald-500/30 bg-emerald-500/5' : isShort ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-900/40'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${isLong ? 'bg-emerald-500/20' : isShort ? 'bg-red-500/20' : 'bg-slate-800'}`}>
          {isLong ? <ArrowUpCircle className="w-5 h-5 text-emerald-400" /> : isShort ? <ArrowDownCircle className="w-5 h-5 text-red-400" /> : <Activity className="w-5 h-5 text-slate-500" />}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold text-white">{signal.pair}/USDT</span>
            {isScalp && <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">⚡ Scalp</span>}
          </div>
          <div className="text-[9px] text-slate-500 font-medium">
            TF: M{signal.timeframe || '15'} • {signal.htfBias || 'NEUTRAL'} H4 Bias
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isLong ? 'bg-emerald-500 text-white' : isShort ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
          {signal.action}
        </span>
        <span className={`text-xs font-black font-mono ${scoreColor}`}>
          {signal.score}<span className="text-[8px] text-slate-600">/16</span>
        </span>
      </div>
    </button>
  );
}

// ╔══════════════════════════════════════════════════════════╗
// ║                    METRIC CARDS                          ║
// ╚══════════════════════════════════════════════════════════╝
export default function MetricCards() {
  const { scannedSignals, setSelectedPair, setActiveView } = useSignals();
  const [histSignals, setHistSignals] = useState<Signal[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<'assertividade' | 'master' | 'elite' | 'radar' | null>(null);

  useEffect(() => {
    setHistSignals(loadSignals());
  }, [scannedSignals]);

  const green    = histSignals.filter(s => s.resultado === 'GREEN').length;
  const loss     = histSignals.filter(s => s.resultado === 'LOSS').length;
  const aberto   = histSignals.filter(s => s.resultado === 'ABERTO').length;
  const total    = green + loss;
  const winRate  = total > 0 ? Math.round((green / total) * 100) : 0;

  const masterSignals = scannedSignals.filter(s => s.score >= 11 && (s.action === 'Long' || s.action === 'Short'));
  const eliteSignals  = scannedSignals.filter(s => s.score >= 9  && s.score < 11 && (s.action === 'Long' || s.action === 'Short'));
  const radarSignals  = scannedSignals.filter(s => s.score >= 5  && s.score < 9);

  // Ordena: scalp primeiro (M5/M15), depois por score
  const sortByScalpFirst = (sigs: any[]) =>
    [...sigs].sort((a, b) => {
      const aScalp = ['5','15','M5','M15'].includes(a.timeframe) ? 1 : 0;
      const bScalp = ['5','15','M5','M15'].includes(b.timeframe) ? 1 : 0;
      if (aScalp !== bScalp) return bScalp - aScalp;
      return b.score - a.score;
    });

  const handleSelectSignal = (pair: string) => {
    setSelectedPair(pair);
    setActiveView('DASHBOARD');
    setActiveDrawer(null);
  };

  const handleSelectHistory = (pair: string) => {
    setSelectedPair(pair);
    setActiveView('DASHBOARD');
    setActiveDrawer(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* CARD 1: ASSERTIVIDADE */}
        <button
          onClick={() => setActiveDrawer('assertividade')}
          className="saas-card p-5 text-left group hover:border-emerald-500/30 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assertividade</span>
            <Target className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-3xl font-black text-white tracking-tighter">{winRate}</span>
            <span className="text-base font-black text-emerald-500 mb-0.5">%</span>
          </div>
          <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500"><CheckCircle2 className="w-3 h-3" />{green} wins</span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-500"><XCircle className="w-3 h-3" />{loss} loss</span>
            {aberto > 0 && <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">{aberto} aberto</span>}
          </div>
          <span className="text-[8px] text-slate-600 mt-2 block">Clique para ver histórico →</span>
        </button>

        {/* CARD 2: MASTER SIGNAL */}
        <button
          onClick={() => setActiveDrawer('master')}
          className="saas-card p-5 text-left border-brand-500/20 bg-brand-500/5 group hover:bg-brand-500/10 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">🏆 Master Signal</span>
            <Zap className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{masterSignals.length}</span>
            <span className="text-[9px] font-black text-brand-500/60 mb-1 uppercase">Prontos</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Score ≥ 11/16 — OB Extremo + RSI/DIV + Eugenio Method</p>
          <span className="text-[8px] text-brand-500/60 mt-2 block">Clique para ver sinais →</span>
        </button>

        {/* CARD 3: ELITE SETUP */}
        <button
          onClick={() => setActiveDrawer('elite')}
          className="saas-card p-5 text-left border-emerald-500/20 bg-emerald-500/5 group hover:bg-emerald-500/10 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">💎 Elite Setup</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{eliteSignals.length}</span>
            <span className="text-[9px] font-black text-emerald-500/60 mb-1 uppercase">Sinais</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Long/Short confirmado (Score 9-10/16)</p>
          <span className="text-[8px] text-emerald-500/60 mt-2 block">Clique para ver sinais →</span>
        </button>

        {/* CARD 4: EM RADAR */}
        <button
          onClick={() => setActiveDrawer('radar')}
          className="saas-card p-5 text-left group hover:border-slate-700 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">📡 Em Radar</span>
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{radarSignals.length}</span>
            <span className="text-[9px] font-black text-slate-500/60 mb-1 uppercase">Pares</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Aguardando CHoCH ou Sweep (Score 5-8)</p>
          <span className="text-[8px] text-slate-600 mt-2 block">Clique para ver pares →</span>
        </button>
      </div>

      {/* ════════ DRAWERS ════════ */}

      {/* DRAWER: Histórico (Assertividade) */}
      <Drawer title={`📊 Histórico de Operações — ${total} registros`} open={activeDrawer === 'assertividade'} onClose={() => setActiveDrawer(null)}>
        <div className="flex items-center gap-4 mb-5 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-center flex-1">
            <p className="text-[8px] uppercase text-slate-500 mb-0.5">Win Rate</p>
            <p className="text-2xl font-black text-white">{winRate}%</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[8px] uppercase text-emerald-500 mb-0.5">Wins</p>
            <p className="text-2xl font-black text-emerald-400">{green}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[8px] uppercase text-red-500 mb-0.5">Losses</p>
            <p className="text-2xl font-black text-red-400">{loss}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-[8px] uppercase text-slate-500 mb-0.5">Abertos</p>
            <p className="text-2xl font-black text-slate-400">{aberto}</p>
          </div>
        </div>

        {histSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-xs py-10">Nenhuma operação registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {/* Losses primeiro (mais recentes) */}
            {[...histSignals].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()).map((s, i) => (
              <HistoryRow key={s.id || i} signal={s} onSelect={handleSelectHistory} />
            ))}
          </div>
        )}
      </Drawer>

      {/* DRAWER: Master Signals */}
      <Drawer title={`🏆 Master Signals — ${masterSignals.length} disponíveis`} open={activeDrawer === 'master'} onClose={() => setActiveDrawer(null)}>
        {masterSignals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm mb-1">Nenhum Master Signal ativo agora.</p>
            <p className="text-slate-600 text-xs">O scanner atualiza a cada 30 segundos.</p>
          </div>
        ) : (
          <>
            {/* ⚡ Scalp (M5/M15) primeiro */}
            {sortByScalpFirst(masterSignals).some(s => ['5','15','M5','M15'].includes(s.timeframe)) && (
              <div className="mb-4">
                <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span>⚡</span> Scalp (M5/M15) — Operações Curtas
                </h4>
                <div className="space-y-2">
                  {sortByScalpFirst(masterSignals).filter(s => ['5','15','M5','M15'].includes(s.timeframe)).map(s => (
                    <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
                  ))}
                </div>
              </div>
            )}
            {/* 📊 Swing (≥ H1) */}
            {sortByScalpFirst(masterSignals).some(s => !['5','15','M5','M15'].includes(s.timeframe)) && (
              <div>
                <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span>📊</span> Swing — Operações Mais Longas
                </h4>
                <div className="space-y-2">
                  {sortByScalpFirst(masterSignals).filter(s => !['5','15','M5','M15'].includes(s.timeframe)).map(s => (
                    <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* DRAWER: Elite Signals */}
      <Drawer title={`💎 Elite Setups — ${eliteSignals.length} disponíveis`} open={activeDrawer === 'elite'} onClose={() => setActiveDrawer(null)}>
        {eliteSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Nenhum Elite Setup ativo agora.</p>
        ) : (
          <div className="space-y-2">
            {sortByScalpFirst(eliteSignals).map(s => (
              <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
            ))}
          </div>
        )}
      </Drawer>

      {/* DRAWER: Radar */}
      <Drawer title={`📡 Em Radar — ${radarSignals.length} pares`} open={activeDrawer === 'radar'} onClose={() => setActiveDrawer(null)}>
        <p className="text-[10px] text-slate-500 mb-4">Estes pares estão formando estrutura mas ainda faltam confirmações para se tornarem sinais de entrada.</p>
        {radarSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Nenhum par em formação agora.</p>
        ) : (
          <div className="space-y-2">
            {radarSignals.sort((a,b) => b.score - a.score).map(s => (
              <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
