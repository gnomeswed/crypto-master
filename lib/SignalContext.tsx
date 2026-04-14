'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { analyzePair } from './engine';
import { addSignal, loadSignals, updateSignal, generateId } from './storage';
import { supabase, fetchSignalsFromCloud, saveSignalToCloud } from './supabase';

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
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);

const REFRESH_INTERVAL = 30;

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const [scannedSignals, setScannedSignals] = useState<ScannedSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedPair, setSelectedPair] = useState<string>('BTC');
  const [activeView, setActiveView] = useState<DashboardViewType>('DASHBOARD');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  
  const isCheckingPositionRef = useRef(false);

  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const tickerRes = await fetch(`/api/bybit?path=/v5/market/tickers&category=linear&_t=${Date.now()}`, { cache: 'no-store' });
      const tickerData = await tickerRes.json();
      
      if (!tickerData.result?.list) throw new Error("Falha ao buscar tickers");

      const allPairs = tickerData.result.list
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
        .slice(0, 25);

      const results = await Promise.all(
        allPairs.map(async (ticker: any) => {
          const pairName = ticker.symbol.replace('USDT', '');
          try {
            const analysis = await analyzePair(pairName);
            
            // GRAVAÇÃO AUTOMÁTICA EM CASO DE NOTA 10
            if (analysis.score >= 10) {
              const existing = loadSignals();
              const alreadyOpen = existing.find(s => s.par === pairName && s.resultado === 'ABERTO');
              if (!alreadyOpen) {
                const newSignal: any = {
                  id: generateId(),
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
                
                // Salva Local
                addSignal(newSignal);
                // Salva na Nuvem (Supabase)
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

      const filteredResults = (results.filter(r => r !== null) as ScannedSignal[])
        .sort((a, b) => b.score - a.score);

      setScannedSignals(filteredResults);
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL);
      
    } catch (error) {
      console.error('Erro no Hunter Global:', error);
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
      countdown
    }}>
      {children}
    </SignalContext.Provider>
  );
}

export function useSignals() {
  const context = useContext(SignalContext);
  if (!context) throw new Error('useSignals must be used within a SignalProvider');
  return context;
}
