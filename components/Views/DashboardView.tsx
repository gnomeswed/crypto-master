'use client';

import MetricCards from '../Dashboard/MetricCards';
import MultiPairScanner from '../Dashboard/MultiPairScanner';
import SignalAnalyzer from '../Dashboard/SignalAnalyzer';
import { useSignals } from '@/lib/SignalContext';
import { RefreshCw } from 'lucide-react';

export default function DashboardView() {
  const { selectedPair, setSelectedPair, countdown, isLoading } = useSignals();

  return (
    <div className="flex flex-col gap-8 h-full pb-10">
      <MetricCards />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        
        {/* Coluna Esquerda: Sinais (Auto-Scanner) */}
        <div className="lg:col-span-4 flex flex-col h-full bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-saas-card">
          <div className="p-5 border-b border-slate-800/80 bg-slate-900/80">
            <h2 className="text-sm font-semibold text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                Sinais ao Vivo
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-950/50 px-2 py-0.5 rounded-md border border-slate-800">
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
                00:{countdown.toString().padStart(2, '0')}
              </div>
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
            <MultiPairScanner onSelectPair={setSelectedPair} selectedPair={selectedPair} />
          </div>
        </div>

        {/* Coluna Direita: Análise Profunda & Tracker */}
        <div className="lg:col-span-8 flex flex-col gap-8 h-full">
          <div className="saas-card flex-1 p-6 relative">
            <SignalAnalyzer externalPair={selectedPair} />
          </div>
          
          {/* Ciclo de Mercado Visual */}
          <div className="grid grid-cols-3 gap-4 h-32">
            <div className="saas-card flex flex-col justify-center items-center p-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Acumulação</span>
              <span className="text-sm text-emerald-400 font-medium tracking-tight">Fase 1: Consolidado</span>
            </div>
            <div className="saas-card flex flex-col justify-center items-center p-4 border-dashed border-slate-800 bg-transparent">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Manipulação</span>
              <span className="text-sm text-amber-500">Fase 2: O Sweep</span>
            </div>
            <div className="saas-card flex flex-col justify-center items-center p-4 opacity-30">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Distribuição</span>
              <span className="text-sm text-slate-400">Fase 3: O CHoCH</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
