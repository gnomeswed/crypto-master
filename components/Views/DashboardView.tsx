'use client';

import MetricCards from '../Dashboard/MetricCards';
import MultiPairScanner from '../Dashboard/MultiPairScanner';
import SignalAnalyzer from '../Dashboard/SignalAnalyzer';
import { useSignals } from '@/lib/SignalContext';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function DashboardView() {
  const { selectedPair, setSelectedPair, countdown, isLoading } = useSignals();
  // Mobile: controla qual painel está visível (scanner ou analyzer)
  const [mobileTab, setMobileTab] = useState<'scanner' | 'analyzer'>('scanner');

  return (
    <div className="flex flex-col gap-4 lg:gap-8 pb-4 lg:pb-10">

      {/* ── Métric Cards ── */}
      <MetricCards />

      {/* ── Mobile Tab Toggle ── */}
      <div className="lg:hidden flex bg-slate-900/60 border border-slate-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setMobileTab('scanner')}
          className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            mobileTab === 'scanner'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          🔍 Sinais ao Vivo
        </button>
        <button
          onClick={() => setMobileTab('analyzer')}
          className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
            mobileTab === 'analyzer'
              ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          📊 Análise {selectedPair && `· ${selectedPair}`}
        </button>
      </div>

      {/* ── Grid: Scanner + Analyzer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 flex-1 min-h-0">

        {/* SCANNER — mobile: visível se mobileTab === 'scanner' | desktop: sempre */}
        <div className={`lg:col-span-4 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-saas-card ${
          mobileTab === 'scanner' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="p-4 lg:p-5 border-b border-slate-800/80 bg-slate-900/80 shrink-0">
            <h2 className="text-sm font-semibold text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                Sinais ao Vivo
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-950/50 px-2 py-0.5 rounded-md border border-slate-800">
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
                00:{countdown.toString().padStart(2, '0')}
              </div>
            </h2>
          </div>
          {/* Altura fixa no mobile para scroll interno */}
          <div className="overflow-y-auto p-2 scrollbar-none" style={{ maxHeight: 'calc(100dvh - 320px)' }}>
            <MultiPairScanner
              onSelectPair={(pair) => {
                setSelectedPair(pair);
                setMobileTab('analyzer'); // auto-switch para análise ao selecionar
              }}
              selectedPair={selectedPair}
            />
          </div>
        </div>

        {/* ANALYZER — mobile: visível se mobileTab === 'analyzer' | desktop: sempre */}
        <div className={`lg:col-span-8 flex flex-col gap-4 lg:gap-8 ${
          mobileTab === 'analyzer' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="saas-card flex-1 p-4 lg:p-6 relative min-h-[500px] lg:min-h-0">
            <SignalAnalyzer externalPair={selectedPair} />
          </div>

          {/* Fases do mercado — escondido em mobile para economizar espaço */}
          <div className="hidden lg:grid grid-cols-3 gap-4 h-32">
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
