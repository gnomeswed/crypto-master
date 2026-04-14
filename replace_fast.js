const fs = require("fs");
const c = fs.readFileSync("lib/SignalContext.tsx", "utf8");

const targetStartText = "    const fast = async () => {";
const targetEndText = "    const iv = setInterval(fast, 3000);";

const iStart = c.indexOf(targetStartText);
const iEnd = c.indexOf(targetEndText);

if (iStart === -1 || iEnd === -1) {
    console.error("Could not find boundaries");
    process.exit(1);
}

const beforeBlock = c.substring(0, iStart);
const afterBlock = c.substring(iEnd);

const newFastBlock = `    const fast = async () => {
      const targetUrl = "https://api.binance.com/api/v3/ticker/price";
      try {
          const res = await fetch(targetUrl, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          if (!data || !Array.isArray(data)) return;
          
          const prices = { ...activePrices };
          data.forEach((t) => {
            const pairName = t.symbol.replace("USDT", "");
            prices[pairName] = parseFloat(t.price);
            
            if (pairName === "PEPE") prices["1000PEPE"] = parseFloat(t.price) * 1000;
            if (pairName === "FLOKI") prices["1000FLOKI"] = parseFloat(t.price) * 1000;
            if (pairName === "BONK") prices["1000BONK"] = parseFloat(t.price) * 1000;
            if (pairName === "SHIB") prices["1000SHIB"] = parseFloat(t.price) * 1000;
          });
          setActivePrices(prices);
      } catch (err) { console.warn("Erro no fast loop:", err); }
    };

`;

fs.writeFileSync("lib/SignalContext.tsx", beforeBlock + newFastBlock + afterBlock);
console.log("Fast loop successfully updated via pure substring replacement!");
