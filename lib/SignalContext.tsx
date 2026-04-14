"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
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
  if (tipo === "GREEN") {
    return `🎉 Vitória! A operação correu perfeitamente e atingiu nosso alvo de lucro (Take Profit) em ${currentPrice.toFixed(4)}. Dinheiro no bolso!`;
  }
  return `⚠️ Proteção ativada! O mercado não acompanhou nossa projeção, e a operação foi encerrada automaticamente na barreira de segurança (Stop Loss) em ${currentPrice.toFixed(4)} para proteger nosso capital.`;
}

// ─── Relatório de abertura ─────────────────────────────────
function generateRelatorio(analysis: any, pair: string, entry: number): string {
  const isLong = analysis.action === "Long";
  const icon = isLong ? "🔼" : "🔽";
  const dirName = isLong ? "Long" : "Short";
  
  const startLine = `${icon}${dirName} - $${pair} (scalp)\n\n`;
  
  const sl = analysis.setup?.sl || entry;
  const slDist = Math.abs(entry - sl);
  
  const tp1 = isLong ? entry + slDist : entry - slDist;
  const tp2 = isLong ? entry + slDist * 2 : entry - slDist * 2;
  const tp3 = isLong ? entry + slDist * 3 : entry - slDist * 3;
  const tp4 = isLong ? entry + slDist * 4 : entry - slDist * 4;

  const decimals = entry < 1 ? 5 : 4;
  const entryLine = `Entrada: ${entry.toFixed(decimals)} (trade ativa)\n`;
  const slLine = `SL: ${sl.toFixed(decimals)}\n\n`;
  
  const tpsLine = `TP1: ${tp1.toFixed(decimals)}\nTP2: ${tp2.toFixed(decimals)}\nTP3: ${tp3.toFixed(decimals)}\nTP4: ${tp4.toFixed(decimals)}\n\n`;
  
  const reasons = analysis.reasons && analysis.reasons.length > 0 
    ? `\n\n🔎 Setup: ${analysis.reasons.slice(0, 2).join(" | ").replace("🔵 ", "").replace("🔴 ", "")}`
    : "";

  const finalSummary = `RR máximo ≈ 4.0R\n\nSugestão: 1% da conta em risco (1R)${reasons}`;

  return startLine + entryLine + slLine + tpsLine + finalSummary;
}

// ─── Append de fechamento no relatório ────────────────────
function appendFechamentoRelatorio(existing: string, motivo: string): string {
  return `${existing}\n\n📋 FECHAMENTO — ${motivo}`;
}

// ─── Types ────────────────────────────────────────────────
export type DashboardViewType = "DASHBOARD" | "VALIDATOR" | "PORTFOLIO" | "HISTORY" | "SETTINGS";

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
  addManualSignalToLaboratory: (signal: Partial<Signal>) => Promise<void>;
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);
const REFRESH_INTERVAL = 30;
const PROXY_LIST = [(url: string) => url]; // Binance Direto

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
    const relatorio = generateRelatorio(signal, pair, entryPrice);

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

    const fechamentoMotivo = "🖐️ A operação foi encerrada manualmente pelo usuário em $" + currentPrice.toFixed(4) + ".";
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

  // ── Inserir Trade Manual (Validator) ─────────────────────
  const addManualSignalToLaboratory = useCallback(async (manualSignal: Partial<Signal>) => {
    const id = `manlab-${Date.now()}`;
    const newTrade: any = {
      ...manualSignal,
      id,
      dataHora: new Date().toISOString(),
      resultado: "ABERTO",
      gatilho: "TELEGRAM",
    };

    addSignal(newTrade);
    await saveSignalToCloud(newTrade);
    syncActiveTrades();
    alert(`Sinal ${manualSignal.par} adicionado ao Laboratório!`);
  }, [syncActiveTrades]);

  useEffect(() => {
    (window as any).signalContextActions = { executeTrade, closeTrade };
    syncActiveTrades();
  }, [executeTrade, closeTrade, syncActiveTrades]);

  // ── Análise principal (30s) ──────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    const targetUrl = `https://api.binance.com/api/v3/ticker/24hr`;
    let success = false;

    for (const getProxy of PROXY_LIST) {
      if (success) break;
      try {
        const res = await fetch(getProxy(targetUrl), { cache: "no-store" });
        if (!res.ok) continue;
        const tickerData = await res.json();
        if (!Array.isArray(tickerData)) continue;

        const activePairs = new Set(loadSignals().filter(s => s.resultado === "ABERTO").map(s => s.par + "USDT"));

        const filteredAndSortedPairs = tickerData
          .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.lastPrice) > 0 && parseFloat(t.quoteVolume) > 10000000)
          .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

        const allPairsMap = new Map();
        
        // Coloca o Top 25
        filteredAndSortedPairs.slice(0, 25).forEach((t: any) => allPairsMap.set(t.symbol, t));
        
        // Garante que todas as ativas (mesmo fora do top 25) entrem no loop
        activePairs.forEach(sym => {
          if (!allPairsMap.has(sym)) {
            const foundTicker = tickerData.find((t: any) => t.symbol === sym);
            if (foundTicker) allPairsMap.set(sym, foundTicker);
          }
        });

        const allPairs = Array.from(allPairsMap.values());

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
                statusText:    analysis.checklist?.retestadoOB || analysis.checklist?.liquidezIdentificada ? "Sinal Master" : "Aguardando Approach",
                checklist:     analysis.checklist,
                volume24h:     parseFloat(ticker.quoteVolume),
                reasons:       analysis.reasons,
                setup:         analysis.setup,
                priceChange24h: (parseFloat(ticker.priceChangePercent) / 100).toFixed(4),
                lastPrice:     ticker.lastPrice,
                high24h:       ticker.highPrice,
                low24h:        ticker.lowPrice,
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

  const contextValue = useMemo(() => ({
    scannedSignals, activeTrades, isLoading, lastUpdate, refresh,
    selectedPair, setSelectedPair, activeView, setActiveView,
    countdown, errorMessage, activePrices, addManualSignalToLaboratory
  }), [scannedSignals, activeTrades, isLoading, lastUpdate, selectedPair, activeView, countdown, errorMessage, activePrices, addManualSignalToLaboratory]);

  return (
    <SignalContext.Provider value={contextValue}>
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
