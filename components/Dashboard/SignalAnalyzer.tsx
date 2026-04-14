'use client';

import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@/lib/SignalContext';
import {
  ShieldCheck, Target, TrendingUp, Zap, ArrowUpCircle, ArrowDownCircle,
  Clock, CheckCircle2, XCircle, ShieldAlert, Activity, BarChart3,
  ArrowRight, AlertTriangle
} from 'lucide-react';

declare global { interface Window { TradingView: any; } }

// ─── TradingView Chart ────────────────────────────────────
function TradingViewChart({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.getElementById('tv_chart_container');
    if (el) el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (container.current && window.TradingView) {
        new window.TradingView.widget({
          autosize: true, symbol: `BYBIT:${symbol}USDT.P`, interval: '15',
          timezone: 'America/Sao_Paulo', theme: 'dark', style: '1', locale: 'br',
          enable_publishing: false, hide_top_toolbar: true, hide_legend: true,
          save_image: false, container_id: 'tv_chart_container',
          backgroundColor: 'rgba(10,10,10,1)', gridColor: 'rgba(42,46,57,0.06)'
        });
      }
    };
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [symbol]);
  return <div id="tv_chart_container" ref={container} className="w-full h-[280px] rounded-2xl overflow-hidden border border-slate-800" />;
}

// ─── RSI Badge ───────────────────────────────────────────
function RSIBadge({ rsi }: { rsi: number }) {
  const color = rsi <= 30 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : rsi >= 70 ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-slate-400 bg-slate-800/50 border-slate-700/50';
  const label = rsi <= 30 ? 'OVERSOLD' : rsi >= 70 ? 'OVERBOUGHT' : 'NEUTRO';
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${color}`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">RSI (14)</span>
      <span className="text-lg font-black mt-0.5 font-mono">{rsi.toFixed(0)}</span>
      <span className="text-[7px] font-black uppercase tracking-widest opacity-70">{label}</span>
    </div>
  );
}

// ─── HTF Bias Badge ──────────────────────────────────────
function HTFBadge({ bias }: { bias?: string }) {
  const color = bias === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : bias === 'BEARISH' ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-slate-400 bg-slate-800/50 border-slate-700/50';
  const label = bias === 'BULLISH' ? '▲ ALTA' : bias === 'BEARISH' ? '▼ BAIXA' : '— NEUTRO';
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${color}`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Viés H4</span>
      <span className="text-sm font-black mt-1">{label}</span>
    </div>
  );
}

