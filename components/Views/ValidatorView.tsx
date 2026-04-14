import React, { useState } from 'react';
import { useSignals } from '@/lib/SignalContext';
import { ClipboardCheck, Search, ShieldCheck, AlertTriangle, ScanLine, TestTube, ChevronRight, Check } from 'lucide-react';
import { analyzePair } from '@/lib/engine';
import { Signal, SMCChecklist } from '@/lib/types';

interface ParsedSignal {
  pair: string;
  action: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tps: number[];
}

export default function ValidatorView() {
  const { addManualSignalToLaboratory, activePrices } = useSignals();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedSignal | null>(null);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [added, setAdded] = useState(false);

  const parseSignal = (text: string) => {
    setAdded(false);
    setEngineResult(null);

    const pairMatch = text.match(/([A-Z0-9]+USDT)/i);
    const actionMatch = text.match(/(LONG|SHORT)/i);
    
    // Pega a primeira entrada de número após "Entrada:" ou similar
    const entryMatch = text.match(/Entrada.*?(\d+\.?\d*)/i);
    const slMatch = text.match(/SL.*?(\d+\.?\d*)/i);

    const tps: number[] = [];
    const tpRegex = /TP\d?.*?(\d+\.?\d*)/gi;
    let match;
    while ((match = tpRegex.exec(text)) !== null) {
      tps.push(parseFloat(match[1]));
    }

    if (pairMatch && actionMatch && entryMatch && slMatch) {
      setParsed({
        pair: pairMatch[1].replace('USDT', '').toUpperCase(),
        action: actionMatch[1].toUpperCase() as 'LONG' | 'SHORT',
        entry: parseFloat(entryMatch[1]),
        sl: parseFloat(slMatch[1]),
        tps,
      });
    } else {
      setParsed(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const txt = e.target.value;
    setRawText(txt);
    parseSignal(txt);
  };

  const runEngineCheck = async () => {
    if (!parsed) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzePair(parsed.pair);
      
      // Calculate risk stats based on parsed signal
      const currentPriceStr = activePrices[parsed.pair] || analysis.setup.entry;
      const currentPrice = currentPriceStr;
      
      const slDist = Math.abs(parsed.entry - parsed.sl);
      const slPct = (slDist / parsed.entry) * 100;
      
      setEngineResult({
        analysis,
        currentPrice,
        slPct
      });
    } catch (err) {
      // Se der erro na Binance, permitimos injeção manual como fallback
      const slDist = Math.abs(parsed.entry - parsed.sl);
      const slPct = (slDist / parsed.entry) * 100;
      setEngineResult({
        analysis: { score: 0, action: 'Evitar', reasons: ["Moeda (Low-Cap) não listada na Binance. A Engine foi desativada, mas você pode usar o laboratório às cegas."] },
        currentPrice: parsed.entry,
        slPct
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitToLab = () => {
    if (!parsed) return;
    
    // default MOCK checklist
    const dummyChecklist: SMCChecklist = {
      liquidezIdentificada: true, sweepConfirmado: true, chochDetectado: true,
      orderBlockQualidade: true, contextoMacroAlinhado: true, volumeAlinhado: true,
      rrMinimoTresUm: true, entradaNaReacao: true, idmDetectado: false, retestadoOB: true
    };

    const targetTP = parsed.tps.length > 0 ? parsed.tps[parsed.tps.length - 1] : (parsed.action === 'LONG' ? parsed.entry * 1.05 : parsed.entry * 0.95);
    const riskAmount = parseFloat(localStorage.getItem("risco_config") ? JSON.parse(localStorage.getItem("risco_config")!).banca || "24" : "24") * 0.05; // Auto 5% test

    addManualSignalToLaboratory({
      par: parsed.pair,
      pontuacao: engineResult?.analysis?.score || 10,
      direcao: parsed.action,
      precoEntrada: parsed.entry,
      precoStop: parsed.sl,
      targetTP: targetTP,
      rr: 3.0, // Fixed approx
      capitalSimulado: riskAmount, // Test
      alavancagem: 5,
      reasons: ["Sinal Rastreio Telegram", ...(engineResult?.analysis?.reasons || [])],
      checklist: dummyChecklist,
      relatorio: engineResult ? `Cross-check Engine: Score ${engineResult.analysis.score}/16. \nOrigem: Validator Hub.` : 'Inserido via Text-Parser do Telegram.'
    });
    setAdded(true);
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <TestTube className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Laboratório de Testes (Validator)</h1>
          <p className="text-xs text-slate-400">Auditoria institucional. Cole o call para decodificar matemática de risco e cruzar com o EugenioStyle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PARSER COLUMN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
          <label className="text-sm font-semibold flex items-center gap-2 text-indigo-300">
            <ClipboardCheck className="w-4 h-4" /> Scanner Telegram/WhatsApp
          </label>
          <textarea
            value={rawText}
            onChange={handleTextChange}
            placeholder={`Cole aqui o sinal...\nEx:\nDOTUSDT | SHORT 🔴\nEntrada: 1.1525 – 1.1549\nTP1: 1.1345\nSL: 1.1729`}
            className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors resize-none placeholder-slate-700"
          />

          {parsed ? (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center justify-between border-b border-emerald-900/30 pb-3 mb-3">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Dados Lidos ✅</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${parsed.action === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {parsed.action} {parsed.pair}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                <div><p className="text-slate-500 mb-1">Entrada</p><p className="font-mono text-slate-200">${parsed.entry}</p></div>
                <div><p className="text-slate-500 mb-1">Stop Loss</p><p className="font-mono text-red-400">${parsed.sl}</p></div>
                <div className="col-span-2">
                  <p className="text-slate-500 mb-1">Take Profits detectados</p>
                  <p className="font-mono text-emerald-400">{parsed.tps.length > 0 ? parsed.tps.join(" | ") : "Nenhum TP customizado"}</p>
                </div>
              </div>

              {!engineResult && (
                <button 
                  onClick={runEngineCheck}
                  disabled={isAnalyzing}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  {isAnalyzing ? <span className="animate-pulse">Sincronizando Binance API...</span> : <><ScanLine className="w-4 h-4"/> Rastreio Cross-Check (Engine)</>}
                </button>
              )}
            </div>
          ) : rawText.length > 10 ? (
             <div className="text-xs flex items-center gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
               <AlertTriangle className="w-4 h-4" /> Não foi possível identificar Moeda, Direção, Entrada e SL. Verifique o formato.
             </div>
          ) : null}
        </div>

        {/* ENGINE RESULT COLUMN */}
        <div className="flex flex-col gap-6">
          {engineResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative animate-in slide-in-from-right duration-300">
              <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Search className="w-4 h-4 text-brand-500"/> Auditoria EugênioStyle
                </span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
                   Live Price: ${parseFloat(engineResult.currentPrice).toFixed(4)}
                </span>
              </div>
              <div className="p-5 space-y-5">
                
                {/* Risk Analysis */}
                <div>
                   <h3 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Matemática de Risco</h3>
                   <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80">
                     <p className="text-sm font-medium text-slate-300 mb-1">
                        Distância SL: <span className="font-mono text-white">{engineResult.slPct.toFixed(2)}%</span>
                     </p>
                     {engineResult.slPct < 3.0 ? (
                        <p className="text-xs text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Perfil Institucional/Scalp (SL Curtíssimo). Alavancagem liberada.</p>
                     ) : engineResult.slPct > 10 ? (
                        <p className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> VOLATILIDADE EXTREMA! SL Longo. Reduza tamanho da mão em 10x.</p>
                     ) : (
                        <p className="text-xs text-amber-400">Perfil Day Trade Padrão. Siga gestão 1%.</p>
                     )}
                   </div>
                </div>

                {/* Engine Agreement */}
                <div>
                  <h3 className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Opinião da Engine (Score: {engineResult.analysis.score})</h3>
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-2">
                     <div className="flex items-center gap-2 text-sm">
                       <span className="text-slate-400">Viés Algorítmico:</span> 
                       <span className={engineResult.analysis.action === 'Aguardar' || engineResult.analysis.action === 'Evitar' ? 'text-slate-500' : engineResult.analysis.action.toUpperCase() === parsed?.action ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {engineResult.analysis.action}
                       </span>
                     </div>
                     <p className="text-xs text-slate-400 leading-relaxed">
                       {engineResult.analysis.action.toUpperCase() === parsed?.action 
                         ? "🔥 A Engine CONCORDA com o sinal. Alta convergência técnica."
                         : engineResult.analysis.action === 'Aguardar' || engineResult.analysis.action === 'Evitar'
                         ? "⚠️ A Engine está NEUTRA. Ela não detectou setups institucionais fortes nessa região ainda."
                         : "🚨 CUIDADO! A Engine aponta pra direção oposta (Divergência ou OB reverso). Siga sua própria gestão!"}
                     </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={submitToLab}
                    disabled={added}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-500 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-colors shadow-lg shadow-emerald-900/20"
                  >
                    {added ? <><Check className="w-5 h-5"/> Rastreamento Ativo</> : <><TestTube className="w-5 h-5"/> Iniciar Simulação (Paper Trade)</>}
                  </button>
                  {!added && <p className="text-[10px] text-slate-500 text-center mt-2">O dashboard medirá os acertos desse sinal no portfólio de forma autônoma.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-600 p-8 text-center min-h-[300px]">
              <Search className="w-10 h-10 mb-4 opacity-50" />
              <p className="text-sm font-medium">Aguardando Validação</p>
              <p className="text-xs mt-2 max-w-[200px]">Cole o sinal no painel e autorize o rastreio para iniciar a auditoria algorítmica.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
