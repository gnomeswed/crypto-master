'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzePair } from './engine';
import { addSignal, loadSignals, saveSignals, updateSignalStatus } from './storage';
import { saveSignalToCloud, updateSignalResult, fetchSignalsFromCloud } from './supabase';
import { WifiOff, CloudDownload } from 'lucide-react';
import { Signal } from './types';


// ─── Helpers de Banca e Capital ───────────────────────────────
/** Lê banca do localStorage e retorna 5% como capital por trade */
function getAutoCapital(): number {
  try {
    const config = localStorage.getItem('risco_config');
    const { banca } = config ? JSON.parse(config) : { banca: 24 };
    const banca_num = parseFloat(banca) || 24;
    return parseFloat((banca_num * 0.05).toFixed(2)); // 5% da banca
  } catch { return 1.20; } // fallback: 5% de $24
}

// ─── Gerador de Relatório Personalizado ──────────────────────
/** Gera uma narrativa legível para o operador baseada nos dados do sinal */
function generateRelatorio(analysis: any, pair: string, entry: number): string {
  const dir    = analysis.action === 'Long' ? 'compra (LONG)' : 'venda (SHORT)';
  const bias   = analysis.htfBias === 'BULLISH' ? 'altista' : analysis.htfBias === 'BEARISH' ? 'baixista' : 'neutro';
  const struct = analysis.structureType === 'IMPULSIVE' ? 'impulsiva' : analysis.structureType === 'CORRECTIVE' ? 'corretiva' : 'neutra';
  const cl     = analysis.checklist || {};

  const confluences: string[] = [];
  if (cl.sweepConfirmado)     confluences.push('Sweep de Liquidez ✅');
  if (cl.chochDetectado)      confluences.push('CHoCH confirmado ✅');
  if (cl.orderBlockQualidade) confluences.push('OB Extremo validado ✅');
  if (cl.idmDetectado)        confluences.push('IDM (Inducement) detectado ✅');
  if (cl.liquidezIdentificada) confluences.push('Liquidez PDH/PDL mapeada ✅');
  if (cl.retestadoOB)         confluences.push('Reteste do OB confirmado ✅');

  const waiting: string[] = [];
  if (!cl.sweepConfirmado)     waiting.push('Sweep de Liquidez');
  if (!cl.chochDetectado)      waiting.push('CHoCH de confirmação');
  if (!cl.retestadoOB)         waiting.push('Reteste do Order Block');

  const rsiNote = analysis.indicators?.rsi
    ? analysis.indicators.rsi < 30
      ? `RSI em ${analysis.indicators.rsi.toFixed(0)} — zona de sobrevenda, reforça o ${dir}.`
      : analysis.indicators.rsi > 70
      ? `RSI em ${analysis.indicators.rsi.toFixed(0)} — zona de sobrecompra, reforça o ${dir}.`
      : `RSI em ${analysis.indicators.rsi.toFixed(0)} — neutro, aguardar confirmação de vela.`
    : '';

  const setupNote = analysis.setup
    ? `Entrada em $${entry.toFixed(4)}, TP em $${analysis.setup.tp.toFixed(4)}, SL em $${analysis.setup.sl.toFixed(4)} (RR ${analysis.setup.rr}:1).`
    : '';

  let report = `Operação de ${dir} em ${pair}USDT aberta com ${confluences.length} confluências SMC. `;
  report += `Viés H4 ${bias} com estrutura ${struct}. `;
  if (confluences.length > 0) report += `Confirmado por: ${confluences.slice(0, 3).join(', ')}. `;
  if (rsiNote) report += rsiNote + ' ';
  if (setupNote) report += setupNote;
  if (waiting.length > 0) report += ` Para o lucro: aguardando ${waiting.slice(0, 2).join(' e ')}.`;


  return report;
}

export type DashboardViewType = 'DASHBOARD' | 'PORTFOLIO' | 'HISTORY' | 'SETTINGS';

interface ScannedSignal {
  pair: string;
  score: number;
  action: 'Long' | 'Short' | 'Aguardar' | 'Evitar';
  timeframe: string;
  statusText: string;
  checklist: any;
  volume24h: number;
  reasons: string[];
  setup: any;
  priceChange24h: string;
  lastPrice: string;
  high24h: string;
  low24h: string;
  bias: number;
  session: any;
  indicators: any;
}

