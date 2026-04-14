'use client';

import { useState, useEffect } from 'react';
import { useSignals } from '@/lib/SignalContext';
import { Search, Star, PinOff, Target } from 'lucide-react';

const getIndicatorColor = (state: number) => {
  if (state === 2) return 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  if (state === 1) return 'bg-amber-500 border-amber-400 text-white shadow-[0_0_8px_rgba(245,158,11,0.5)]';
  if (state === 0) return 'bg-blue-600/20 border-blue-500/30 text-blue-400';
  return 'bg-slate-900 border-slate-800 text-slate-700';
};

export default function MultiPairScanner({ onSelectPair, selectedPair }: { onSelectPair: (p: string) => void; selectedPair: string }) {
  const { scannedSignals, activeTrades, isLoading } = useSignals();
  const [searchTerm, setSearchTerm] = useState('');
  const [pinnedPairs, setPinnedPairs] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pinned_pairs');
    if (saved) setPinnedPairs(JSON.parse(saved));
  }, []);

  const togglePin = (e: React.MouseEvent, pair: string) => {
    e.stopPropagation();
    const newPinned = pinnedPairs.includes(pair) 
      ? pinnedPairs.filter(p => p !== pair)
      : [...pinnedPairs, pair];
    setPinnedPairs(newPinned);
    localStorage.setItem('pinned_pairs', JSON.stringify(newPinned));
  };

  const filtered = scannedSignals.filter(s => 
    s.pair.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aPin = pinnedPairs.includes(a.pair) ? 1 : 0;
    const bPin = pinnedPairs.includes(b.pair) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return b.score - a.score;
  });

  return (
    <div className="flex flex-col gap-3 p-2 h-full">
      
      {/* BUSCA */}
      <div className="relative group px-2 mb-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-brand-400" />
        <input 
          type="text" 
          placeholder="Buscar moeda (Ex: SOL, XRP...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-brand-500/50 transition-all font-medium"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar px-1">
        {isLoading && scannedSignals.length === 0 && (
          <div className="p-10 text-center text-slate-500 text-xs animate-pulse font-medium">Escaneando Mercado...</div>
        )}
        
        {sorted.map((pd) => {
          const isSelected = selectedPair === pd.pair;
          const isPinned = pinnedPairs.includes(pd.pair);
          const hasActiveTrade = activeTrades.some(t => t.par === pd.pair);
          
          const colorClass = pd.action === 'Long' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                           : pd.action === 'Short' ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                           : 'text-slate-400 bg-slate-800/50 border-slate-700/50';

          const { indicators } = pd;

          return (
            <button 
              key={pd.pair}
              onClick={() => onSelectPair(pd.pair)}
              className={`flex items-center justify-between w-full p-3.5 rounded-xl border transition-all text-left group relative ${isSelected ? 'bg-slate-800 border-slate-700 shadow-xl' : 'bg-transparent border-transparent hover:bg-slate-800/30'}`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                   <span className="font-bold text-slate-200 text-[14px]">{pd.pair}</span>
                   {isPinned && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                   {hasActiveTrade && (
                     <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-brand-500 animate-pulse" />
                        <span className="text-[7px] font-black text-brand-400 uppercase tracking-tighter">Live</span>
                     </div>
                   )}
                </div>
                
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black border ${getIndicatorColor(indicators?.L)}`}>L</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black border ${getIndicatorColor(indicators?.S)}`}>S</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black border ${getIndicatorColor(indicators?.B)}`}>B</span>
                  <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-black border ${getIndicatorColor(indicators?.O)}`}>O</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                 <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 border rounded text-[8px] uppercase font-black tracking-widest ${colorClass}`}>
                      {pd.action}
                    </span>
                    <span className={`text-[11px] font-mono font-black ${pd.score >= 8 ? 'text-emerald-500' : 'text-slate-500'}`}>
                      {pd.score}<span className="text-[9px] opacity-40">/10</span>
                    </span>
                 </div>
                 
                 <button 
                  onClick={(e) => togglePin(e, pd.pair)}
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                 >
                    {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                 </button>
              </div>
            </button>
          );
        })}

        {sorted.length === 0 && searchTerm && (
          <div className="text-center py-10">
             <div className="text-slate-600 inline-block p-3 bg-slate-900 rounded-full mb-3"><Search className="w-5 h-5" /></div>
             <p className="text-xs text-slate-500">Nenhum par encontrado para "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
