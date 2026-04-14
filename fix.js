const fs = require("fs");
let c = fs.readFileSync("lib/engine.ts", "utf8");

c = c.replace(/const FALLBACK_PROXIES = \[[\s\S]*?throw new Error\("Todos os túneis falharam\."\);\n\}/, `// ═══════════════════════════════════════════════════════════
// FETCH — Binance Direto (Anti-Bloqueios, Super Rápido)
// ═══════════════════════════════════════════════════════════
async function fetchBinanceKline(pair: string, interval: string, limit: string) {
  const mapInterval = (iv) => iv === "15" ? "15m" : iv === "60" ? "1h" : iv === "240" ? "4h" : iv === "D" ? "1d" : iv + "m";
  const binanceIv = mapInterval(interval);
  const targetUrl = \`https://api.binance.com/api/v3/klines?symbol=\${pair}USDT&interval=\${binanceIv}&limit=\${limit}\`;
  const cacheKey = targetUrl;
  const cached = klineCache[cacheKey];
  if (cached && Date.now() - cached.ts < KLINE_TTL) return cached.data;

  const res = await fetch(targetUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Falha na API da Binance");
  const data = await res.json();
  klineCache[cacheKey] = { data, ts: Date.now() };
  return data;
}`);

c = c.replace(/try \{\n\s+const data = await fetchBybit\("\/v5\/market\/kline", \{ symbol: `\$\{pair\}USDT`, interval: "240", limit: "20" \}\);\n\s+if \(\!data.result\?.list \|\| data.result.list.length < 6\) return "NEUTRAL";\n\s+const candles: Candle\[\] = data.result.list.map\(\(c: any\) => \(\{\n\s+timestamp: \+c\[0\], open: \+c\[1\], high: \+c\[2\], low: \+c\[3\], close: \+c\[4\], volume: \+c\[5\]\n\s+\}\)\).reverse\(\);/, `try {
    const data = await fetchBinanceKline(pair, "240", "20");
    if (!data || data.length < 6) return "NEUTRAL";
    const candles: Candle[] = data.map((c: any) => ({
      timestamp: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
    }));`);

c = c.replace(/const data = await fetchBybit\("\/v5\/market\/kline", \{\n\s+symbol: `\$\{pair\}USDT`, interval, limit: "100"\n\s+\}\);\n\s+if \(\!data.result\?.list\?.length\) throw new Error\("Sem dados"\);\n\s+const candles: Candle\[\] = data.result.list.map\(\(c: any\) => \(\{\n\s+timestamp: \+c\[0\], open: \+c\[1\], high: \+c\[2\], low: \+c\[3\], close: \+c\[4\], volume: \+c\[5\]\n\s+\}\)\).reverse\(\);/, `const data = await fetchBinanceKline(pair, interval, "100");
  if (!data || data.length === 0) throw new Error("Sem dados");
  const candles: Candle[] = data.map((c: any) => ({
    timestamp: +c[0], open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
  }));`);

fs.writeFileSync("lib/engine.ts", c);
console.log("engine.ts fixado.");

let s = fs.readFileSync("lib/SignalContext.tsx", "utf8");
s = s.replace(/const PROXY_LIST = \[[\s\S]*?\];/, "");

s = s.replace(/\/\/ ── Loop de preços rápidos para trades ativos \(3s\) ───────[\s\S]*?\}, \[activeTrades\]\);/, `// ── Loop de preços rápidos para trades ativos (3s) ───────
  useEffect(() => {
    if (activeTrades.length === 0) return;
    const fast = async () => {
      const symbols   = activeTrades.map(t => \`"%22\${t.par}USDT"%22\`).join(",");
      const targetUrl = \`https://api.binance.com/api/v3/ticker/price?symbols=[\${symbols.replace(/"/g,'')}]\`;
      try {
        const res = await fetch(targetUrl, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const prices: Record<string, number> = { ...activePrices };
        data.forEach((t: any) => {
          prices[t.symbol.replace("USDT", "")] = parseFloat(t.price);
        });
        setActivePrices(prices);
      } catch {}
    };
    const iv = setInterval(fast, 3000);
    fast();
    return () => clearInterval(iv);
  }, [activeTrades]);`);

s = s.replace(/\/\/ ── Análise principal \(30s\) ──────────────────────────────[\s\S]*?setIsLoading\(false\);\n\s+\}, \[isLoading, monitorTrades, syncActiveTrades\]\);/, `// ── Análise principal (30s) ──────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    let success = false;
    try {
      const targetUrl = "https://api.binance.com/api/v3/ticker/24hr";
      const res = await fetch(targetUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("Binance falhou");
      const tickerData = await res.json();
      if (!Array.isArray(tickerData)) throw new Error("List não array");

      const allPairs = tickerData
        .filter((t: any) => t.symbol.endsWith("USDT") && parseFloat(t.lastPrice) > 0 && parseFloat(t.quoteVolume) > 10000000)
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 25);

      const results = [];
      for (const ticker of allPairs) {
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
                  id:              "auto-" + Date.now() + "-" + pairName,
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

            results.push({
              pair:          pairName,
              score:         analysis.score,
              action:        analysis.action,
              timeframe:     analysis.timeframe,
              statusText:    analysis.checklist?.sweepConfirmado ? "Setup Confirmado" : "Aguardando Sweep",
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
            });
         } catch { continue; }
      }

      setScannedSignals(results.sort((a: any, b: any) => b.score - a.score));
      await monitorTrades(results);
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL);
      success = true;
    } catch (err: any) { 
      console.warn("Falha direta...", err.message); 
    }

    if (!success) setErrorMessage("Falha na conexão Binance. Tentando reconexão...");
    setIsLoading(false);
  }, [isLoading, monitorTrades, syncActiveTrades]);`);

fs.writeFileSync("lib/SignalContext.tsx", s);
console.log("SignalContext.tsx fixado.");