interface SignalContextType {
  scannedSignals: ScannedSignal[];
  activeTrades: Signal[];
  isLoading: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
  selectedPair: string;
  setSelectedPair: (p: string) => void;
  activeView: DashboardViewType;
  setActiveView: (v: DashboardViewType) => void;
  countdown: number;
  errorMessage: string | null;
  activePrices: Record<string, number>; // Novo: Preços em tempo real para trades ativos
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);

const REFRESH_INTERVAL = 30;

const PROXY_LIST = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [scannedSignals, setScannedSignals] = useState<ScannedSignal[]>([]);
  const [activeTrades, setActiveTrades]     = useState<Signal[]>([]);
  const [isLoading, setIsLoading]           = useState(false);
  const [isSyncing, setIsSyncing]           = useState(true); // sync inicial
  const [lastUpdate, setLastUpdate]         = useState<Date | null>(null);
  const [selectedPair, setSelectedPair]     = useState<string>('BTC');
  const [activeView, setActiveView]         = useState<DashboardViewType>('DASHBOARD');
  const [countdown, setCountdown]           = useState(REFRESH_INTERVAL);
  const [errorMessage, setErrorMessage]     = useState<string | null>(null);
  const [activePrices, setActivePrices]     = useState<Record<string, number>>({});

  // ─── Sincroniza trades ativos do storage local ────────────────
  const syncActiveTrades = useCallback(() => {
    const all = loadSignals();
    const active = all.filter(s => s.resultado === 'ABERTO');
    setActiveTrades(active);
  }, []);

  // ─── Sincroniza da NUVEM → localStorage (na inicialização) ────
  const syncFromCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const cloudSignals = await fetchSignalsFromCloud();
      if (cloudSignals.length > 0) {
        const localSignals  = loadSignals();
        // Merge: cloud é source of truth. Registros locais sem ID na nuvem são mantidos.
        const cloudIds      = new Set(cloudSignals.map(s => s.id));
        const localOnly     = localSignals.filter(s => !cloudIds.has(s.id));
        const merged        = [...cloudSignals, ...localOnly];
        saveSignals(merged);
        setActiveTrades(merged.filter(s => s.resultado === 'ABERTO'));
      } else {
        syncActiveTrades();
      }
    } catch {
      syncActiveTrades();
    } finally {
      setIsSyncing(false);
    }
  }, [syncActiveTrades]);

  // Sync inicial ao montar
  useEffect(() => { syncFromCloud(); }, []);

  // Monitora trades abertos contra o preço atual
  const monitorTrades = useCallback(async (currentPrices: ScannedSignal[]) => {
    const allSignals = loadSignals();
    const activeOnes = allSignals.filter(s => s.resultado === 'ABERTO');
    
    // Atualiza o estado local para UI imediata
    setActiveTrades(activeOnes);

    for (const trade of activeOnes) {
      const priceInfo = currentPrices.find(p => p.pair === trade.par);
      if (!priceInfo) continue;

        const currentPrice = activePrices[trade.par] || parseFloat(priceInfo.lastPrice);
        const isLong = trade.direcao === 'LONG';
      const tp = trade.targetTP || trade.precoEntrada * 1.01;
      const sl = trade.precoStop;

      let result: 'GREEN' | 'LOSS' | null = null;
      if (isLong) {
        if (currentPrice >= tp) result = 'GREEN';
        if (currentPrice <= sl) result = 'LOSS';
      } else {
        if (currentPrice <= tp) result = 'GREEN';
        if (currentPrice >= sl) result = 'LOSS';
      }

      if (result) {
        let profit = 0;
        if (trade.capitalSimulado && trade.alavancagem) {
          const movePcnt = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
          profit = result === 'GREEN'
            ? trade.capitalSimulado * movePcnt * trade.alavancagem
            : -trade.capitalSimulado;
        }

        updateSignalStatus(trade.id, result);
        await updateSignalResult(trade.id, result, profit); // sempre sincroniza nuvem
        syncActiveTrades();
      }

    }
  }, [syncActiveTrades]);

  const executeTrade = useCallback(async (pair: string, capital: number, leverage: number) => {
    const signal = scannedSignals.find(s => s.pair === pair);
    if (!signal || !signal.setup) {
      alert("Aguardando análise de preço para executar...");
      return;
    }

    const entryPrice = parseFloat(signal.lastPrice);
    const relatorio  = `Operação manual de ${signal.action === 'Long' ? 'compra (LONG)' : 'venda (SHORT)'} em ${pair}USDT. Score SMC: ${signal.score}/16. Viés H4: ${(signal as any).htfBias || 'NEUTRO'}. Entrada em $${entryPrice.toFixed(4)}, TP $${signal.setup.tp.toFixed(4)}, SL $${signal.setup.sl.toFixed(4)} (RR ${signal.setup.rr}:1). Capital alocado: $${capital.toFixed(2)} com ${leverage}x de alavancagem.`;

    const newTrade: any = {
      id: `man-${Date.now()}`,
      dataHora: new Date().toISOString(),
      par: pair,
      pontuacao: signal.score,
      direcao: (signal.action as string).toUpperCase(),
      precoEntrada: entryPrice,
      precoStop: signal.setup.sl,
      targetTP: signal.setup.tp,
      rr: signal.setup.rr,
      resultado: 'ABERTO',
      checklist: signal.checklist,
      capitalSimulado: capital,
      alavancagem: leverage,
      reasons: signal.reasons,
      relatorio,
    };

    addSignal(newTrade);
    await saveSignalToCloud(newTrade);
    syncActiveTrades();
    refresh();
  }, [scannedSignals, syncActiveTrades]);

  const closeTrade = useCallback(async (id: string, result: 'GREEN' | 'LOSS') => {
    const trade = loadSignals().find(t => t.id === id);
    if (!trade) return;

    // Calcula lucro final no momento do fechamento manual
    const priceInfo = scannedSignals.find(p => p.pair === trade.par);
    let profit = 0;
    if (priceInfo && trade.capitalSimulado && trade.alavancagem) {
      const currentPrice = parseFloat(priceInfo.lastPrice);
      const isLong = trade.direcao === 'LONG';
      const movePcnt = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
      const isActuallyGreen = isLong ? currentPrice > trade.precoEntrada : currentPrice < trade.precoEntrada;
      
      profit = isActuallyGreen 
        ? trade.capitalSimulado * movePcnt * trade.alavancagem 
        : -trade.capitalSimulado * movePcnt * trade.alavancagem;
    }

    updateSignalStatus(id, result);
        if (id.length > 0) { // sempre sincroniza nuvem
          await updateSignalResult(id, result, profit);
        }

    syncActiveTrades();
    alert(`Posição encerrada com sucesso! Resultado: ${result}`);
  }, [scannedSignals, syncActiveTrades]);

  // Expõe ações para componentes externos
  useEffect(() => {
    (window as any).signalContextActions = { executeTrade, closeTrade };
    syncActiveTrades();
  }, [executeTrade, syncActiveTrades, closeTrade]);

  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    
    const targetUrl = `https://api.bybit.com/v5/market/tickers?category=linear&t=${Date.now()}`;
    let success = false;

    for (const getProxyUrl of PROXY_LIST) {
      if (success) break;
      try {
        const res = await fetch(getProxyUrl(targetUrl), { cache: 'no-store' });
        if (!res.ok) continue;

        const tickerData = await res.json();
        if (!tickerData.result?.list) continue;

        const allPairs = tickerData.result.list
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .sort((a: any, b: any) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
          .slice(0, 25);

        const results = await Promise.all(
          allPairs.map(async (ticker: any) => {
            const pairName = ticker.symbol.replace('USDT', '');
            try {
              const analysis = await analyzePair(pairName);
              
              // ✅ Threshold ajustado para >= 11/14 (equivalente ao antigo >= 8/10)
              // ✅ Só abre trade se action for Long ou Short (não Aguardar/Evitar)
              if (analysis.score >= 11 && (analysis.action === 'Long' || analysis.action === 'Short')) {
                const existing = loadSignals();
                const alreadyOpen = existing.find(s => s.par === pairName && s.resultado === 'ABERTO');
                if (!alreadyOpen) {
                  const entryPrice    = parseFloat(ticker.lastPrice);
                  const autoCapital   = getAutoCapital();
                  const relatorio     = generateRelatorio(analysis, pairName, entryPrice);

                  const autoSignal: any = {
                    id:            `auto-${Date.now()}-${pairName}`,
                    dataHora:      new Date().toISOString(),
                    par:           pairName,
                    timeframe:     analysis.timeframe,
                    pontuacao:     analysis.score,
                    direcao:       (analysis.action as string).toUpperCase(),
                    precoEntrada:  entryPrice,
                    precoStop:     analysis.setup?.sl,
                    targetTP:      analysis.setup?.tp,
                    rr:            analysis.setup?.rr,
                    resultado:     'ABERTO',
                    checklist:     analysis.checklist,
                    htfBias:       analysis.htfBias,
                    structureType: analysis.structureType,
                    capitalSimulado: autoCapital,   // ✔ 5% da banca
                    alavancagem:     10,             // ✔ padrão
                    reasons:         analysis.reasons,
                    relatorio:       relatorio,
                  };
                  addSignal(autoSignal);
                  saveSignalToCloud(autoSignal);
                  syncActiveTrades();
                }
              }

              return {
                pair: pairName,
                score: analysis.score,
                action: analysis.action as any,
                timeframe: analysis.timeframe, // Passa para a UI de scaneamento
                statusText: analysis.checklist?.sweepConfirmado ? 'Setup Confirmado' : 'Aguardando Sweep',
                checklist: analysis.checklist,
                volume24h: parseFloat(ticker.turnover24h),
                reasons: analysis.reasons,
                setup: analysis.setup,
                priceChange24h: ticker.price24hPcnt,
                lastPrice: ticker.lastPrice,
                high24h: ticker.highPrice24h,
                low24h: ticker.lowPrice24h,
                bias: analysis.bias,
                session: analysis.session,
                indicators: analysis.indicators
              };
            } catch (err) { return null; }
          })
        );

        const validResults = results.filter(r => r !== null) as ScannedSignal[];
        setScannedSignals(validResults.sort((a, b) => b.score - a.score));
        
        await monitorTrades(validResults);

        setLastUpdate(new Date());
        setCountdown(REFRESH_INTERVAL);
        success = true;
      } catch (error: any) { console.warn('Falha no túnel...', error.message); }
    }

    if (!success) setErrorMessage("Falha na conexão Bybit. Tentando Reconexão...");
    setIsLoading(false);
  }, [isLoading, monitorTrades, syncActiveTrades]);

  // Loop de Preços Rápidos (3 Segundos) para trades ativos
  useEffect(() => {
    if (activeTrades.length === 0) return;

    const fastUpdate = async () => {
      const symbols = activeTrades.map(t => `${t.par}USDT`).join(',');
      const targetUrl = `https://api.bybit.com/v5/market/tickers?category=linear&symbols=${symbols}&t=${Date.now()}`;
      
      for (const getProxyUrl of PROXY_LIST) {
        try {
          const res = await fetch(getProxyUrl(targetUrl), { cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.result?.list) continue;

          const newPrices: Record<string, number> = { ...activePrices };
          data.result.list.forEach((t: any) => {
            const pairName = t.symbol.replace('USDT', '');
            newPrices[pairName] = parseFloat(t.lastPrice);
          });
          setActivePrices(newPrices);
          break;
        } catch (e) { continue; }
      }
    };

    const interval = setInterval(fastUpdate, 3000);
    fastUpdate();
    return () => clearInterval(interval);
  }, [activeTrades, activePrices]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (countdown === 0) runAnalysis(); }, [countdown, runAnalysis]);
  useEffect(() => { runAnalysis(); }, []);

  const refresh = useCallback(() => runAnalysis(), [runAnalysis]);

  return (
    <SignalContext.Provider value={{
      scannedSignals, activeTrades, isLoading, lastUpdate, refresh,
      selectedPair, setSelectedPair,
      activeView, setActiveView,
      countdown, errorMessage, activePrices
    }}>
      {/* Banner: Sincronizando da nuvem */}
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
  const context = useContext(SignalContext);
  if (!context) throw new Error('useSignals must be used within a SignalProvider');
  return context;
}
