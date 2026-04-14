'use client';

import { useSignals } from '@/lib/SignalContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  BarChart3, 
  Target, 
  CheckCircle2, 
  ExternalLink,
  Zap,
  ShieldCheck,
  ZapOff,
  LayoutGrid,
  Info
} from 'lucide-react';

export default function PortfolioView() {
  const { activeTrades, scannedSignals, setSelectedPair, setActiveView } = useSignals();

  // Calcular métricas totais
  const totalPnL = activeTrades.reduce((acc, trade) => {
    const priceInfo = scannedSignals.find(p => p.pair === trade.par);
    if (!priceInfo || !trade.precoEntrada) return acc;
    
    const currentPrice = parseFloat(priceInfo.lastPrice);
    const isLong = trade.direcao === 'LONG';
    const diff = isLong ? (currentPrice - trade.precoEntrada) : (trade.precoEntrada - currentPrice);
    const movePcnt = diff / trade.precoEntrada;
    return acc + (trade.capitalSimulado || 0) * movePcnt * (trade.alavancagem || 1);
  }, 0);

  const openTradeAnalysis = (pair: string) => {
    setSelectedPair(pair);
    setActiveView('DASHBOARD');
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-10">
      
      {/* HEADER DE MÉTRICAS CONSOLIDADAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 text-brand-500" /> Lucro Flutuante (Total)
          </span>
          <div className="flex items-end gap-2">
            <h3 className={`text-3xl font-black font-mono tracking-tighter ${totalPnL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </h3>
            <span className="text-slate-600 text-[10px] mb-1.5 font-bold uppercase">USDT</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
             <div className={`h-full ${totalPnL >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-500" /> Posições Abertas
          </span>
          <h3 className="text-3xl font-black text-white">{activeTrades.length}</h3>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Monitorando 24/7 na nuvem</p>
        </div>

        <div className="saas-card p-6 bg-slate-900/60 flex flex-col gap-2">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="w-3 h-3 text-brand-400" /> ROI Médio do Portfólio
          </span>
          <h3 className="text-3xl font-black text-brand-400">
            {activeTrades.length > 0 ? (totalPnL / (activeTrades.length * 2)).toFixed(2) : '0.00'}%
          </h3>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Leverage 10x Distribuído</p>
        </div>
      </div>

      {/* LISTA DE TRADES ATIVOS */}
      <div className="flex items-center justify-between mt-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
          <LayoutGrid className="w-4 h-4 text-brand-500" /> Posições em Andamento
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {activeTrades.length === 0 ? (
          <div className="col-span-full saas-card p-20 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2">
             <ZapOff className="w-12 h-12 text-slate-700 mb-4" />
             <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Nenhuma Operação Aberta</h3>
             <p className="text-xs text-slate-600 mt-2">O scanner continua monitorando o mercado por setups nota 8+.</p>
          </div>
        ) : activeTrades.map((trade) => {
          const priceInfo = scannedSignals.find(p => p.pair === trade.par);
          const currentPrice = parseFloat(priceInfo?.lastPrice || '0');
          
          let pnlUsdt = 0;
          let pnlPcnt = 0;
          let distToTP = 0;
          let distToSL = 0;

          if (trade.precoEntrada && currentPrice > 0) {
            const isLong = trade.direcao === 'LONG';
            const diff = isLong ? (currentPrice - trade.precoEntrada) : (trade.precoEntrada - currentPrice);
            const movePcnt = diff / trade.precoEntrada;
            pnlPcnt = movePcnt * (trade.alavancagem || 1) * 100;
            pnlUsdt = (trade.capitalSimulado || 0) * movePcnt * (trade.alavancagem || 1);

            if (trade.targetTP) {
              distToTP = ((Math.abs(currentPrice - trade.targetTP) / currentPrice) * 100);
            }
            if (trade.precoStop) {
              distToSL = ((Math.abs(currentPrice - trade.precoStop) / currentPrice) * 100);
            }
          }

          return (
            <div key={trade.id} className="saas-card p-6 bg-slate-900/40 border-2 border-slate-800/50 hover:border-brand-500/30 transition-all flex flex-col gap-5 relative overflow-hidden group">
               {/* Background Glow */}
               <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[80px] rounded-full transition-all duration-1000 ${pnlUsdt >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/5'}`}></div>
               
               <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-4">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-2xl ${trade.direcao === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-500 border border-red-500/40'}`}>
                        {trade.par.slice(0, 1)}
                     </div>
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <h4 className="text-2xl font-black text-white tracking-tighter">{trade.par}</h4>
                           <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${trade.direcao === 'LONG' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                              {trade.direcao} {trade.alavancagem}X
                           </span>
                           {trade.timeframe && (
                             <span className="text-[9px] font-bold text-slate-500 border border-slate-800 px-1.5 py-0.5 rounded leading-none">
                               {trade.timeframe}
                             </span>
                           )}
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-slate-600 uppercase">Entrada</span>
                              <span className="text-sm font-mono text-slate-300 font-bold">${trade.precoEntrada ? trade.precoEntrada.toFixed(4) : '---'}</span>
                           </div>
                           <div className="w-px h-6 bg-slate-800"></div>
                           <div className="flex flex-col">
                              <span className="text-[8px] font-bold text-slate-600 uppercase">Mark Price</span>
                              <span className="text-sm font-mono text-brand-400 font-bold">${currentPrice > 0 ? currentPrice.toFixed(4) : '---'}</span>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className={`text-3xl font-black font-mono tracking-tighter ${pnlUsdt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pnlUsdt >= 0 ? '+' : ''}{pnlPcnt.toFixed(2)}%
                     </div>
                     <div className="flex items-center justify-end gap-1.5 mt-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${pnlUsdt >= 0 ? 'text-emerald-500/60' : 'text-red-500/60'}`}>
                          {pnlUsdt >= 0 ? 'Lucro' : 'Loss'}: ${Math.abs(pnlUsdt).toFixed(2)}
                        </span>
                     </div>
                  </div>
               </div>

               {/* GRID DE ALVOS (TP / SL / RR) */}
               <div className="grid grid-cols-3 gap-3 relative z-10">
                  <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center text-center">
                     <span className="text-[8px] font-bold text-emerald-500/60 uppercase mb-1">Take Profit</span>
                     <span className="text-xs font-mono text-emerald-400 font-black">${trade.targetTP ? trade.targetTP.toFixed(4) : '---'}</span>
                     <span className="text-[8px] text-slate-500 font-bold mt-1">+{distToTP.toFixed(2)}%</span>
                  </div>
                  <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center text-center">
                     <span className="text-[8px] font-bold text-red-500/60 uppercase mb-1">Stop Loss</span>
                     <span className="text-xs font-mono text-red-400 font-black">${trade.precoStop ? trade.precoStop.toFixed(4) : '---'}</span>
                     <span className="text-[8px] text-slate-500 font-bold mt-1">-{distToSL.toFixed(2)}%</span>
                  </div>
                  <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center text-center">
                     <span className="text-[8px] font-bold text-blue-500/60 uppercase mb-1">Relação RR</span>
                     <span className="text-xs font-mono text-blue-400 font-black">1:{trade.rr || '3.0'}</span>
                     <span className="text-[8px] text-slate-500 font-bold mt-1">SMC Setup</span>
                  </div>
               </div>

               {/* RELATÓRIO DO ESPECIALISTA */}
               <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 relative z-10 flex-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                     <ShieldCheck className="w-3 h-3 text-blue-500" /> Relatório Tático do Agente
                  </span>
                  <div className="space-y-1.5">
                    {trade.checklist && Object.entries(trade.checklist).filter(([_, v]) => v).slice(0, 3).map(([key, _]) => (
                      <div key={key} className="flex items-center gap-2 text-[10px] text-slate-400">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                        <span>Confluência {key.replace(/([A-Z])/g, ' $1').toLowerCase()} validada.</span>
                      </div>
                    ))}
                    <p className="text-[9px] text-slate-500 italic mt-2 leading-relaxed opacity-60">
                      Setup institucional identificado no tempo gráfico M15 com foco em liquidez externa.
                    </p>
                  </div>
               </div>

               <div className="flex items-center gap-3 relative z-10">
                  <button 
                    onClick={() => openTradeAnalysis(trade.par)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                     <ExternalLink className="w-3 h-3" /> Gráfico
                  </button>
                  <button 
                    onClick={async () => {
                      if (confirm('Deseja realmente encerrar esta posição?')) {
                        const { closeTrade } = (window as any).signalContextActions || {};
                        if (closeTrade) await closeTrade(trade.id, pnlUsdt >= 0 ? 'GREEN' : 'LOSS');
                      }
                    }}
                    className="px-6 py-3 bg-slate-100 hover:bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg"
                  >
                     Fechar
                  </button>
               </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER INFO */}
      <div className="saas-card p-4 bg-brand-500/5 border-brand-500/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
             <Info className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-tight">Dica do Agente Specialist</h5>
            <p className="text-[10px] text-slate-500 leading-tight">
              Seu portfólio simula uma banca institucional. Mantenha o ROI consolidado acima de 5% para uma performance de elite.
            </p>
          </div>
      </div>

    </div>
  );
}
