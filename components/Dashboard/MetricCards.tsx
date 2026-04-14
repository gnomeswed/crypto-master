"use client";

import { useSignals } from "@/lib/SignalContext";
import { loadSignals } from "@/lib/storage";
import {
  TrendingUp, CheckCircle2, XCircle, Activity, Zap, Target,
  X, ArrowUpCircle, ArrowDownCircle, Clock, ChevronDown, ChevronUp,
  TrendingDown, Minus, Calendar
} from "lucide-react";
import { useEffect, useState } from "react";
import { Signal } from "@/lib/types";

// ─── helpers ──────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function calcDur(start: string, end?: string) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}min`;
  return `${m}min`;
}

// ─── Drawer Modal ─────────────────────────────────────────
function Drawer({ title, open, onClose, children }: {
  title: string; open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

// ─── Signal Card (sinais do scanner) ─────────────────────
function SignalCard({ signal, onSelect }: { signal: any; onSelect: (pair: string) => void }) {
  const isLong  = signal.action === "Long";
  const isShort = signal.action === "Short";
  const isScalp = ["M5","5","15","M15"].includes(signal.timeframe);
  const scoreColor = signal.score >= 11 ? "text-brand-400" : signal.score >= 9 ? "text-emerald-400" : "text-amber-400";

  return (
    <button
      onClick={() => onSelect(signal.pair)}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left hover:scale-[1.01] active:scale-[0.99] ${
        isLong  ? "border-emerald-500/30 bg-emerald-500/5" :
        isShort ? "border-red-500/30 bg-red-500/5" :
                  "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${isLong ? "bg-emerald-500/20" : isShort ? "bg-red-500/20" : "bg-slate-800"}`}>
          {isLong
            ? <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
            : isShort
              ? <ArrowDownCircle className="w-5 h-5 text-red-400" />
              : <Activity className="w-5 h-5 text-slate-500" />}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold text-white">{signal.pair}/USDT</span>
            {isScalp && (
              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
                ⚡ Scalp
              </span>
            )}
          </div>
          <div className="text-[9px] text-slate-500 font-medium">
            TF: M{signal.timeframe || "15"} • {signal.htfBias || "NEUTRAL"} H4 Bias
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
          isLong ? "bg-emerald-500 text-white" : isShort ? "bg-red-500 text-white" : "bg-slate-700 text-slate-300"
        }`}>
          {signal.action}
        </span>
        <span className={`text-xs font-black font-mono ${scoreColor}`}>
          {signal.score}<span className="text-[8px] text-slate-600">/16</span>
        </span>
      </div>
    </button>
  );
}

// ─── Row histórico estilo extrato ─────────────────────────
function HistExtrato({ signal, onGoToChart, activePrices }: { signal: Signal; onGoToChart: (par: string) => void; activePrices: any; }) {
  const [expanded, setExpanded] = useState(false);
  const isWin  = signal.resultado === "GREEN";
  const isLoss = signal.resultado === "LOSS";
  const isOpen = signal.resultado === "ABERTO";
  const currentPrice = activePrices ? (activePrices[signal.par] || signal.precoEntrada) : signal.precoEntrada;

  return (
    <>
      <div
        onClick={() => setExpanded(p => !p)}
        className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
          isOpen
            ? "border-amber-500/10 bg-amber-500/5 opacity-80"
            : expanded
              ? "border-slate-700 bg-slate-800/40 cursor-pointer"
              : "border-slate-800/40 bg-slate-900/20 hover:bg-slate-800/20 cursor-pointer"
        }`}
      >
        {/* Ícone lado */}
        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
          signal.direcao === "LONG" ? "bg-emerald-500/15" : "bg-red-500/15"
        }`}>
          {signal.direcao === "LONG"
            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
            : <TrendingDown className="w-3 h-3 text-red-400" />}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white">{signal.par}/USDT</span>
            <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
              signal.direcao === "LONG"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}>
              {signal.direcao}
            </span>
            {signal.timeframe && (
              <span className="text-[7px] font-mono text-slate-600">{signal.timeframe}</span>
            )}
          </div>

          {/* Datas */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-[8px] text-slate-500 flex items-center gap-0.5">
              <Calendar className="w-2 h-2" />
              <span className="text-slate-600">Início:</span> {fmtDate(signal.dataHora)}
            </span>
            {signal.dataHoraFim ? (
              <span className="text-[8px] text-slate-500 flex items-center gap-0.5">
                <Clock className="w-2 h-2" />
                <span className="text-slate-600">Fim:</span> {fmtDate(signal.dataHoraFim)}
                <span className="text-brand-400/60 ml-1">({calcDur(signal.dataHora, signal.dataHoraFim)})</span>
              </span>
            ) : isOpen ? (
              <span className="text-[8px] text-amber-400/60 animate-pulse">Em andamento · {calcDur(signal.dataHora)}</span>
            ) : null}
          </div>

          {/* Score */}
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[8px] text-slate-600">Score: <span className="text-brand-400 font-bold">{signal.pontuacao}/16</span></span>
            {signal.rr && <span className="text-[8px] text-slate-600">RR: <span className="text-white font-bold">1:{signal.rr}</span></span>}
            {signal.precoEntrada && <span className="text-[8px] font-mono text-slate-600">@ ${parseFloat(String(signal.precoEntrada)).toFixed(4)}</span>}
          </div>
        </div>

        {/* P&L + resultado */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Badge resultado */}
          {signal.resultado === "GREEN" && (
            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500 text-white">WIN</span>
          )}
          {signal.resultado === "LOSS" && (
            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500 text-white">LOSS</span>
          )}
          {signal.resultado === "BREAK_EVEN" && (
            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">BE</span>
          )}
          {isOpen && (
            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">ABERTO</span>
          )}

          {/* P&L */}
          {signal.lucroFinalUsdt != null && (
            <span className={`text-[11px] font-black font-mono ${isWin ? "text-emerald-400" : "text-red-400"}`}>
              {isWin ? "+" : ""}${signal.lucroFinalUsdt.toFixed(2)}
            </span>
          )}
          {signal.lucroFinalPct != null && (
            <span className={`text-[9px] font-bold font-mono ${isWin ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {isWin ? "+" : ""}{signal.lucroFinalPct.toFixed(2)}%
            </span>
          )}

          {expanded ? <ChevronUp className="w-3 h-3 text-slate-500 mt-0.5" /> : <ChevronDown className="w-3 h-3 text-slate-600 mt-0.5" />}
        </div>
      </div>

      {/* Detalhe expandido */}
      {expanded && (
        <div className="mx-2 mb-1 p-3 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[7px] font-bold text-slate-600 uppercase mb-1">Entrada</p>
            <p className="text-[10px] font-mono text-white">${signal.precoEntrada?.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[7px] font-bold text-emerald-500/60 uppercase mb-1">Take Profit</p>
            <p className="text-[10px] font-mono text-emerald-400">${signal.targetTP?.toFixed(4) ?? "—"}</p>
          </div>
          <div>
            <p className="text-[7px] font-bold text-red-500/60 uppercase mb-1">Stop Loss</p>
            <p className="text-[10px] font-mono text-red-400">${signal.precoStop?.toFixed(4)}</p>
          </div>
          {signal.alavancagem && (
            <div>
              <p className="text-[7px] font-bold text-slate-600 uppercase mb-1">Alavancagem</p>
              <p className="text-[10px] font-mono text-amber-400">{signal.alavancagem}x</p>
            </div>
          )}
          {signal.capitalSimulado && (
            <div>
              <p className="text-[7px] font-bold text-slate-600 uppercase mb-1">Capital</p>
              <p className="text-[10px] font-mono text-slate-300">${signal.capitalSimulado.toFixed(0)}</p>
            </div>
          )}
          {signal.fechamentoMotivo && (
            <div className="col-span-3">
              <p className="text-[7px] font-bold text-slate-600 uppercase mb-1">Motivo Fechamento</p>
              <p className="text-[9px] text-slate-300">{signal.fechamentoMotivo}</p>
            </div>
          )}
          {signal.relatorio && (
            <div className="col-span-3 mt-1 p-3 bg-slate-900/50 rounded-xl border border-blue-500/20">
              <p className="text-[8px] font-bold text-blue-500/60 uppercase mb-1">Relatório SMC</p>
              <p className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{signal.relatorio}</p>
              {isOpen && (
                <div className="mt-2 text-[10px] text-brand-400 font-bold bg-slate-950 px-3 py-1.5 rounded-lg inline-block w-fit border border-brand-500/20">
                  📌 Preço Atual MTM: ${currentPrice.toFixed(4)}
                </div>
              )}
            </div>
          )}
          <div className="col-span-3 flex gap-2 mt-1">
            <button
              onClick={() => onGoToChart(signal.par)}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all"
            >
              Ver Gráfico →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  METRIC CARDS
// ═══════════════════════════════════════════════════════════
export default function MetricCards() {
  const { scannedSignals, setSelectedPair, setActiveView, activePrices } = useSignals();
  const [histSignals, setHistSignals] = useState<Signal[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<"assertividade" | "master" | "elite" | "radar" | null>(null);

  useEffect(() => {
    setHistSignals(loadSignals());
  }, [scannedSignals]);

  const green   = histSignals.filter(s => s.resultado === "GREEN").length;
  const loss    = histSignals.filter(s => s.resultado === "LOSS").length;
  const aberto  = histSignals.filter(s => s.resultado === "ABERTO").length;
  const total   = green + loss;
  const winRate = total > 0 ? Math.round((green / total) * 100) : 0;
  const totalPnl = histSignals.reduce((a, s) => a + (s.lucroFinalUsdt ?? 0), 0);

  const masterSignals = scannedSignals.filter(s => s.score >= 11 && (s.action === "Long" || s.action === "Short"));
  const eliteSignals  = scannedSignals.filter(s => s.score >= 9 && s.score < 11 && (s.action === "Long" || s.action === "Short"));
  const radarSignals  = scannedSignals.filter(s => s.score >= 5 && s.score < 9);

  const sortByScalpFirst = (sigs: any[]) =>
    [...sigs].sort((a, b) => {
      const aScalp = ["5","15","M5","M15"].includes(a.timeframe) ? 1 : 0;
      const bScalp = ["5","15","M5","M15"].includes(b.timeframe) ? 1 : 0;
      if (aScalp !== bScalp) return bScalp - aScalp;
      return b.score - a.score;
    });

  const handleSelectSignal = (pair: string) => {
    setSelectedPair(pair);
    setActiveView("DASHBOARD");
    setActiveDrawer(null);
  };

  const handleGoToChart = (pair: string) => {
    setSelectedPair(pair);
    setActiveView("DASHBOARD");
    setActiveDrawer(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* CARD 1: ASSERTIVIDADE */}
        <button
          onClick={() => setActiveDrawer("assertividade")}
          className="saas-card p-5 text-left group hover:border-emerald-500/30 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Assertividade</span>
            <Target className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-3xl font-black text-white tracking-tighter">{winRate}</span>
            <span className="text-base font-black text-emerald-500 mb-0.5">%</span>
          </div>
          <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
              <CheckCircle2 className="w-3 h-3" />{green} wins
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-red-500">
              <XCircle className="w-3 h-3" />{loss} loss
            </span>
            {aberto > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">{aberto} aberto</span>
            )}
          </div>
          {totalPnl !== 0 && (
            <p className={`text-[9px] font-bold font-mono mt-2 ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          )}
          <span className="text-[8px] text-slate-600 mt-1 block">Clique para extrato →</span>
        </button>

        {/* CARD 2: MASTER SIGNAL */}
        <button
          onClick={() => setActiveDrawer("master")}
          className="saas-card p-5 text-left border-brand-500/20 bg-brand-500/5 group hover:bg-brand-500/10 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest">🏆 Master Signal</span>
            <Zap className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{masterSignals.length}</span>
            <span className="text-[9px] font-black text-brand-500/60 mb-1 uppercase">Prontos</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Score ≥ 11/16 — OB Extremo + RSI/DIV</p>
          <span className="text-[8px] text-brand-500/60 mt-2 block">Clique para ver sinais →</span>
        </button>

        {/* CARD 3: ELITE SETUP */}
        <button
          onClick={() => setActiveDrawer("elite")}
          className="saas-card p-5 text-left border-emerald-500/20 bg-emerald-500/5 group hover:bg-emerald-500/10 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">💎 Elite Setup</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{eliteSignals.length}</span>
            <span className="text-[9px] font-black text-emerald-500/60 mb-1 uppercase">Sinais</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Long/Short confirmado (Score 9-10/16)</p>
          <span className="text-[8px] text-emerald-500/60 mt-2 block">Clique para ver sinais →</span>
        </button>

        {/* CARD 4: EM RADAR */}
        <button
          onClick={() => setActiveDrawer("radar")}
          className="saas-card p-5 text-left group hover:border-slate-700 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">📡 Em Radar</span>
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-black text-white tracking-tighter">{radarSignals.length}</span>
            <span className="text-[9px] font-black text-slate-500/60 mb-1 uppercase">Pares</span>
          </div>
          <p className="text-[8px] text-slate-500 leading-relaxed">Aguardando CHoCH ou Sweep (Score 5-8)</p>
          <span className="text-[8px] text-slate-600 mt-2 block">Clique para ver pares →</span>
        </button>
      </div>

      {/* ════ DRAWERS ════ */}

      {/* Histórico — Extrato */}
      <Drawer
        title={`📊 Extrato — ${histSignals.length} operações`}
        open={activeDrawer === "assertividade"}
        onClose={() => setActiveDrawer(null)}
      >
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: "Win Rate", value: `${winRate}%`, color: "text-white" },
            { label: "Wins",     value: green,          color: "text-emerald-400" },
            { label: "Losses",   value: loss,           color: "text-red-400" },
            { label: "P&L",
              value: totalPnl !== 0 ? `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}` : "—",
              color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
            },
          ].map(k => (
            <div key={k.label} className="bg-slate-900 rounded-xl p-3 text-center border border-slate-800">
              <p className="text-[7px] text-slate-500 uppercase font-bold mb-1">{k.label}</p>
              <p className={`text-xl font-black font-mono ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {histSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-xs py-10">Nenhuma operação registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {[...histSignals]
              .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
              .map((s, i) => (
                <HistExtrato key={s.id || i} signal={s} onGoToChart={handleGoToChart} activePrices={activePrices} />
              ))}
          </div>
        )}
      </Drawer>

      {/* Master Signals */}
      <Drawer title={`🏆 Master Signals — ${masterSignals.length} disponíveis`} open={activeDrawer === "master"} onClose={() => setActiveDrawer(null)}>
        {masterSignals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm mb-1">Nenhum Master Signal ativo agora.</p>
            <p className="text-slate-600 text-xs">O scanner atualiza a cada 30 segundos.</p>
          </div>
        ) : (
          <>
            {sortByScalpFirst(masterSignals).some(s => ["5","15","M5","M15"].includes(s.timeframe)) && (
              <div className="mb-4">
                <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2">⚡ Scalp (M5/M15)</h4>
                <div className="space-y-2">
                  {sortByScalpFirst(masterSignals).filter(s => ["5","15","M5","M15"].includes(s.timeframe)).map(s => (
                    <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
                  ))}
                </div>
              </div>
            )}
            {sortByScalpFirst(masterSignals).some(s => !["5","15","M5","M15"].includes(s.timeframe)) && (
              <div>
                <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">📊 Swing</h4>
                <div className="space-y-2">
                  {sortByScalpFirst(masterSignals).filter(s => !["5","15","M5","M15"].includes(s.timeframe)).map(s => (
                    <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Elite Signals */}
      <Drawer title={`💎 Elite Setups — ${eliteSignals.length} disponíveis`} open={activeDrawer === "elite"} onClose={() => setActiveDrawer(null)}>
        {eliteSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Nenhum Elite Setup ativo agora.</p>
        ) : (
          <div className="space-y-2">
            {sortByScalpFirst(eliteSignals).map(s => (
              <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
            ))}
          </div>
        )}
      </Drawer>

      {/* Radar */}
      <Drawer title={`📡 Em Radar — ${radarSignals.length} pares`} open={activeDrawer === "radar"} onClose={() => setActiveDrawer(null)}>
        <p className="text-[10px] text-slate-500 mb-4">Pares formando estrutura, aguardando confirmação para sinal de entrada.</p>
        {radarSignals.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Nenhum par em formação agora.</p>
        ) : (
          <div className="space-y-2">
            {radarSignals.sort((a, b) => b.score - a.score).map(s => (
              <SignalCard key={s.pair} signal={s} onSelect={handleSelectSignal} />
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
