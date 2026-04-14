'use client';

import { useState, useEffect } from 'react';
import { useSignals } from '@/lib/SignalContext';
import { Search, Star, PinOff, Target, Zap, BarChart3 } from 'lucide-react';

const getIndicatorColor = (state: number) => {
  if (state === 2) return 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_6px_rgba(16,185,129,0.4)]';
  if (state === 1) return 'bg-amber-500 border-amber-400 text-white shadow-[0_0_6px_rgba(245,158,11,0.4)]';
  if (state === 0) return 'bg-blue-600/20 border-blue-500/30 text-blue-400';
  return 'bg-slate-900 border-slate-800 text-slate-700';
};

const SCALP_TFS = ['5', '15', 'M5', 'M15'];

type Tab = 'scalp' | 'swing' | 'all';

export default function MultiPairScanner({
  onSelectPair,
  selectedPair,
}: {
  onSelectPair: (p: string) => void;
  selectedPair: string;
}) {
  const { scannedSignals, activeTrades, isLoading } = useSignals();
  const [searchTerm, setSearchTerm]   = useState('');
  const [pinnedPairs, setPinnedPairs] = useState<string[]>([]);
  const [activeTab, setActiveTab]     = useState<Tab>('scalp');

  useEffect(() => {
    const saved = localStorage.getItem('pinned_pairs');
    if (saved) setPinnedPairs(JSON.parse(saved));
  }, []);

  const togglePin = (e: React.MouseEvent, pair: string) => {
    e.stopPropagation();
    const next = pinnedPairs.includes(pair)
      ? pinnedPairs.filter(p => p !== pair)
      : [...pinnedPairs, pair];
    setPinnedPairs(next);
    localStorage.setItem('pinned_pairs', JSON.stringify(next));
  };

  // Filtra pelo termo de busca
  const searched = scannedSignals.filter(s =>
    s.pair.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtra por aba
  const tabFiltered = searched.filter(s => {
    const isScalp = SCALP_TFS.includes(String(s.timeframe));
    if (activeTab === 'scalp') return isScalp;
    if (activeTab === 'swing') return !isScalp;
    return true;
  });

  // Ordena: pinados > por score
  const sorted = [...tabFiltered].sort((a, b) => {
    const aPin = pinnedPairs.includes(a.pair) ? 1 : 0;
    const bPin = pinnedPairs.includes(b.pair) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return b.score - a.score;
  });

  // Contagens para badges das abas
  const scalpCount = searched.filter(s => SCALP_TFS.includes(String(s.timeframe))).length;
  const swingCount = searched.filter(s => !SCALP_TFS.includes(String(s.timeframe))).length;

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: 'scalp', label: 'Scalp', icon: '⚡', count: scalpCount },
    { key: 'swing', label: 'Swing', icon: '📊', count: swingCount },
    { key: 'all',   label: 'Todos', icon: '⊛',  count: searched.length },
  ];

  return (
    <div className="flex flex-col gap-2 h-full">

      {/* BUSCA */}
      <div className="relative group px-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-brand-400" />
        <input
          type="text"
          placeholder="Buscar par (BTC, SOL...)"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-brand-500/50 transition-all font-medium"
        />
      </div>

      {/* ABAS: Scalp / Swing / Todos */}
      <div className="flex gap-1 px-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key
                ? tab.key === 'scalp'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : tab.key === 'swing'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-700 text-white border border-slate-600'
                : 'text-slate-600 hover:text-slate-400 border border-transparent'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span className={`px-1 rounded text-[7px] font-black ${
              activeTab === tab.key ? 'bg-white/20' : 'bg-slate-800 text-slate-500'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Legenda das Abas */}
      <div className="px-2">
        {activeTab === 'scalp' && (
          <p className="text-[8px] text-amber-500/60 font-medium">M5/M15 — Opera no mesmo dia, feche antes da noite ⚡</p>
        )}
        {activeTab === 'swing' && (
          <p className="text-[8px] text-blue-400/60 font-medium">H1+ — Mantém de horas a dias 📊</p>
        )}
      </div>

      {/* LISTA DE SINAIS */}
      <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar px-1">

        {isLoading && scannedSignals.length === 0 && (
          <div className="p-10 text-center text-slate-500 text-xs animate-pulse font-medium">
            Escaneando Mercado...
          </div>
        )}

        {sorted.map((pd) => {
          const isSelected    = selectedPair === pd.pair;
          const isPinned      = pinnedPairs.includes(pd.pair);
          const hasActiveTrade = activeTrades.some(t => t.par === pd.pair);
          const isScalp       = SCALP_TFS.includes(String(pd.timeframe));

          const isLong  = pd.action === 'Long';
          const isShort = pd.action === 'Short';

          const actionClass = isLong
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : isShort
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-slate-400 bg-slate-800/50 border-slate-700/50';

          const MAX = 16;
          const scoreColor = pd.score >= 11 ? 'text-brand-400'
            : pd.score >= 9 ? 'text-emerald-400'
            : pd.score >= 5 ? 'text-amber-400'
            : 'text-slate-500';

          const { indicators } = pd;

          return (
            <button
              key={pd.pair}
              onClick={() => onSelectPair(pd.pair)}
              className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all text-left group relative ${
                isSelected
                  ? 'bg-slate-800/80 border-slate-700 shadow-lg'
                  : 'bg-transparent border-transparent hover:bg-slate-800/30'
              }`}
            >
              {/* Esquerda: Par + indicadores */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-100 text-[13px] leading-none">{pd.pair}</span>
                  {isPinned && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />}
                  {isScalp && (
                    <span className="text-[6px] font-black px-1 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full uppercase tracking-tight">⚡</span>
                  )}
                  {hasActiveTrade && (
                    <div className="flex items-center gap-0.5">
                      <Target className="w-2.5 h-2.5 text-brand-500 animate-pulse" />
                      <span className="text-[6px] font-black text-brand-400 uppercase">Live</span>
                    </div>
                  )}
                </div>

                {/* Indicadores L/S/B/O */}
                <div className="flex items-center gap-0.5 mt-0.5">
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black border ${getIndicatorColor(indicators?.L)}`}>L</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black border ${getIndicatorColor(indicators?.S)}`}>S</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black border ${getIndicatorColor(indicators?.B)}`}>B</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-black border ${getIndicatorColor(indicators?.O)}`}>O</span>
                </div>
              </div>

              {/* Direita: Action + Score + Pin */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`px-1.5 py-0.5 border rounded text-[7px] uppercase font-black tracking-widest ${actionClass}`}>
                    {pd.action}
                  </span>
                  <span className={`text-[11px] font-mono font-black ${scoreColor}`}>
                    {pd.score}<span className="text-[8px] text-slate-600">/{MAX}</span>
                  </span>
                </div>

                <button
                  onClick={e => togglePin(e, pd.pair)}
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isPinned ? 'text-amber-400 opacity-100' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {isPinned ? <PinOff className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                </button>
              </div>
            </button>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-10">
            <div className="text-slate-600 inline-block p-3 bg-slate-900 rounded-full mb-3">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500">
              {searchTerm ? `Nenhum par encontrado para "${searchTerm}"` : 'Nenhum sinal nesta aba agora'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
