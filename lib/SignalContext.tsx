'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzePair } from './engine';
import { addSignal, loadSignals, updateSignalStatus } from './storage';
import { saveSignalToCloud, updateSignalResult } from './supabase';
import { WifiOff } from 'lucide-react';

export type DashboardViewType = 'DASHBOARD' | 'HISTORY' | 'SETTINGS';

interface ScannedSignal {
  pair: string;
  score: number;
  action: 'Long' | 'Short' | 'Aguardar' | 'Evitar';
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
  isLoading: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
  selectedPair: string;
  setSelectedPair: (p: string) => void;
  activeView: DashboardViewType;
  setActiveView: (v: DashboardViewType) => void;
  countdown: number;
  errorMessage: string | null;
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
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedPair, setSelectedPair] = useState<string>('BTC');
  const [activeView, setActiveView] = useState<DashboardViewType>('DASHBOARD');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Monitora trades abertos contra o preço atual
  const monitorTrades = useCallback((currentPrices: ScannedSignal[]) => {
    const activeTrades = loadSignals().filter(s => s.resultado === 'ABERTO');
    
    activeTrades.forEach(async (trade) => {
      const priceInfo = currentPrices.find(p => p.pair === trade.par);
      if (!priceInfo) return;

      const currentPrice = parseFloat(priceInfo.lastPrice);
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
        // Calcula lucro simulado se houver capital
        let profit = 0;
        if (trade.capitalSimulado && trade.alavancagem) {
          const movePcnt = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
          profit = result === 'GREEN' 
            ? trade.capitalSimulado * movePcnt * trade.alavancagem 
            : -trade.capitalSimulado;
        }

        updateSignalStatus(trade.id, result);
        if (trade.id.length > 20) { // Supabase ID
           await updateSignalResult(trade.id, result, profit);
        }
      }
    });
  }, []);

  const executeTrade = useCallback(async (pair: string, capital: number, leverage: number) => {
    const signal = scannedSignals.find(s => s.pair === pair);
    if (!signal || !signal.setup) return;

    const newTrade: any = {
      id: `man-${Date.now()}`,
      dataHora: new Date().toISOString(),
      par: pair,
      pontuacao: signal.score,
      direcao: (signal.action as string).toUpperCase(),
      precoEntrada: signal.setup.entry,
      precoStop: signal.setup.sl,
      targetTP: signal.setup.tp,
      rr: signal.setup.rr,
      resultado: 'ABERTO',
      checklist: signal.checklist,
      capitalSimulado: capital,
      alavancagem: leverage
    };

    addSignal(newTrade);
    await saveSignalToCloud(newTrade);
    refresh();
  }, [scannedSignals]);

  // Expõe ações para componentes externos
  useEffect(() => {
    (window as any).signalContextActions = { executeTrade };
  }, [executeTrade]);

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
              
              // SALVAMENTO AUTOMÁTICO (Agora a partir de 8 pontos)
              if (analysis.score >= 8) {
                const existing = loadSignals();
                const alreadyOpen = existing.find(s => s.par === pairName && s.resultado === 'ABERTO');
                if (!alreadyOpen) {
                  const autoSignal: any = {
                    dataHora: new Date().toISOString(),
                    par: pairName,
                    pontuacao: analysis.score,
                    direcao: (analysis.action as string).toUpperCase(),
                    precoEntrada: analysis.setup?.entry,
                    precoStop: analysis.setup?.sl,
                    targetTP: analysis.setup?.tp,
                    rr: analysis.setup?.rr,
                    resultado: 'ABERTO',
                    checklist: analysis.checklist
                  };
                  addSignal(autoSignal);
                  saveSignalToCloud(autoSignal);
                }
              }

              return {
                pair: pairName,
                score: analysis.score,
                action: analysis.action as any,
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
        
        // Dispara o monitoramento de trades abertos
        monitorTrades(validResults);

        setLastUpdate(new Date());
        setCountdown(REFRESH_INTERVAL);
        success = true;
      } catch (error: any) { console.warn('Falha no túnel...', error.message); }
    }

    if (!success) setErrorMessage("Falha na conexão Bybit. Tentando Reconexão...");
    setIsLoading(false);
  }, [isLoading, monitorTrades]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (countdown === 0) runAnalysis(); }, [countdown, runAnalysis]);
  useEffect(() => { runAnalysis(); }, []);

  const refresh = useCallback(() => runAnalysis(), [runAnalysis]);

  return (
    <SignalContext.Provider value={{ 
      scannedSignals, isLoading, lastUpdate, refresh,
      selectedPair, setSelectedPair,
      activeView, setActiveView,
      countdown, errorMessage
    }}>
      {errorMessage && (
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