// ─── Structure Badge ──────────────────────────────────────
function StructureBadge({ type }: { type?: string }) {
  const color = type === 'IMPULSIVE' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    : type === 'CORRECTIVE' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-slate-400 bg-slate-800/50 border-slate-700/50';
  const label = type === 'IMPULSIVE' ? '⚡ IMPULSO' : type === 'CORRECTIVE' ? '🚩 CORREÇÃO' : '○ NEUTRO';
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${color}`}>
      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Estrutura</span>
      <span className="text-sm font-black mt-1">{label}</span>
    </div>
  );
}

// ─── Checklist Item ──────────────────────────────────────
const GLOSSARY: Record<string, { label: string; desc: string }> = {
  liquidezIdentificada: { label: 'Liquidez (PDH/PDL/EQL)', desc: 'Zonas onde ordens institucionais estão acumuladas — PDH é a máxima de ontem, PDL é a mínima.' },
  sweepConfirmado:      { label: 'Sweep de Liquidez', desc: 'O preço "furou" a máxima/mínima para capturar stops e voltou — sinal de absorção institucional.' },
  chochDetectado:       { label: 'CHoCH / BOS', desc: 'Change of Character: confirmação de que a tendência mudou de direção. Gatilho de entrada.' },
  orderBlockQualidade:  { label: 'Extreme OB ✦ Eugenio', desc: 'OB nos 20% extremos do range (não no meio). Baseado no filtro extremePct=0.20 do PineScript.' },
  contextoMacroAlinhado:{ label: 'Viés H4 Alinhado', desc: 'O tempo gráfico H4 confirma a mesma direção do trade no M15. Sem isso, o risco dobra.' },
  volumeAlinhado:       { label: 'Volume Institucional', desc: 'Confirma pressão de volume real (>100k). Evita entrar em movimentos sem liquidez.' },
  entradaNaReacao:      { label: 'Entrada na Reação', desc: 'Aguarda o preço "bater e voltar" antes de entrar — não caça o movimento, espera a confirmação.' },
  rrMinimoTresUm:       { label: 'RR Mínimo OK', desc: 'Relação Risco:Retorno calculada sobre o TP real (PDH/PDL). Buscamos pelo menos 2:1.' },
  idmDetectado:         { label: 'IDM — Inducement', desc: 'Armadilha do varejo identificada ANTES do Sweep. Alta qualidade institucional — Eugenio Method.' },
  retestadoOB:          { label: 'Reteste do OB', desc: 'Preço voltou ao Order Block para entrada de precisão — ponto ótimo de risco/retorno.' },
};

function ChecklistItem({ label, ok, desc }: { label: string; ok: boolean; desc: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 relative group">
      {ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <XCircle className="w-3 h-3 text-slate-700 shrink-0" />}
      <button onClick={() => setShow(!show)} className={`text-[10px] font-medium text-left leading-none ${ok ? 'text-slate-300' : 'text-slate-600'}`}>
        {label}
      </button>
      {show && (
        <div className="absolute left-0 bottom-full mb-2 z-50 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-[9px] text-slate-400 w-56 shadow-2xl leading-relaxed">
          {desc}
        </div>
      )}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════╗
// ║                SIGNAL ANALYZER PRINCIPAL                 ║
// ╚══════════════════════════════════════════════════════════╝
export default function SignalAnalyzer({ externalPair }: { externalPair: string }) {
  const { scannedSignals, activeTrades } = useSignals();
  const [isExecuting, setIsExecuting] = useState(false);

  const currentTrade = activeTrades.find(t => t.par === externalPair);
  const activeSignal = scannedSignals.find(s => s.pair === externalPair);
  const sig = activeSignal as any;

  // Dados do sinal
  const checklist  = activeSignal?.checklist || {};
  const reasons    = activeSignal?.reasons || [];
  const setup      = activeSignal?.setup;
  const bias       = activeSignal?.bias ?? 50;
  const rsiVal     = activeSignal?.indicators?.rsi ?? 50;
  const currentPrice = parseFloat(activeSignal?.lastPrice || '0');
  const changePcnt   = parseFloat(activeSignal?.priceChange24h || '0') * 100;

  // PnL em tempo real
  let pnlUsdt = 0, pnlPcnt = 0;
  if (currentTrade && currentPrice > 0) {
    const isLong = currentTrade.direcao === 'LONG';
    const diff = isLong ? (currentPrice - currentTrade.precoEntrada) : (currentTrade.precoEntrada - currentPrice);
    const movePcnt = diff / currentTrade.precoEntrada;
    pnlPcnt = movePcnt * (currentTrade.alavancagem || 1) * 100;
    pnlUsdt = (currentTrade.capitalSimulado || 0) * movePcnt * (currentTrade.alavancagem || 1);
  }

  // Score visual
  const MAX_SCORE = 16;
  const scorePct = activeSignal ? Math.min(100, (activeSignal.score / MAX_SCORE) * 100) : 0;
  const scoreColor = scorePct >= 70 ? 'bg-emerald-500' : scorePct >= 45 ? 'bg-amber-500' : 'bg-red-500';

  // Divergências do agente (parseadas dos reasons)
  const hasBullDiv   = reasons.some(r => r.includes('Regular Bullish') || r.includes('Hidden Bullish'));
  const hasBearDiv   = reasons.some(r => r.includes('Regular Bearish') || r.includes('Hidden Bearish'));
  const hasIfvg      = reasons.some(r => r.includes('IFVG'));
  const hasApproach  = reasons.some(r => r.includes('Pré-Alerta'));
  const isMaster     = reasons.some(r => r.includes('MASTER SIGNAL'));
  const isElite      = reasons.some(r => r.includes('GATILHO ELITE'));

  const handleExecuteTrade = async () => {
    if (!activeSignal?.setup) return;
    setIsExecuting(true);
    try {
      const { executeTrade } = (window as any).signalContextActions || {};
      if (executeTrade) await executeTrade(externalPair, 10, 10);
    } catch (err) { console.error(err); }
    finally { setIsExecuting(false); }
  };

  return (
    <div className="flex flex-col h-full gap-4">

      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="saas-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        {/* Sessão */}
        {sig?.session && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-50">
            <Clock className="w-3 h-3" />
            <span className={`text-[9px] font-black uppercase tracking-widest ${sig.session.color}`}>{sig.session.name}</span>
          </div>
        )}

        {/* Par + Ação */}
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl shadow-lg ${activeSignal?.action === 'Long' ? 'bg-emerald-500/20 text-emerald-400' : activeSignal?.action === 'Short' ? 'bg-red-500/20 text-red-500' : 'bg-slate-800 text-slate-500'}`}>
            {activeSignal?.action === 'Long' ? <ArrowUpCircle className="w-7 h-7" /> : activeSignal?.action === 'Short' ? <ArrowDownCircle className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">{externalPair}/USDT</h2>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${activeSignal?.action === 'Long' ? 'bg-emerald-500 text-white' : activeSignal?.action === 'Short' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {activeSignal?.action || 'SCANNING'}
              </span>
              {(activeSignal?.timeframe === 'M5' || activeSignal?.timeframe === 'M15') && (
                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">⚡ Scalp</span>
              )}
              {isMaster && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 animate-pulse">🏆 MASTER</span>}
              {isElite  && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">💎 ELITE</span>}
              {currentTrade && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-brand-500 text-white animate-pulse">ATIVO</span>}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              {currentPrice > 0 ? <><span>${currentPrice.toFixed(4)}</span><span className={changePcnt >= 0 ? 'text-emerald-500' : 'text-red-500'}>({changePcnt >= 0 ? '+' : ''}{changePcnt.toFixed(2)}%)</span></> : <span>Carregando preço...</span>}
            </div>
          </div>
        </div>

        {/* Score Bar */}
        <div className="flex flex-col gap-2 min-w-[180px]">
          <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-600">
            <span>Score SMC</span>
            <span className="text-white">{activeSignal?.score ?? 0}/{MAX_SCORE}</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${scoreColor}`} style={{ width: `${scorePct}%` }} />
          </div>
          {/* Bias Slider */}
          <div className="w-full h-1.5 bg-slate-900 rounded-full border border-slate-800 relative overflow-visible">
            <div className={`absolute top-0 bottom-0 transition-all duration-1000 ${bias >= 50 ? 'bg-emerald-500 left-1/2' : 'bg-red-500 right-1/2'}`} style={{ width: `${Math.abs(bias - 50)}%` }} />
            <div className="absolute top-[-4px] w-2 h-3.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10 transition-all duration-1000" style={{ left: `${bias}%` }} />
          </div>
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter text-center">Probabilidade: {bias}%</span>
        </div>
      </div>

      {/* ── PAINEL HTF + RSI + ESTRUTURA + SINAIS ADICIONAIS ─ */}
      {activeSignal && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <HTFBadge bias={sig?.htfBias} />
          <StructureBadge type={sig?.structureType} />
          <RSIBadge rsi={rsiVal} />
          {/* IDM */}
          <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${(checklist as any)?.idmDetectado ? 'bg-brand-500/10 border-brand-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">IDM</span>
            <span className={`text-sm font-black mt-1 ${(checklist as any)?.idmDetectado ? 'text-brand-400' : 'text-slate-600'}`}>
              {(checklist as any)?.idmDetectado ? '🎯 ON' : '○ OFF'}
            </span>
          </div>
          {/* IFVG */}
          <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${hasIfvg ? 'bg-sky-500/10 border-sky-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">IFVG</span>
            <span className={`text-sm font-black mt-1 ${hasIfvg ? 'text-sky-400' : 'text-slate-600'}`}>
              {hasIfvg ? '⚡ ON' : '○ OFF'}
            </span>
          </div>
          {/* DIV */}
          <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center ${(hasBullDiv || hasBearDiv) ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">RSI Div</span>
            <span className={`text-sm font-black mt-1 ${hasBullDiv ? 'text-emerald-400' : hasBearDiv ? 'text-red-400' : 'text-slate-600'}`}>
              {hasBullDiv ? '📈 BULL' : hasBearDiv ? '📉 BEAR' : '○ N/A'}
            </span>
          </div>
        </div>
      )}

      {/* ── CORPO PRINCIPAL: GRÁFICO + SIDEBAR ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">

        {/* ESQUERDA: Gráfico + Agente */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="saas-card p-2">
            <TradingViewChart symbol={externalPair} />
          </div>

          {/* Relatório do Agente */}
          <div className="saas-card p-4 flex-1">
            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Relatório do Agente — Eugenio Method
            </h3>
            <div className="space-y-1.5 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
              {reasons.length > 0 ? reasons.map((r, i) => (
                <p key={i} className="text-[10px] text-slate-400 leading-relaxed border-l-2 border-blue-500/30 pl-3">
                  {r}
                </p>
              )) : <p className="text-[10px] text-slate-600 text-center py-6 italic">Escaneando fluxo institucional...</p>}
            </div>
          </div>

          {/* Checklist Compacto */}
          {activeSignal && (
            <div className="saas-card p-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3" /> Checklist SMC (10 critérios)
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                {Object.entries(GLOSSARY).map(([key, meta]) => (
                  <ChecklistItem key={key} label={meta.label} ok={!!(checklist as any)[key]} desc={meta.desc} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DIREITA: Painel de Trade */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {currentTrade ? (
            // ── POSIÇÃO ATIVA ──────────────────────────
            <div className="bg-slate-950 rounded-3xl border-2 border-brand-500/30 p-5 flex flex-col gap-4 shadow-saas-glow h-full">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-brand-400 uppercase tracking-widest px-3 py-1 bg-brand-500/10 rounded-full">Operação Ativa</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-500">LIVE</span>
                </div>
              </div>

              {/* PnL */}
              <div className="text-center bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Resultado Atual</p>
                <div className={`text-4xl font-black font-mono tracking-tighter ${pnlUsdt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {pnlUsdt >= 0 ? '+' : ''}${pnlUsdt.toFixed(2)}
                </div>
                <span className={`text-xs font-black px-3 py-0.5 rounded-full mt-1 inline-block ${pnlPcnt >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-500'}`}>
                  {pnlPcnt >= 0 ? '+' : ''}{pnlPcnt.toFixed(2)}% ROI
                </span>
              </div>

              {/* Entrada / Atual */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[8px] font-bold text-slate-600 uppercase block mb-0.5">Entrada</span>
                  <span className="text-xs font-mono text-white font-bold">${currentTrade.precoEntrada.toFixed(4)}</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[8px] font-bold text-slate-600 uppercase block mb-0.5">Mark Price</span>
                  <span className="text-xs font-mono text-brand-400 font-bold">${currentPrice.toFixed(4)}</span>
                </div>
              </div>

              {/* Progresso */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[8px] uppercase font-bold text-slate-600 px-0.5">
                  <span>Progresso p/ TP</span>
                  <span>{Math.min(100, Math.max(0, (pnlPcnt / (currentTrade.rr * 10 / 2)) * 100)).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full transition-all duration-1000 ${pnlUsdt >= 0 ? 'bg-emerald-500' : 'bg-red-500 opacity-30'}`}
                    style={{ width: `${Math.min(100, Math.max(3, (pnlPcnt / (currentTrade.rr * 10 / 2)) * 100))}%` }} />
                </div>
              </div>

              <button
                onClick={async () => {
                  const { closeTrade } = (window as any).signalContextActions || {};
                  if (closeTrade) await closeTrade(currentTrade.id, pnlUsdt >= 0 ? 'GREEN' : 'LOSS');
                }}
                className="w-full py-3.5 bg-slate-100 hover:bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 mt-auto"
              >
                <CheckCircle2 className="w-4 h-4" /> Fechar Operação
              </button>
            </div>
          ) : setup ? (
            // ── SETUP DISPONÍVEL ───────────────────────
            <div className={`saas-card p-5 border-2 flex flex-col gap-4 ${activeSignal?.action === 'Long' ? 'border-emerald-500/30' : 'border-red-500/30'} h-full`}>
              <div>
                <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Gatilho Hunter</span>
                <h4 className={`text-xl font-black tracking-tighter mt-0.5 ${activeSignal?.action === 'Long' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {activeSignal?.action === 'Long' ? '▲ LONG / BUY' : '▼ SHORT / SELL'}
                </h4>
              </div>

              {/* Entrada */}
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Entrada Recomendada</span>
                  <span className="text-lg font-mono text-white font-black">${setup.entry.toFixed(4)}</span>
                </div>
              </div>

              {/* TP / SL / RR */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50 text-center">
                  <span className="text-[7px] font-bold text-red-400/60 uppercase block">SL</span>
                  <span className="text-[10px] font-mono text-red-400 font-bold">${setup.sl.toFixed(3)}</span>
                </div>
                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50 text-center">
                  <span className="text-[7px] font-bold text-emerald-400/60 uppercase block">TP</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">${setup.tp.toFixed(3)}</span>
                </div>
                <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50 text-center">
                  <span className="text-[7px] font-bold text-blue-400/60 uppercase block">R:R</span>
                  <span className="text-[10px] font-mono text-blue-400 font-bold">{setup.rr}:1</span>
                </div>
              </div>

              {/* Abordagem alert */}
              {hasApproach && (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[9px] text-amber-400 font-bold">Pré-alerta: preço se aproximando da zona!</span>
                </div>
              )}

              <button
                onClick={handleExecuteTrade}
                disabled={isExecuting}
                className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mt-auto ${activeSignal?.action === 'Long' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-900' : 'bg-red-500 hover:bg-red-400 text-white'}`}
              >
                {isExecuting ? 'PROCESSANDO...' : <><Zap className="w-3.5 h-3.5 fill-current" /> EXECUTAR SIMULADO ($10)</>}
              </button>
            </div>
          ) : (
            // ── AGUARDANDO ─────────────────────────────
            <div className="saas-card border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center flex-1 h-full min-h-[300px] gap-3">
              <ShieldAlert className="w-8 h-8 text-slate-700" />
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Aguardando Setup</p>
              <p className="text-[9px] text-slate-700 max-w-[150px]">Score insuficiente para sinal de entrada</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
