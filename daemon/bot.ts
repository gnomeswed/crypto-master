import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as http from 'http';

// Tenta carregar .env.local primeiro, depois .env
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

// ── SERVIDOR WEB FANTASMA (KEEP-ALIVE PARA RENDER) ──────────
const PORT = process.env.PORT || 3001;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NEXTTRADE_DAEMON_ALIVE');
}).listen(PORT, () => {
  console.log(`📡 Servidor Keep-Alive ouvindo na porta ${PORT}`);
});

console.log("🚀 Iniciando NEXTTRADE DAEMON (Modo Server-Side 24/7)...");

import { analyzePair } from '../lib/engine';
import { supabase, saveSignalToCloud, fetchSignalsFromCloud, updateSignalResult } from '../lib/supabase';
import { Signal } from '../lib/types';

// Capital fixo para o bot rodar offline (5% de banca $24 default = 1.20)
const AUTO_CAPITAL = 1.20;
const ALAVANCAGEM = 10;
const INTERVALO_SCAN_MS = 30000;

// Equivalente ao buildFechamentoMotivo do Frontend
function buildFechamentoMotivo(tipo: "GREEN" | "LOSS", currentPrice: number, tp: number, sl: number, direcao: string) {
  if (tipo === "GREEN") {
    return `🎉 Vitória! A operação correu perfeitamente e atingiu nosso alvo de lucro (Take Profit) em ${currentPrice.toFixed(4)}. Dinheiro no bolso!`;
  }
  return `⚠️ Proteção ativada! O mercado não acompanhou nossa projeção, e a operação foi encerrada automaticamente na barreira de segurança (Stop Loss) em ${currentPrice.toFixed(4)} para proteger nosso capital.`;
}

function appendFechamentoRelatorio(existing: string, motivo: string): string {
  return `${existing || ""}\n\n📋 FECHAMENTO — ${motivo}`;
}

// Analisa e fecha trades baseados em preço
async function monitorTrades(activeTrades: Signal[], tickerData: any[], activePrices: Record<string, number>) {
  for (const trade of activeTrades) {
    const ticker = tickerData.find((t: any) => t.symbol === `${trade.par}USDT`);
    if (!ticker) continue;

    const currentPrice = activePrices[trade.par] || parseFloat(ticker.lastPrice);
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
      console.log(`[FECHAMENTO] Sinal ${trade.par} atingiu ${result}!`);
      let profit = 0;
      let profitPct: number | undefined;

      if (trade.capitalSimulado && trade.alavancagem) {
        const movePct = Math.abs(currentPrice - trade.precoEntrada) / trade.precoEntrada;
        profit = result === "GREEN"
          ? trade.capitalSimulado * movePct * trade.alavancagem
          : -trade.capitalSimulado;
        profitPct = result === "GREEN"
          ? movePct * trade.alavancagem * 100
          : -100;
      }

      const fechamentoMotivo = buildFechamentoMotivo(result, currentPrice, tp, sl, trade.direcao);
      // Puxar o "relatorio" do trade (que hoje está no BD nuvem)
      const { data } = await supabase!.from("signals").select("relatorio").eq("id", trade.id).single();
      const relatorioAtual = data?.relatorio || trade.relatorio || "";
      const relatorioFinal = appendFechamentoRelatorio(relatorioAtual, fechamentoMotivo);

      await supabase!.from("signals").update({
        resultado: result,
        lucro_final_usdt: profit,
        lucro_final_pct: profitPct,
        fechamento_motivo: fechamentoMotivo,
        relatorio: relatorioFinal,
        data_hora_fim: new Date().toISOString()
      }).eq("id", trade.id);
    }
  }
}

// O Loop infinito!
async function runDaemonLoop() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Iniciando Varredura...`);

  try {
    let tickerData = [];
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/24hr", { cache: "no-store", keepalive: true });
      if (!res.ok) throw new Error("Binance Blocked");
      tickerData = await res.json();
      console.log("✅ Dados obtidos via Binance");
    } catch (err) {
      console.log("⚠️ Binance bloqueada. Alternando para redundância Bybit...");
      // Bybit Public Ticker (Spot)
      const resBybit = await fetch("https://api.bybit.com/v5/market/tickers?category=spot", { cache: "no-store" });
      if (!resBybit.ok) throw new Error("Ambas as corretoras falharam");
      const d = await resBybit.json();
      // Normaliza o formato Bybit para o formato Binance
      tickerData = d.result.list.map((t: any) => ({
        symbol: t.symbol,
        lastPrice: t.lastPrice,
        quoteVolume: t.quoteVolume || t.turnover
      }));
      console.log(`✅ Dados obtidos via Bybit (${tickerData.length} pares)`);
    }

    // 1. Obter Trades atualmente abertos na nuvem
    const allSignals = await fetchSignalsFromCloud();
    const opens = allSignals.filter(s => s.resultado === "ABERTO");
    
    const activePairs = new Set(opens.map(s => `${s.par}USDT`));

    const filteredAndSortedPairs = tickerData
      .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.lastPrice) > 0 && parseFloat(t.quoteVolume) > 10000000)
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

    const allPairsMap = new Map();
    filteredAndSortedPairs.slice(0, 25).forEach((t: any) => allPairsMap.set(t.symbol, t));
    
    // Garante as moedas Mnuais/Meme do Lab
    activePairs.forEach(sym => {
      if (!allPairsMap.has(sym)) {
        const found = tickerData.find((t: any) => t.symbol === sym);
        if (found) allPairsMap.set(sym, found);
      }
    });

    const allPairs = Array.from(allPairsMap.values());
    const activePrices: Record<string, number> = {};

    // Roda Analysis Concorrente como o front
    await Promise.all(
      allPairs.map(async (ticker: any) => {
        const pairName = ticker.symbol.replace("USDT", "");
        activePrices[pairName] = parseFloat(ticker.lastPrice);

        try {
          const analysis = await analyzePair(pairName);
          
          if (analysis.score >= 11 && (analysis.action === "Long" || analysis.action === "Short")) {
            const alreadyOpen = opens.find(s => s.par === pairName && s.resultado === "ABERTO");
            if (!alreadyOpen) {
              const entryPrice = parseFloat(ticker.lastPrice);
              console.log(`[NOVO SINAL] -> ${pairName} | ${analysis.action.toUpperCase()} | Score: ${analysis.score}`);
              
              const autoSignal: any = {
                id: `auto-${Date.now()}-${pairName}`,
                dataHora: new Date().toISOString(),
                par: pairName,
                timeframe: analysis.timeframe,
                pontuacao: analysis.score,
                direcao: (analysis.action as string).toUpperCase(),
                precoEntrada: entryPrice,
                precoStop: analysis.setup?.sl,
                targetTP: analysis.setup?.tp,
                rr: analysis.setup?.rr,
                resultado: "ABERTO",
                checklist: analysis.checklist,
                htfBias: analysis.htfBias,
                capitalSimulado: AUTO_CAPITAL,
                alavancagem: ALAVANCAGEM,
                reasons: analysis.reasons,
              };

              await saveSignalToCloud(autoSignal);
            }
          }
        } catch (err) {
          // Ignota falha de api individual da moeda (Bybit Proxy ou Binance sem 1000 candles)
        }
      })
    );

    // Depois de colher precos, rodar monitoramento!
    await monitorTrades(opens, tickerData, activePrices);

  } catch (error: any) {
    console.error(`[ERRO] Loop falhou: ${error.message}`);
  }

  // Agendar proxima rodada
  setTimeout(runDaemonLoop, INTERVALO_SCAN_MS);
}

// Inicia o motor
runDaemonLoop();
