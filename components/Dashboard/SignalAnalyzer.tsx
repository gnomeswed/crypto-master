'use client';

import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@/lib/SignalContext';
import { SMCChecklist } from '@/lib/types';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Zap,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldAlert,
  Clock,
  LayoutDashboard,
  XCircle
} from 'lucide-react';

declare global {
  interface Window {
    TradingView: any;
  }
}

function TradingViewChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (container.current && window.TradingView) {
        new window.TradingView.widget({
          "autosize": true,
          "symbol": `BYBIT:${symbol}USDT.P`,
          "interval": "15",
          "timezone": "America/Sao_Paulo",
          "theme": "dark",
          "style": "1",
          "locale": "br",
          "toolbar_bg": "#f1f3f6",
          "enable_publishing": false,
          "hide_top_toolbar": true,
          "hide_legend": true,
          "save_image": false,
          "container_id": "tv_chart_container",
          "backgroundColor": "rgba(10, 10, 10, 1)",
          "gridColor": "rgba(42, 46, 57, 0.06)"
        });
      }
    };
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [symbol]);

  return (
    <div id="tv_chart_container" ref={container} className="w-full h-[300px] rounded-2xl overflow-hidden border border-slate-800" />
  );
}

const CHECKLIST_GLOSSARY: Record<string, { label: string; desc: string }> = {
  liquidezIdentificada: { label: 'Liquidez (EQL/PDH/PDL)', desc: 'Zonas onde grandes instituições deixam ordens pendentes. PDH é a máxima de ontem e PDL é a mínima.' },
  sweepConfirmado: { label: 'Sweep de Liquidez', desc: 'Acontece quando o preço "fura" a máxima ou mínima e volta rápido.' },
  chochDetectado: { label: 'CHoCH ou BOS', desc: 'Quebra de Estrutura. Confirma que a tendência mudou e a reversão é real.' },
  orderBlockQualidade: { label: 'Order Block', desc: 'Uma zona de forte compra ou venda institucional para entrar no reteste.' },
  contextoMacroAlinhado: { label: 'Contexto Macro', desc: 'Verifica se a tendência maior concorda com a sua entrada.' },
  entradaNaReacao: { label: 'Entrada na Reação', desc: 'Esperamos o preço "bater e voltar" antes de clicar no botão.' },
  rrMinimoTresUm: { label: 'RR 3:1', desc: 'Relação Risco-Retorno. Buscamos ganhar 3x o que arriscamos.' },
  volumeAlinhado: { label: 'Pulse do Momentum', desc: 'Evita entrar quando o preço está "esticado" demais.' }
};

