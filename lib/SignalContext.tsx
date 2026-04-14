"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { analyzePair } from "./engine";
import { addSignal, loadSignals, saveSignals, updateSignalStatus } from "./storage";
import { saveSignalToCloud, updateSignalResult, fetchSignalsFromCloud } from "./supabase";
import { WifiOff, CloudDownload } from "lucide-react";
import { Signal } from "./types";

// ─── Capital automático (5% da banca) ─────────────────────
function getAutoCapital(): number {
  try {
    const config = localStorage.getItem("risco_config");
    const { banca } = config ? JSON.parse(config) : { banca: 24 };
    return parseFloat(((parseFloat(banca) || 24) * 0.05).toFixed(2));
  } catch { return 1.20; }
}

// ─── Motivo de fechamento com preço ───────────────────────
function buildFechamentoMotivo(
  tipo: "GREEN" | "LOSS",
  currentPrice: number,
  tp: number,
  sl: number,
  direcao: "LONG" | "SHORT",
): string {
  const fmt = (n: number) =>
    n < 1 ? `$${n.toFixed(6)}` : n < 100 ? `$${n.toFixed(4)}` : `$${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (tipo === "GREEN") {
    return `✅ Take Profit atingido em ${fmt(currentPrice)} (TP: ${fmt(tp)}) — Encerrado com lucro.`;
  }
  return `❌ Stop Loss ativado em ${fmt(currentPrice)} (SL: ${fmt(sl)}) — Posição encerrada.`;
}

// ─── Relatório de abertura ─────────────────────────────────
function generateRelatorio(analysis: any, pair: string, entry: number): string {
  const dir    = analysis.action === "Long" ? "compra (LONG)" : "venda (SHORT)";
  const bias   = analysis.htfBias === "BULLISH" ? "altista" : analysis.htfBias === "BEARISH" ? "baixista" : "neutro";
  const struct = analysis.structureType === "IMPULSIVE" ? "impulsiva" : analysis.structureType === "CORRECTIVE" ? "corretiva" : "neutra";
  const cl     = analysis.checklist || {};

  const confluences: string[] = [];
  if (cl.sweepConfirmado)      confluences.push("Sweep de Liquidez ✅");
  if (cl.chochDetectado)       confluences.push("CHoCH confirmado ✅");
  if (cl.orderBlockQualidade)  confluences.push("OB Extremo validado ✅");
  if (cl.idmDetectado)         confluences.push("IDM (Inducement) detectado ✅");
  if (cl.liquidezIdentificada) confluences.push("Liquidez PDH/PDL mapeada ✅");
  if (cl.retestadoOB)          confluences.push("Reteste do OB confirmado ✅");

  const waiting: string[] = [];
  if (!cl.sweepConfirmado) waiting.push("Sweep de Liquidez");
  if (!cl.chochDetectado)  waiting.push("CHoCH de confirmação");
  if (!cl.retestadoOB)     waiting.push("Reteste do Order Block");

  const rsiNote = analysis.indicators?.rsi
    ? analysis.indicators.rsi < 30
      ? `RSI em ${analysis.indicators.rsi.toFixed(0)} — sobrevenda, reforça ${dir}.`
      : analysis.indicators.rsi > 70
      ? `RSI em ${analysis.indicators.rsi.toFixed(0)} — sobrecompra, reforça ${dir}.`
      : `RSI em ${analysis.indicators.rsi.toFixed(0)} — neutro.`
    : "";

  const setupNote = analysis.setup
    ? `Entrada em $${entry.toFixed(4)}, TP em $${analysis.setup.tp.toFixed(4)}, SL em $${analysis.setup.sl.toFixed(4)} (RR ${analysis.setup.rr}:1).`
    : "";

  let report = `Operação de ${dir} em ${pair}USDT aberta com ${confluences.length} confluências SMC. `;
  report += `Viés H4 ${bias} com estrutura ${struct}. `;
  if (confluences.length > 0) report += `Confirmado por: ${confluences.slice(0, 3).join(", ")}. `;
  if (rsiNote)  report += rsiNote + " ";
  if (setupNote) report += setupNote;
  if (waiting.length > 0) report += ` Aguardando: ${waiting.slice(0, 2).join(" e ")}.`;

  return report;
}

// ─── Append de fechamento no relatório ────────────────────
function appendFechamentoRelatorio(existing: string, motivo: string): string {
  return `${existing}\n\n📋 FECHAMENTO — ${motivo}`;
}

// ─── Types ────────────────────────────────────────────────
export type DashboardViewType = "DASHBOARD" | "PORTFOLIO" | "HISTORY" | "SETTINGS";

interface ScannedSignal {
  pair: string; score: number; action: "Long" | "Short" | "Aguardar" | "Evitar";
  timeframe: string; statusText: string; checklist: any; volume24h: number;
  reasons: string[]; setup: any; priceChange24h: string; lastPrice: string;
  high24h: string; low24h: string; bias: number; session: any; indicators: any;
}

interface SignalContextType {
  scannedSignals: ScannedSignal[]; activeTrades: Signal[]; isLoading: boolean;
  lastUpdate: Date | null; refresh: () => void;
  selectedPair: string; setSelectedPair: (p: string) => void;
  activeView: DashboardViewType; setActiveView: (v: DashboardViewType) => void;
  countdown: number; errorMessage: string | null;
  activePrices: Record<string, number>;
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);
const REFRESH_INTERVAL = 30;
const PROXY_LIST = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [scannedSignals, setScannedSignals] = useState<ScannedSignal[]>([]);
  const [activeTrades, setActiveTrades]     = useState<Signal[]>([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isSyncing, setIsSyncing]           = useState(true);
  const [lastUpdate, setLastUpdate]         = useState<Date | null>(null);
  const [selectedPair, setSelectedPair]     = useState("BTC");
  const [activeView, setActiveView]         = useState<DashboardViewType>("DASHBOARD");
  const [countdown, setCountdown]           = useState(REFRESH_INTERVAL);
  const [errorMessage, setErrorMessage]     = useState<string | null>(null);
  const [activePrices, setActivePrices]     = useState<Record<string, number>>({});

  // ── Sync trades ativos do localStorage ──────────────────
  const syncActiveTrades = useCallback(() => {
    setActiveTrades(loadSignals().filter(s => s.resultado === "ABERTO"));
  }, []);

  // ── Sync inicial da nuvem → localStorage ────────────────
  const syncFromCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const cloudSignals = await fetchSignalsFromCloud();
      if (cloudSignals.length > 0) {
        const local    = loadSignals();
        const cloudIds = new Set(cloudSignals.map(s => s.id));
        const merged   = [...cloudSignals, ...local.filter(s => !cloudIds.has(s.id))];
        saveSignals(merged);
        setActiveTrades(merged.filter(s => s.resultado === "ABERTO"));
      } else {
        syncActiveTrades();
      }
    } catch {
      syncActiveTrades();
    } finally {
      setIsSyncing(false);
    }
  }, [syncActiveTrades]);

  useEffect(() => { syncFromCloud(); }, []);

  // ── Monitor de trades — detecta TP/SL em tempo real ─────
  const monitorTrades = useCallback(async (currentPrices: ScannedSignal[]) => {
    const allSignals = loadSignals();
    const opens      = allSignals.filter(s => s.resultado === "ABERTO");
    setActiveTrades(opens);

    for (const trade of opens) {
      const priceInfo = currentPrices.find(p => p.pair === trade.par);
      if (!priceInfo) continue;

      const currentPrice = activePrices[trade.par] || parseFloat(priceInfo.lastPrice);
      const isLong = trade.direcao === "LONG";
      const tp = trade.targetTP ?? trade.precoEntrada * 1.01;
      const sl = trade.precoStop;

      let result: "GREEN" | "LOSS" | null = null;
      if (isLong) {
        if (currentPrice >= tp) result = "GREEN";
        if (currentPrice <= sl) result = "LOSS";
      } else {
        if (currentPrice <= tp) result = "GREEN";
        if (currentPrice >= sl) result = "LOSS";
      }

      if (result) {
        // ── Calcula P&L ──────────────────────────────────
        let profit = 0;
        let profitPct: number | undefined;
        if (trade.capitalSimulado && trade.alavancagem) {
          const movePct = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
          profit      = result === "GREEN"
            ? trade.capitalSimulado * movePct * trade.alavancagem
            : -trade.capitalSimulado;
          profitPct   = result === "GREEN"
            ? movePct * trade.alavancagem * 100
            : -100;
        }

        // ── Motivo de fechamento ──────────────────────────
        const fechamentoMotivo = buildFechamentoMotivo(result, currentPrice, tp, sl, trade.direcao as any);
        const relatorioAtual   = trade.relatorio ?? "";
        const relatorioFinal   = appendFechamentoRelatorio(relatorioAtual, fechamentoMotivo);

        // ── Atualiza localStorage ─────────────────────────
        const updated = loadSignals().map(s =>
          s.id === trade.id
            ? {
                ...s,
                resultado: result!,
                lucroFinalUsdt:   profit,
                lucroFinalPct:    profitPct,
                dataHoraFim:      new Date().toISOString(),
                fechamentoMotivo,
                relatorio:        relatorioFinal,
              }
            : s
        );
        saveSignals(updated);

        // ── Sincroniza nuvem ──────────────────────────────
        await updateSignalResult(trade.id, result, profit, profitPct, fechamentoMotivo);
        syncActiveTrades();
      }
    }
  }, [syncActiveTrades, activePrices]);

  // ── Executar trade manual ────────────────────────────────
  const executeTrade = useCallback(async (pair: string, capital: number, leverage: number) => {
    const signal = scannedSignals.find(s => s.pair === pair);
    if (!signal?.setup) { alert("Aguardando análise de preço..."); return; }

    const entryPrice = parseFloat(signal.lastPrice);
    const relatorio  = `Operação manual de ${signal.action === "Long" ? "compra (LONG)" : "venda (SHORT)"} em ${pair}USDT. Score SMC: ${signal.score}/16. Viés H4: ${(signal as any).htfBias || "NEUTRO"}. Entrada em $${entryPrice.toFixed(4)}, TP $${signal.setup.tp.toFixed(4)}, SL $${signal.setup.sl.toFixed(4)} (RR ${signal.setup.rr}:1). Capital: $${capital.toFixed(2)} com ${leverage}x.`;

    const newTrade: any = {
      id:              `man-${Date.now()}`,
      dataHora:        new Date().toISOString(),
      par:             pair,
      pontuacao:       signal.score,
      direcao:         (signal.action as string).toUpperCase(),
      precoEntrada:    entryPrice,
      precoStop:       signal.setup.sl,
      targetTP:        signal.setup.tp,
      rr:              signal.setup.rr,
      resultado:       "ABERTO",
      checklist:       signal.checklist,
      capitalSimulado: capital,
      alavancagem:     leverage,
      reasons:         signal.reasons,
      relatorio,
    };

    addSignal(newTrade);
    await saveSignalToCloud(newTrade);
    syncActiveTrades();
    refresh();
  }, [scannedSignals, syncActiveTrades]);

  // ── Fechar trade manualmente ─────────────────────────────
  const closeTrade = useCallback(async (id: string, result: "GREEN" | "LOSS") => {
    const trade = loadSignals().find(t => t.id === id);
    if (!trade) return;

    const priceInfo = scannedSignals.find(p => p.pair === trade.par);
    let profit    = 0;
    let profitPct: number | undefined;
    let currentPrice = trade.precoEntrada;

    if (priceInfo && trade.capitalSimulado && trade.alavancagem) {
      currentPrice = parseFloat(priceInfo.lastPrice);
      const isLong = trade.direcao === "LONG";
      const movePct = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
      const isGreen = isLong ? currentPrice > trade.precoEntrada : currentPrice < trade.precoEntrada;
      profit    = isGreen
        ? trade.capitalSimulado * movePct * trade.alavancagem
        : -trade.capitalSimulado * movePct * trade.alavancagem;
      profitPct = isGreen
        ? movePct * trade.alavancagem * 100
        : -movePct * trade.alavancagem * 100;
    }

    const fechamentoMotivo = `🖐️ Encerramento manual em $${currentPrice.toFixed(4)} — Resultado: ${result}.`;
    const relatorioFinal   = appendFechamentoRelatorio(trade.relatorio ?? "", fechamentoMotivo);

    const updated = loadSignals().map(s =>
      s.id === id
        ? {
            ...s,
            resultado: result,
            lucroFinalUsdt:   profit,
            lucroFinalPct:    profitPct,
            dataHoraFim:      new Date().toISOString(),
            fechamentoMotivo,
            relatorio:        relatorioFinal,
          }
        : s
    );
    saveSignals(updated);
    await updateSignalResult(id, result, profit, profitPct, fechamentoMotivo);
    syncActiveTrades();
    alert(`Posição encerrada! Resultado: ${result}`);
  }, [scannedSignals, syncActiveTrades]);

  useEffect(() => {
    (window as any).signalContextActions = { executeTrade, closeTrade };
    syncActiveTrades();
  }, [executeTrade, syncActiveTrades, closeTrade]);

  // ── Loop de preços rápidos para trades ativos (3s) ───────
  useEffect(() => {
    if (activeTrades.length === 0) return;
    const fast = async () => {
      const symbols   = activeTrades.map(t => `${t.par}USDT`).join(",");
      const targetUrl = `https://api.bybit.com/v5/market/tickers?category=linear&symbols=${symbols}&t=${Date.now()}`;
      for (const getProxy of PROXY_LIST) {
        try {
          const res = await fetch(getProxy(targetUrl), { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.result?.list) continue;
          const prices: Record<string, number> = { ...activePrices };
          data.result.list.forEach((t: any) => {
            prices[t.symbol.replace("USDT", "")] = parseFloat(t.lastPrice);
          });
          setActivePrices(prices);
          break;
        } catch { continue; }
      }
    };
    const iv = setInterval(fast, 3000);
    fast();
    return () => clearInterval(iv);
  }, [activeTrades]);

  // ── Análise principal (30s) ──────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    const targetUrl = `https://api.bybit.com/v5/market/tickers?category=linear&t=${Date.now()}`;
    let success = false;

    for (const getProxy of PROXY_LIST) {
      if (success) break;
      try {
        const res = await fetch(getProxy(targetUrl), { cache: "no-store" });
        if (!res.ok) continue;
        const tickerData = await res.json();
        if (!tickerData.result?.list) continue;

        const allPairs = tickerData.result.list
          .filter((t: any) => t.symbol.endsWith("USDT"))
          .sort((a: any, b: any) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
          .slice(0, 25);

        const results = await Promise.all(
          allPairs.map(async (ticker: any) => {
            const pairName = ticker.symbol.replace("USDT", "");
            try {
              const analysis = await analyzePair(pairName);

              if (analysis.score >= 11 && (analysis.action === "Long" || analysis.action === "Short")) {
                const existing    = loadSignals();
                const alreadyOpen = existing.find(s => s.par === pairName && s.resultado === "ABERTO");
                if (!alreadyOpen) {
                  const entryPrice  = parseFloat(ticker.lastPrice);
                  const autoCapital = getAutoCapital();
                  const relatorio   = generateRelatorio(analysis, pairName, entryPrice);
                  const autoSignal: any = {
                    id:              `auto-${Date.now()}-${pairName}`,
                    dataHora:        new Date().toISOString(),
                    par:             pairName,
                    timeframe:       analysis.timeframe,
                    pontuacao:       analysis.score,
                    direcao:         (analysis.action as string).toUpperCase(),
                    precoEntrada:    entryPrice,
                    precoStop:       analysis.setup?.sl,
                    targetTP:        analysis.setup?.tp,
                    rr:              analysis.setup?.rr,
                    resultado:       "ABERTO",
                    checklist:       analysis.checklist,
                    htfBias:         analysis.htfBias,
                    structureType:   analysis.structureType,
                    capitalSimulado: autoCapital,
                    alavancagem:     10,
                    reasons:         analysis.reasons,
                    relatorio,
                  };
                  addSignal(autoSignal);
                  saveSignalToCloud(autoSignal);
                  syncActiveTrades();
                }
              }

              return {
                pair:          pairName,
                score:         analysis.score,
                action:        analysis.action as any,
                timeframe:     analysis.timeframe,
                statusText:    analysis.checklist?.sweepConfirmado ? "Setup Confirmado" : "Aguardando Sweep",
                checklist:     analysis.checklist,
                volume24h:     parseFloat(ticker.turnover24h),
                reasons:       analysis.reasons,
                setup:         analysis.setup,
                priceChange24h: ticker.price24hPcnt,
                lastPrice:     ticker.lastPrice,
                high24h:       ticker.highPrice24h,
                low24h:        ticker.lowPrice24h,
                bias:          analysis.bias,
                session:       analysis.session,
                indicators:    analysis.indicators,
              };
            } catch { return null; }
          })
        );

        const valid = results.filter(r => r !== null) as ScannedSignal[];
        setScannedSignals(valid.sort((a, b) => b.score - a.score));
        await monitorTrades(valid);
        setLastUpdate(new Date());
        setCountdown(REFRESH_INTERVAL);
        success = true;
      } catch (err: any) { console.warn("Falha no túnel...", err.message); }
    }

    if (!success) setErrorMessage("Falha na conexão Bybit. Tentando reconexão...");
    setIsLoading(false);
  }, [isLoading, monitorTrades, syncActiveTrades]);

  const refresh = useCallback(() => runAnalysis(), [runAnalysis]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (countdown === 0) runAnalysis(); }, [countdown, runAnalysis]);
  useEffect(() => { runAnalysis(); }, []);

  return (
    <SignalContext.Provider value={{
      scannedSignals, activeTrades, isLoading, lastUpdate, refresh,
      selectedPair, setSelectedPair, activeView, setActiveView,
      countdown, errorMessage, activePrices,
    }}>
      {isSyncing && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-brand-500/90 text-white px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
          <CloudDownload className="w-4 h-4 animate-pulse" />
          Sincronizando operações da nuvem...
        </div>
      )}
      {errorMessage && !isSyncing && (
        <div className="fixed bottom-6 left-6 z-[100] bg-orange-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-md border border-orange-400/50">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-bold uppercase">{errorMessage}</span>
        </div>
      )}
      {children}
    </SignalContext.Provider>
  );
}

export function useSignals() {
  const ctx = useContext(SignalContext);
  if (!ctx) throw new Error("useSignals must be used within a SignalProvider");
  return ctx;
}
