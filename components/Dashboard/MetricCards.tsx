'use client';

import { useSignals } from '@/lib/SignalContext';
import { loadSignals } from '@/lib/storage';
import { 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Activity,
  Zap,
  Target
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MetricCards() {
  const { scannedSignals } = useSignals();
  const [historyStats, setHistoryStats] = useState({ winRate: 0, total: 0, green: 0, loss: 0 });

  useEffect(() => {
    const signals = loadSignals();
    // Filtramos apenas sinais que foram finalizados (GREEN ou LOSS)
    const finalized = signals.filter(s => s.resultado === 'GREEN' || s.resultado === 'LOSS');
    const greens = signals.filter(s => s.resultado === 'GREEN').length;
    const losses = signals.filter(s => s.resultado === 'LOSS').length;
    
    const wr = finalized.length > 0 ? (greens / finalized.length) * 100 : 0;
    
    setHistoryStats({
      winRate: Math.round(wr),
      total: signals.length,
      green: greens,
      loss: losses
    });
  }, [scannedSignals]); // Atualiza quando o scanner refresca

  // Contagem de Oportunidades Reais (Monitorando Agora)
  const highScores = scannedSignals.filter(s => s.score >= 8).length;
  const pendingSweeps = scannedSignals.filter(s => s.score >= 5 && s.score < 8).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* CARD 1: TAXA DE ACERTO (HISTÓRICA) */}
      <div className="saas-card p-5 group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assertividade Geral</span>
          <Target className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white tracking-tighter">{historyStats.winRate}%</span>
          <span className="text-[10px] text-slate-500 mb-1.5 font-bold uppercase">Histórico</span>
        </div>
        <div className="mt-3 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${historyStats.winRate}%` }} />
        </div>
      </div>

      {/* CARD 2: PLACAR (GREEN / LOSS) */}
      <div className="saas-card p-5 group hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Placar de Operações</span>
          <Activity className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-emerald-500">{historyStats.green}</span>
            <span className="text-[9px] font-bold text-slate-600 uppercase">Greens</span>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-red-500">{historyStats.loss}</span>
            <span className="text-[9px] font-bold text-slate-600 uppercase">Losses</span>
          </div>
        </div>
      </div>

      {/* CARD 3: OPORTUNIDADES ELITE (NOTAS 8-10) */}
      <div className="saas-card p-5 border-emerald-500/20 bg-emerald-500/5 group hover:bg-emerald-500/10 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Setups de Elite</span>
          <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white tracking-tighter">{highScores}</span>
          <span className="text-[10px] text-emerald-500/60 mb-1.5 font-bold uppercase">Prontos</span>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium">Ativos com Nota {'>'} 8 no Hunter Global.</p>
      </div>

      {/* CARD 4: MONITORAMENTO ATIVO (NOTAS 5-7) */}
      <div className="saas-card p-5 group hover:border-brand-500/30 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Em Radar Profissional</span>
          <TrendingUp className="w-4 h-4 text-brand-500" />
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-black text-white tracking-tighter">{pendingSweeps}</span>
          <span className="text-[10px] text-slate-500 mb-1.5 font-bold uppercase">Pares</span>
        </div>
        <p className="text-[9px] text-slate-500 mt-2 font-medium">Aguardando Sweep (Laranja no scanner).</p>
      </div>

    </div>
  );
}
