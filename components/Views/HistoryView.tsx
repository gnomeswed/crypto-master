"use client";

import { useEffect, useState, useMemo } from "react";
import { loadSignals, deleteSignal } from "@/lib/storage";
import { fetchSignalsFromCloud } from "@/lib/supabase";
import { Signal } from "@/lib/types";
import {
  Cloud, HardDrive, Trash2, ExternalLink, RefreshCw,
  TrendingUp, TrendingDown, Minus, Clock, Calendar,
  CheckCircle2, XCircle, Activity, Filter, ChevronDown, ChevronUp
} from "lucide-react";
import { useSignals } from "@/lib/SignalContext";

// ─── helpers ──────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function calcDuration(start: string, end?: string): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}min`;
  return `${m}min`;
}

// ─── Badge de resultado ────────────────────────────────────
function ResultBadge({ resultado }: { resultado: string }) {
  if (resultado === "GREEN") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
      <CheckCircle2 className="w-2.5 h-2.5" /> WIN
    </span>
  );
  if (resultado === "LOSS") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-wider">
      <XCircle className="w-2.5 h-2.5" /> LOSS
    </span>
  );
  if (resultado === "BREAK_EVEN") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-400 border border-slate-600/50 text-[10px] font-black uppercase tracking-wider">
      <Minus className="w-2.5 h-2.5" /> BE
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider animate-pulse">
      <Activity className="w-2.5 h-2.5" /> ABERTO
    </span>
  );
}