export default function SignalAnalyzer({ externalPair }: { externalPair: string }) {
  const { scannedSignals, activeTrades } = useSignals();
  const [showGlossary, setShowGlossary] = useState(false);
  const [riskSettings, setRiskSettings] = useState({ banca: 1000, risco: 1 });
  const [isExecuting, setIsExecuting] = useState(false);
  
  // Verifica se há um trade ativo para este par
  const currentTrade = activeTrades.find(t => t.par === externalPair);
  const activeSignal = scannedSignals.find(s => s.pair === externalPair);

  const handleExecuteTrade = async () => {
    if (!activeSignal || !activeSignal.setup) return;
    setIsExecuting(true);
    
    try {
      const { executeTrade } = (window as any).signalContextActions || {};
      if (executeTrade) {
        await executeTrade(externalPair, 10, 10); 
      }
    } catch (err) { console.error(err); } 
    finally { setIsExecuting(false); }
  };
  
  const checklist = activeSignal?.checklist || {};
  const reasons = activeSignal?.reasons || [];
  const setup = activeSignal?.setup;
  const session = (activeSignal as any)?.session;
  const bias = activeSignal?.bias ?? 50;
  const currentPrice = parseFloat(activeSignal?.lastPrice || '0');

  // Cálculo de PnL em tempo real
  let pnlUsdt = 0;
  let pnlPcnt = 0;
  if (currentTrade && currentPrice > 0) {
    const isLong = currentTrade.direcao === 'LONG';
    const diff = isLong ? (currentPrice - currentTrade.precoEntrada) : (currentTrade.precoEntrada - currentPrice);
    const movePcnt = diff / currentTrade.precoEntrada;
    pnlPcnt = movePcnt * (currentTrade.alavancagem || 1) * 100;
    pnlUsdt = (currentTrade.capitalSimulado || 0) * movePcnt * (currentTrade.alavancagem || 1);
  }

  const changePcnt = parseFloat(activeSignal?.priceChange24h || '0') * 100;

  return (
    <div className="flex flex-col h-full relative z-10 gap-4">
      
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/60 shadow-xl relative overflow-hidden">
        {session && (
          <div className="absolute top-0 right-0 p-3 flex items-center gap-2 opacity-50">
            <Clock className={`w-3 h-3 ${session.color}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${session.color}`}>{session.name}</span>
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl shadow-lg ${activeSignal?.action === 'Long' ? 'bg-emerald-500/20 text-emerald-400' : activeSignal?.action === 'Short' ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
             {activeSignal?.action === 'Long' ? <ArrowUpCircle className="w-8 h-8" /> : activeSignal?.action === 'Short' ? <ArrowDownCircle className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">{externalPair}/USDT</h2>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${activeSignal?.action === 'Long' ? 'bg-emerald-500 text-white' : activeSignal?.action === 'Short' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {activeSignal?.action || 'BUSCANDO'}
              </span>
              {currentTrade && (
                <span className="bg-brand-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded animate-pulse">POSIÇÃO ATIVA</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
               <span>${currentPrice.toFixed(4)}</span>
               <span className={changePcnt >= 0 ? 'text-emerald-500' : 'text-red-500'}>({changePcnt >= 0 ? '+' : ''}{changePcnt.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 bg-slate-950/40 p-3 px-6 rounded-2xl border border-slate-800/50 min-w-[200px]">
          <div className="flex justify-between w-full text-[9px] font-black uppercase tracking-widest text-slate-600">
            <span>SHORT</span>
            <span>LONG</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full border border-slate-800 relative overflow-visible">
             <div className={`absolute top-0 bottom-0 transition-all duration-1000 ${bias >= 50 ? 'bg-emerald-500 left-1/2' : 'bg-red-500 right-1/2'}`} style={{ width: `${Math.abs(bias - 50)}%` }}></div>
             <div className="absolute top-[-5px] w-2 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10 transition-all duration-1000" style={{ left: `${bias}%` }}></div>
          </div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Probabilidade: {bias}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-4">
           <div className="saas-card p-2 flex flex-col gap-2">
              <TradingViewChart symbol={externalPair} />
           </div>

           <div className="saas-card p-4 flex-1">
            <h3 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Inteligência do Agente Specialist
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar">
              {reasons.length > 0 ? reasons.map((reason, i) => (
                <p key={i} className="text-[10px] text-slate-400 leading-relaxed border-l-2 border-blue-500/30 pl-3 italic">
                  {reason}
                </p>
              )) : <p className="text-[11px] text-slate-600 text-center py-6">Escaneando fluxo institucional...</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          {currentTrade ? (
            <div className="bg-slate-950 rounded-3xl border-2 border-brand-500/30 p-6 flex flex-col gap-6 shadow-saas-glow h-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest px-3 py-1 bg-brand-500/10 rounded-full">Operação Hunter</span>
                <span className="text-[10px] font-mono text-slate-500">{new Date(currentTrade.dataHora).toLocaleTimeString()}</span>
              </div>

              <div className="text-center">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Resultado (Live)</p>
                 <h4 className={`text-4xl font-black font-mono tracking-tighter ${pnlUsdt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {pnlUsdt >= 0 ? '+' : ''}${pnlUsdt.toFixed(2)}
                 </h4>
                 <span className={`text-sm font-black px-2 py-0.5 rounded ${pnlPcnt >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}`}>
                    {pnlPcnt >= 0 ? '+' : ''}{pnlPcnt.toFixed(2)}% ROI
                 </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-slate-900 shadow-inner p-3 rounded-2xl border border-slate-800">
                    <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Entrada</span>
                    <span className="text-xs font-mono text-white font-bold">${currentTrade.precoEntrada.toFixed(4)}</span>
                 </div>
                 <div className="bg-slate-900 shadow-inner p-3 rounded-2xl border border-slate-800">
                    <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">Preço Atual</span>
                    <span className="text-xs font-mono text-brand-400 font-bold">${currentPrice.toFixed(4)}</span>
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500 px-1">
                    <span>Progresso p/ Alvo</span>
                    <span>{Math.min(100, Math.max(0, (pnlPcnt / (currentTrade.rr * 10 / 2)) * 100)).toFixed(0)}%</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-1000 ${pnlUsdt >= 0 ? 'bg-emerald-500' : 'bg-red-500 opacity-30'}`}
                      style={{ width: `${Math.min(100, Math.max(5, (pnlPcnt / (currentTrade.rr * 10 / 2)) * 100))}%` }}
                    />
                 </div>
              </div>

              <div className="mt-auto space-y-2">
                 <button 
                  onClick={async () => {
                    const { closeTrade } = (window as any).signalContextActions || {};
                    if (closeTrade) {
                      await closeTrade(currentTrade.id, pnlUsdt >= 0 ? 'GREEN' : 'LOSS');
                    }
                  }}
                  className="w-full py-4 bg-slate-100 hover:bg-white text-slate-900 font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    Fechar c/ Lucro Real
                 </button>
                 <p className="text-[10px] text-slate-600 text-center font-bold px-4">
                    Monitoramento 24h na nuvem ativo para esta posição.
                 </p>
              </div>
            </div>
          ) : setup ? (
            <div className={`p-5 rounded-3xl border-2 shadow-2xl bg-slate-950 ${activeSignal?.action === 'Long' ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
              <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest block mb-1">Gatilho Hunter</span>
              <h4 className={`text-2xl font-black italic tracking-tighter mb-4 ${activeSignal?.action === 'Long' ? 'text-emerald-500' : 'text-red-500'}`}>
                {activeSignal?.action === 'Long' ? 'BUY / LONG' : 'SELL / SHORT'}
              </h4>

              <div className="space-y-4">
                 <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Recomendação Entrada</span>
                    <span className="text-xl font-mono text-white font-black">${setup.entry.toFixed(4)}</span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/50">
                       <span className="text-[8px] font-bold text-red-500/50 uppercase block">Stop Loss</span>
                       <span className="text-xs font-mono text-red-400 font-bold">${setup.sl.toFixed(4)}</span>
                    </div>
                    <div className="bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/50">
                       <span className="text-[8px] font-bold text-emerald-500/50 uppercase block">Take Profit</span>
                       <span className="text-xs font-mono text-emerald-400 font-bold">${setup.tp.toFixed(4)}</span>
                    </div>
                 </div>

                 <button 
                  onClick={handleExecuteTrade}
                  disabled={isExecuting}
                  className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${activeSignal?.action === 'Long' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'}`}
                >
                  {isExecuting ? 'PROCESSANDO...' : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      EXECUTAR TRADE SIMULADO (R$10)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 border-2 border-dashed border-slate-800 p-6 rounded-3xl flex flex-col items-center justify-center text-center flex-1 h-full min-h-[300px]">
               <ShieldAlert className="w-8 h-8 text-slate-700 mb-2" />
               <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Aguardando Confirmação</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
