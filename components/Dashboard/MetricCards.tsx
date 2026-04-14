'use client';

import { useSignals } from '@/lib/SignalContext';
import { loadSignals } from '@/lib/storage';
import { TrendingUp, CheckCircle2, XCircle, Activity, Zap, Target, Percent } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MetricCards() {
  const { scannedSignals } = useSignals();
  const [stats, setStats] = useState({ winRate: 0, green: 0, loss: 0, aberto: 0 });

  useEffect(() => {
    const signals = loadSignals();
    const green = signals.filter(s => s.resultado === 'GREEN').length;
    const loss  = signals.filter(s => s.resultado === 'LOSS').length;
    const aberto = signals.filter(s => s.resultado === 'ABERTO').length;
    const finalized = green + loss;
    setStats({ winRate: finalized > 0 ? Math.round((green / finalized) * 100) : 0, green, loss, aberto });
  }, [scannedSignals]);

  // Eugenio Method thresholds: MAX = 16 pontos
  // MASTER  ≥ 11 (com Master Signal condition)
  // ELITE   ≥  9 (Long/Short confirmado)
  // Radar   ≥  5
  const masterSetups = scannedSignals.filter(s => s.score >= 11 && (s.action === 'Long' || s.action === 'Short')).length;
  const eliteSetups  = scannedSignals.filter(s => s.score >= 9  && s.score < 11).length;
  const onRadar      = scannedSignals.filter(s => s.score >= 5  && s.score < 9).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

      {/* CARD 1: WIN RATE HISTÓRICO */}
      <div className="saas-card p-5 group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assertividade</span>
          <Target className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="flex items-end gap-1.5 mb-3">
          <span className="text-3xl font-black text-white tracking-tighter">{stats.winRate}</span>
          <span className="text-base font-black text-emerald-500 mb-0.5">%</span>
        </div>
        <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000 rounded-full" style={{ width: `${stats.winRate}%` }} />
        </div>
        <div className="flex gap-3 mt-3">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-500">{stats.green} wins</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            <span className="text-[9px] font-bold text-red-500">{stats.loss} loss</span>
          </div>
        </div>
      </div>

      {/* CARD 2: MASTER SETUPS (≥11/16) */}
      <div className="saas-card p-5 border-brand-500/20 bg-brand-500/5 group hover:bg-brand-500/10 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">🏆 Master Signal</span>
          <Zap className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
        </div>
        <div className="flex items-end gap-1.5 mb-1">
          <span className="text-3xl font-black text-white tracking-tighter">{masterSetups}</span>
          <span className="text-[9px] font-black text-brand-500/60 mb-1 uppercase">Prontos</span>
        </div>
        <p className="text-[8px] text-slate-500 font-medium leading-relaxed">
          Eugenio Method: OB Extremo + RSI/DIV + Approach (Score ≥ 11/16)
        </p>
      </div>

      {/* CARD 3: ELITE SETUPS (9-10) */}
      <div className="saas-card p-5 border-emerald-500/20 bg-emerald-500/5 group hover:bg-emerald-500/10 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">💎 Elite Setup</span>
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
        </div>
        <div className="flex items-end gap-1.5 mb-1">
          <span className="text-3xl font-black text-white tracking-tighter">{eliteSetups}</span>
          <span className="text-[9px] font-black text-emerald-500/60 mb-1 uppercase">Sinais</span>
        </div>
        <p className="text-[8px] text-slate-500 font-medium leading-relaxed">
          Long/Short confirmado com alto índice de confluência (Score 9-10)
        </p>
      </div>

      {/* CARD 4: EM RADAR (5-8) */}
      <div className="saas-card p-5 group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">📡 Em Radar</span>
          <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex items-end gap-1.5 mb-1">
          <span className="text-3xl font-black text-white tracking-tighter">{onRadar}</span>
          <span className="text-[9px] font-black text-slate-500/60 mb-1 uppercase">Pares</span>
        </div>
        <p className="text-[8px] text-slate-500 font-medium leading-relaxed">
          Aguardando CHoCH ou Sweep para upgrade de sinal (Score 5-8)
        </p>
      </div>

    </div>
  );
}