// ─── Row expandida (detalhes completos) ───────────────────
function ExpandedRow({ s }: { s: Signal }) {
  const isWin  = s.resultado === "GREEN";
  const isLoss = s.resultado === "LOSS";

  return (
    <tr className="bg-slate-950/80">
      <td colSpan={9} className="px-6 py-0">
        <div className="py-4 border-t border-dashed border-slate-800/60 grid grid-cols-2 md:grid-cols-4 gap-3">

          {/* Preços */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Níveis de Preço</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Entrada</span>
                <span className="text-[10px] font-mono font-bold text-white">${s.precoEntrada?.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-emerald-500/70">Take Profit</span>
                <span className="text-[10px] font-mono font-bold text-emerald-400">${s.targetTP?.toFixed(4) ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-red-500/70">Stop Loss</span>
                <span className="text-[10px] font-mono font-bold text-red-400">${s.precoStop?.toFixed(4) ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Timing</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Abertura</span>
                <span className="text-[10px] font-mono text-slate-300">{fmtDate(s.dataHora)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Fechamento</span>
                <span className="text-[10px] font-mono text-slate-300">
                  {s.dataHoraFim ? fmtDate(s.dataHoraFim) : <span className="text-slate-600 italic">—</span>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Duração</span>
                <span className="text-[10px] font-mono font-bold text-brand-400">
                  {calcDuration(s.dataHora, s.dataHoraFim)}
                </span>
              </div>
            </div>
          </div>

          {/* Risk/Reward */}
          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Risk / Reward</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">RR Planejado</span>
                <span className="text-[10px] font-mono font-bold text-white">1:{s.rr ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Score SMC</span>
                <span className="text-[10px] font-mono font-bold text-brand-400">{s.pontuacao}/16</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Alavancagem</span>
                <span className="text-[10px] font-mono text-amber-400">{s.alavancagem ? `${s.alavancagem}x` : "—"}</span>
              </div>
            </div>
          </div>

          {/* P&L */}
          <div className={`rounded-xl p-3 border ${isWin ? "bg-emerald-500/5 border-emerald-500/20" : isLoss ? "bg-red-500/5 border-red-500/20" : "bg-slate-900/60 border-slate-800/60"}`}>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">P & L</p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Resultado $</span>
                <span className={`text-[12px] font-mono font-black ${isWin ? "text-emerald-400" : isLoss ? "text-red-400" : "text-slate-500"}`}>
                  {s.lucroFinalUsdt != null
                    ? `${isWin ? "+" : ""}$${s.lucroFinalUsdt.toFixed(2)}`
                    : s.resultado === "ABERTO" ? <span className="text-amber-400 text-[9px]">Em aberto</span> : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Resultado %</span>
                <span className={`text-[11px] font-mono font-black ${isWin ? "text-emerald-400" : isLoss ? "text-red-400" : "text-slate-500"}`}>
                  {s.lucroFinalPct != null
                    ? `${isWin ? "+" : ""}${s.lucroFinalPct.toFixed(2)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500">Capital</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {s.capitalSimulado ? `$${s.capitalSimulado.toFixed(0)}` : "—"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Motivo / Relatório */}
        {(s.fechamentoMotivo || s.relatorio) && (
          <div className="pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {s.fechamentoMotivo && (
              <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/40 flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest shrink-0">Motivo:</span>
                <span className="text-[10px] text-slate-300 font-medium">{s.fechamentoMotivo}</span>
              </div>
            )}
            {s.relatorio && (
              <div className="bg-slate-900/40 rounded-xl p-3 border border-blue-500/20">
                <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest mb-1">Relatório do Agente</p>
                <p className="text-[9px] text-slate-400 leading-relaxed">{s.relatorio}</p>
              </div>
            )}
          </div>
        )}

      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════
//  HISTORY VIEW — Extrato Institucional
// ═══════════════════════════════════════════════════════════
export default function HistoryView() {
  const [signals, setSignals]         = useState<Signal[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [dataSource, setDataSource]   = useState<"LOCAL" | "CLOUD">("LOCAL");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filterResult, setFilter]     = useState<"ALL" | "GREEN" | "LOSS" | "ABERTO">("ALL");
  const [filterDir, setFilterDir]     = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const { setSelectedPair, setActiveView } = useSignals();

  const loadData = async () => {
    setIsLoading(true);
    const cloudData = await fetchSignalsFromCloud();
    if (cloudData && cloudData.length > 0) {
      setSignals(cloudData);
      setDataSource("CLOUD");
    } else {
      setSignals(loadSignals());
      setDataSource("LOCAL");
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = (id: string) => {
    if (!confirm("Remover esta operação do histórico local?")) return;
    deleteSignal(id);
    setSignals(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAll = () => {
    if (!confirm("⚠️ Apagar TODO o histórico local? Esta ação não pode ser desfeita.")) return;
    localStorage.removeItem("crypto_master_signals");
    setSignals([]);
  };

  // ─── Filtros + estatísticas ───────────────────────────
  const filtered = useMemo(() => {
    return signals
      .filter(s => filterResult === "ALL" || s.resultado === filterResult)
      .filter(s => filterDir    === "ALL" || s.direcao   === filterDir)
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
  }, [signals, filterResult, filterDir]);

  const green  = signals.filter(s => s.resultado === "GREEN").length;
  const loss   = signals.filter(s => s.resultado === "LOSS").length;
  const aberto = signals.filter(s => s.resultado === "ABERTO").length;
  const total  = green + loss;
  const winRate = total > 0 ? Math.round((green / total) * 100) : 0;
  const totalPnl = signals.reduce((acc, s) => acc + (s.lucroFinalUsdt ?? 0), 0);
  const avgRR    = total > 0
    ? (signals.filter(s => s.rr).reduce((a, s) => a + (s.rr ?? 0), 0) / signals.filter(s => s.rr).length).toFixed(1)
    : "—";

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Extrato de Operações
            <span className={`text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${dataSource === "CLOUD" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-slate-800 text-slate-500 border-slate-700"}`}>
              {dataSource === "CLOUD" ? <Cloud className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
              {dataSource}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Histórico completo de entradas registradas pelo scanner SMC</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-xl text-[10px] font-bold text-slate-300 hover:bg-slate-700/60 transition-all">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
          <button onClick={handleClearAll} className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
            <Trash2 className="w-3 h-3" /> Limpar Local
          </button>
        </div>
      </div>

      {/* ── KPI Summary Bar ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="saas-card p-4">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Win Rate</p>
          <p className="text-2xl font-black text-white">{winRate}<span className="text-sm text-slate-500 font-normal">%</span></p>
          <div className="h-0.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${winRate}%` }} />
          </div>
        </div>
        <div className="saas-card p-4">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">P&L Total</p>
          <p className={`text-xl font-black font-mono ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
          <p className="text-[8px] text-slate-600 mt-1">acumulado registrado</p>
        </div>
        <div className="saas-card p-4">
          <p className="text-[8px] font-bold text-emerald-500/70 uppercase tracking-widest mb-1">Wins</p>
          <p className="text-2xl font-black text-emerald-400">{green}</p>
          <p className="text-[8px] text-slate-600 mt-1">{aberto} abertos</p>
        </div>
        <div className="saas-card p-4">
          <p className="text-[8px] font-bold text-red-500/70 uppercase tracking-widest mb-1">Losses</p>
          <p className="text-2xl font-black text-red-400">{loss}</p>
          <p className="text-[8px] text-slate-600 mt-1">{total} finalizados</p>
        </div>
        <div className="saas-card p-4">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">RR Médio</p>
          <p className="text-2xl font-black text-brand-400">1:{avgRR}</p>
          <p className="text-[8px] text-slate-600 mt-1">risco/retorno</p>
        </div>
      </div>

      {/* ── Filtros ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest mr-1">
          <Filter className="w-3 h-3" /> Filtrar:
        </div>
        {(["ALL","GREEN","LOSS","ABERTO"] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
              filterResult === f
                ? f === "GREEN" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : f === "LOSS"  ? "bg-red-500/20 text-red-400 border-red-500/30"
                : f === "ABERTO" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-slate-700 text-white border-slate-600"
                : "text-slate-600 border-slate-800 hover:text-slate-400"
            }`}>
            {f === "ALL" ? "Todos" : f === "ABERTO" ? "Abertos" : f}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-800 mx-1" />
        {(["ALL","LONG","SHORT"] as const).map(d => (
          <button key={d}
            onClick={() => setFilterDir(d)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${
              filterDir === d
                ? d === "LONG"  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : d === "SHORT" ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-slate-700 text-white border-slate-600"
                : "text-slate-600 border-slate-800 hover:text-slate-400"
            }`}>
            {d === "ALL" ? "L+S" : d}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-slate-600">{filtered.length} operações</span>
      </div>

      {/* ── Tabela (Extrato) ───────────────────────────── */}
      <div className="saas-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80">
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">#</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Ativo</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Lado</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Abertura</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Fechamento</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Duração</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">P&L $</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">P&L %</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500 text-xs animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Sincronizando...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-600 italic text-xs">
                  Nenhuma operação encontrada com os filtros atuais.
                </td></tr>
              ) : filtered.map((s, i) => {
                const isWin      = s.resultado === "GREEN";
                const isLoss     = s.resultado === "LOSS";
                const isExpanded = expandedId === s.id;
                const dur        = s.dataHoraFim ? calcDuration(s.dataHora, s.dataHoraFim) : null;

                return (
                  <>
                    <tr
                      key={s.id}
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className={`cursor-pointer transition-colors group ${isExpanded ? "bg-slate-800/30" : "hover:bg-slate-800/20"}`}
                    >
                      {/* # */}
                      <td className="px-4 py-3.5">
                        <span className="text-[9px] font-mono text-slate-600">{filtered.length - i}</span>
                      </td>

                      {/* Ativo */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-white">{s.par}<span className="text-slate-600">/USDT</span></span>
                          {s.timeframe && <span className="text-[8px] text-slate-600 font-mono">TF: {s.timeframe}</span>}
                        </div>
                      </td>

                      {/* Lado */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          s.direcao === "LONG"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {s.direcao === "LONG"
                            ? <TrendingUp className="w-2.5 h-2.5" />
                            : <TrendingDown className="w-2.5 h-2.5" />}
                          {s.direcao}
                        </span>
                      </td>

                      {/* Abertura */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-slate-300">{fmtDateShort(s.dataHora)}</span>
                          <span className="text-[8px] text-slate-600 font-mono">${s.precoEntrada?.toFixed(4) ?? "—"}</span>
                        </div>
                      </td>

                      {/* Fechamento */}
                      <td className="px-4 py-3.5">
                        {s.dataHoraFim ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-mono text-slate-300">{fmtDateShort(s.dataHoraFim)}</span>
                            {s.fechamentoMotivo && (
                              <span className="text-[8px] text-slate-600">{s.fechamentoMotivo}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-600 italic">
                            {s.resultado === "ABERTO" ? "Em andamento" : "—"}
                          </span>
                        )}
                      </td>

                      {/* Duração */}
                      <td className="px-4 py-3.5">
                        {dur ? (
                          <span className="text-[10px] font-mono text-brand-400 font-bold">{dur}</span>
                        ) : s.resultado === "ABERTO" ? (
                          <span className="text-[9px] text-amber-400 font-mono animate-pulse">
                            {calcDuration(s.dataHora)}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </td>

                      {/* P&L $ */}
                      <td className="px-4 py-3.5">
                        {s.lucroFinalUsdt != null ? (
                          <span className={`text-[11px] font-black font-mono ${isWin ? "text-emerald-400" : isLoss ? "text-red-400" : "text-slate-400"}`}>
                            {isWin ? "+" : ""}${s.lucroFinalUsdt.toFixed(2)}
                          </span>
                        ) : s.resultado === "ABERTO" ? (
                          <span className="text-[9px] text-amber-400/60 animate-pulse">—</span>
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </td>

                      {/* P&L % */}
                      <td className="px-4 py-3.5">
                        {s.lucroFinalPct != null ? (
                          <span className={`text-[11px] font-black font-mono ${isWin ? "text-emerald-400" : "text-red-400"}`}>
                            {isWin ? "+" : ""}{s.lucroFinalPct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <ResultBadge resultado={s.resultado} />
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedPair(s.par); setActiveView("DASHBOARD"); }}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-all"
                              title="Ver no gráfico"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Linha expandida com detalhes */}
                    {isExpanded && <ExpandedRow key={`${s.id}-exp`} s={s} />}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
