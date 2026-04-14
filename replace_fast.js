const fs = require("fs");
const path = "lib/SignalContext.tsx";
let content = fs.readFileSync(path, "utf8");

const regex = /const fast = async \(\) => \{[\s\S]*?\n\s+for \(const getProxy of PROXY_LIST\) \{[\s\S]*?\} catch \{ continue; \}\n\s+\}\n\s+\};/m;

const newFast = `const fast = async () => {
      const targetUrl = \`https://api.binance.com/api/v3/ticker/price\`;
      try {
          const res = await fetch(targetUrl, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          if (!data || !Array.isArray(data)) return;
          
          const prices: Record<string, number> = { ...activePrices };
          data.forEach((t: any) => {
            const pairName = t.symbol.replace("USDT", "");
            prices[pairName] = parseFloat(t.price);
            
            // Fallback legado para suporte aos contratos abertos na Bybit (que continham prefixo 1000)
            if (pairName === "PEPE") prices["1000PEPE"] = parseFloat(t.price) * 1000;
            if (pairName === "FLOKI") prices["1000FLOKI"] = parseFloat(t.price) * 1000;
            if (pairName === "BONK") prices["1000BONK"] = parseFloat(t.price) * 1000;
            if (pairName === "SHIB") prices["1000SHIB"] = parseFloat(t.price) * 1000;
          });
          setActivePrices(prices);
      } catch (err) { console.warn("Erro no fast loop:", err); }
    };`;

content = content.replace(regex, newFast);
fs.writeFileSync(path, content);
console.log("Fast loop updated.");
