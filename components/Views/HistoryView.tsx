'use client';

import { useEffect, useState } from 'react';
import { loadSignals, deleteSignal } from '@/lib/storage';
import { fetchSignalsFromCloud } from '@/lib/supabase';
import { Signal } from '@/lib/types';
import { Search, Filter, Trash2, ExternalLink, Calendar, Cloud, HardDrive } from 'lucide-react';
import { useSignals } from '@/lib/SignalContext';

export default function HistoryView() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'LOCAL' | 'CLOUD'>('LOCAL');
  const { setSelectedPair, setActiveView } = useSignals();

  const loadData = async () => {
    setIsLoading(true);
    // Tenta carregar do Cloud primeiro
    const cloudData = await fetchSignalsFromCloud();
    if (cloudData && cloudData.length > 0) {
      // Mapeia os dados do Supabase (snake_case) para o formato do App (camelCase)
      const mapped = cloudData.map((s: any) => ({
        id: s.id,
        dataHora: s.data_hora,
        par: s.par,
        pontuacao: s.pontuacao,
        direcao: s.direcao,
        precoEntrada: s.preco_entrada,
        precoStop: s.preco_stop,
        targetTP: s.target_tp,
        rr: s.rr,
        resultado: s.resultado,
        checklist: s.checklist,
        capitalSimulado: s.capital_simulado,
        alavancagem: s.alavancagem,
        lucroFinalUsdt: s.lucro_final_usdt
      }));
      setSignals(mapped);
      setDataSource('CLOUD');
    } else {
      setSignals(loadSignals());
      setDataSource('LOCAL');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir este sinal do histórico local?')) {
      deleteSignal(id);
      setSignals(signals.filter(s => s.id !== id));
    }
  };

  const openAnalysis = (pair: string) => {
    setSelectedPair(pair);
    setActiveView('DASHBOARD');
  };

  return (
    <div className="flex flex-col gap-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Histórico Hunter
            <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${dataSource === 'CLOUD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              {dataSource === 'CLOUD' ? <Cloud className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
              {dataSource} STORAGE
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Sinais de elite (Nota 8+) registrados automaticamente pelo algoritmo e operações manuais.</p>
        </div>
        <button onClick={loadData} className="saas-card px-4 py-2 text-xs font-bold hover:bg-slate-800 transition-all">
          Atualizar Lista
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ativo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entrada</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lucro (ROI)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resultado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500 animate-pulse">Sincronizando com a nuvem...</td></tr>
              ) : signals.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500 italic">Nenhum sinal de elite registrado ainda.</td></tr>
              ) : signals.map((signal) => (
                <tr key={signal.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {new Date(signal.dataHora).toLocaleString('pt-BR')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-white">{signal.par}</span>
                    {signal.alavancagem && <span className="text-[8px] block text-brand-500 font-bold">{signal.alavancagem}x LEV</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase ${signal.direcao === 'LONG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                      {signal.direcao}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-300">
                    ${parseFloat(signal.precoEntrada?.toString() || '0').toFixed(4)}
                  </td>
                  <td className="px-6 py-4">
                    {signal.resultado === 'ABERTO' ? (
                       <span className="text-[10px] font-bold text-slate-600 animate-pulse tracking-widest uppercase">Aguardando...</span>
                    ) : (
                      <span className={`text-xs font-mono font-black ${signal.resultado === 'GREEN' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {signal.resultado === 'GREEN' ? '+' : ''}{signal.lucroFinalUsdt ? `$${signal.lucroFinalUsdt.toFixed(2)}` : (signal.resultado === 'GREEN' ? 'Win' : 'Loss')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase ${
                      signal.resultado === 'GREEN' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                      signal.resultado === 'LOSS' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 
                      'bg-slate-800 text-slate-400 animate-pulse'
                    }`}>
                      {signal.resultado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => openAnalysis(signal.par)}
                        className="text-slate-500 hover:text-white transition-colors p-1"
                        title="Abrir Analisador"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(signal.id)}
                        className="text-slate-700 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
