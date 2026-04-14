const fs = require("fs");
let p = fs.readFileSync("components/Views/PortfolioView.tsx", "utf8");
p = p.replace(
  /<p className="text-\[10px\] text-slate-300 leading-relaxed">\{trade\.relatorio\}<\/p>/g,
  `<p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono mt-1">{trade.relatorio}</p>`
);
fs.writeFileSync("components/Views/PortfolioView.tsx", p);

let s = fs.readFileSync("lib/SignalContext.tsx", "utf8");
s = s.replace(
  /const relatorio  = `Operação manual de \$\{signal\.action === "Long" \? "compra \(LONG\)" : "venda \(SHORT\)"} em \$\{pair\}USDT\. Score SMC: \$\{signal\.score\}\/16\. Viés H4: \$\{\(signal as any\)\.htfBias \|\| "NEUTRO"\}\. Entrada em \$\$\{entryPrice\.toFixed\(4\)\}, TP \$\$\{signal\.setup\.tp\.toFixed\(4\)\}, SL \$\$\{signal\.setup\.sl\.toFixed\(4\)\} \(RR \$\{signal\.setup\.rr\}:1\)\. Capital: \$\$\{capital\.toFixed\(2\)\} com \$\{leverage\}x\.`;/,
  `const relatorio = generateRelatorio(signal, pair, entryPrice);`
);
fs.writeFileSync("lib/SignalContext.tsx", s);
console.log("Fix aplicado.");
