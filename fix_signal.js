const fs = require("fs");
const path = "lib/SignalContext.tsx";
let lines = fs.readFileSync(path, "utf8").split("\n");

// Replace PROXY_LIST definition (lines around 104-107)
const pStart = lines.findIndex(l => l.includes("const PROXY_LIST = ["));
const pEnd = lines.findIndex((l, i) => i > pStart && l.includes("];"));
if(pStart !== -1) {
  lines.splice(pStart, pEnd - pStart + 1, "const PROXY_LIST = [(url: string) => url]; // Binance Direto");
}

let content = lines.join("\n");

// Fast loop replace
content = content.replace(/const targetUrl = `https:\/\/api.bybit.com\/v5\/market\/tickers\?category=linear&symbols=\$\{symbols\}&t=\$\{Date.now\(\)\}`;[\s\S]*?break;\n\s+\} catch \{ continue; \}\n\s+\}/, `const targetUrl = \`https://api.binance.com/api/v3/ticker/price?symbols=[\${symbols.replace(/"/g,'')}]\`;
      for (const getProxy of PROXY_LIST) {
        try {
          const res = await fetch(getProxy(targetUrl), { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data || data.length === 0) continue;
          const prices: Record<string, number> = { ...activePrices };
          data.forEach((t: any) => {
            prices[t.symbol.replace("USDT", "")] = parseFloat(t.price);
          });
          setActivePrices(prices);
          break;
        } catch { continue; }
      }`);

content = content.replace(/const targetUrl = `https:\/\/api.bybit.com\/v5\/market\/tickers\?category=linear&t=\$\{Date.now\(\)\}`;[\s\S]*?if \(!tickerData.result\?.list\) continue;\n\n\s+const allPairs = tickerData.result.list/, `const targetUrl = \`https://api.binance.com/api/v3/ticker/24hr\`;
    let success = false;

    for (const getProxy of PROXY_LIST) {
      if (success) break;
      try {
        const res = await fetch(getProxy(targetUrl), { cache: "no-store" });
        if (!res.ok) continue;
        const tickerData = await res.json();
        if (!Array.isArray(tickerData)) continue;

        const allPairs = tickerData`);

content = content.replace(/\.sort\(\(a: any, b: any\) => parseFloat\(b.turnover24h\) - parseFloat\(a.turnover24h\)\)/, `.filter((t: any) => parseFloat(t.quoteVolume) > 10000000)
          .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))`);

content = content.replace(/volume24h:\s+parseFloat\(ticker.turnover24h\),/, "volume24h:     parseFloat(ticker.quoteVolume),");
content = content.replace(/priceChange24h:\s+ticker.price24hPcnt,/, "priceChange24h: (parseFloat(ticker.priceChangePercent) / 100).toFixed(4),");
content = content.replace(/high24h:\s+ticker.highPrice24h,/, "high24h:       ticker.highPrice,");
content = content.replace(/low24h:\s+ticker.lowPrice24h,/, "low24h:        ticker.lowPrice,");

fs.writeFileSync(path, content);
console.log("Migração BYBIT -> BINANCE no SignalContext concluída.");
