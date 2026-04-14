'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { analyzePair } from './engine';
import { addSignal, loadSignals } from './storage';
import { saveSignalToCloud } from './supabase';
import { AlertCircle, WifiOff } from 'lucide-react';

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

// TÚNEL NEUTRO PARA BYPASS DE WAF (CORS)
const CORS_PROXY = "https://proxy.cors.sh/"; // Backup: "https://corsproxy.io/?"
const BYBIT_API = "https://api.bybit.com/v5/market/tickers?category=linear";

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [scannedSignals, setScannedSignals] = useState<ScannedSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedPair, setSelectedPair] = useState<string>('BTC');
  const [activeView, setActiveView] = useState<DashboardViewType>('DASHBOARD');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Tentativa 1: Direta via Proxy CORS (Usa o IP do usuário, que não é bloqueado)
      const targetUrl = `${BYBIT_API}&t=${Date.now()}`;
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
      
      if (!res.ok) throw new Error(`Conexão instável (Status ${res.status})`);
      const tickerData = await res.json();
      
      if (!tickerData.result?.list) throw new Error("Dados de mercado indisponíveis no momento");

      const allPairs = tickerData.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
        .slice(0, 25);

      const results = await Promise.all(
        allPairs.map(async (ticker: any) => {
          const pairName = ticker.symbol.replace('USDT', '');
          try {
            const analysis = await analyzePair(pairName);
            
            if (analysis.score >= 10) {
              const existing = loadSignals();
              const alreadyOpen = existing.find(s => s.par === pairName && s.resultado === 'ABERTO');
              if (!alreadyOpen) {
                const newSignal: any = {
                  dataHora: new Date().toISOString(),
                  par: pairName,
                  pontuacao: analysis.score,
                  direcao: (analysis.action as string).toUpperCase(),
                  precoEntrada: analysis.setup?.entry,
                  precoStop: analysis.setup?.sl,
                  rr: analysis.setup?.rr,
                  resultado: 'ABERTO',
                  checklist: analysis.checklist,
                  targetTP: analysis.setup?.tp
                };
                addSignal(newSignal);
                saveSignalToCloud(newSignal);
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
          } catch (err) {
            return null;
          }
        })
      );

      setScannedSignals((results.filter(r => r !== null) as ScannedSignal[]).sort((a, b) => b.score - a.score));
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL);
      
    } catch (error: any) {
      console.error('Erro no Scanner:', error);
      setErrorMessage("Erro de Conexão com a Bybit. Tentando Reestabelecer...");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (countdown === 0) runAnalysis(); }, [countdown, runAnalysis]);
  useEffect(() => { runAnalysis(); }, []);

  return (
    <SignalContext.Provider value={{ 
      scannedSignals, isLoading, lastUpdate, refresh: runAnalysis,
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
