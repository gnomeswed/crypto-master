const fs = require("fs");

// 1. PortfolioView.tsx
let p = fs.readFileSync("components/Views/PortfolioView.tsx", "utf8");
p = p.replace(
  /<p className="text-\[10px\] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">\{trade\.relatorio\}<\/p>/g,
  `<div className="flex flex-col gap-2">
            <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">{trade.relatorio}</p>
            {trade.resultado === "ABERTO" && (
              <div className="mt-1 text-[10px] text-brand-400 font-bold bg-slate-900/50 px-3 py-1.5 rounded-lg inline-block w-fit border border-brand-500/20">
                📌 Preço Atual MTM: \$\{(currentPrice > 0 ? currentPrice : trade.precoEntrada).toFixed(4)\}
              </div>
            )}
          </div>`
);
fs.writeFileSync("components/Views/PortfolioView.tsx", p);

// 2. MetricCards.tsx
let m = fs.readFileSync("components/Dashboard/MetricCards.tsx", "utf8");

// Add activePrices to useSignals in MetricCards
m = m.replace(
  /const \{ scannedSignals, setSelectedPair, setActiveView \} = useSignals\(\);/,
  `const { scannedSignals, setSelectedPair, setActiveView, activePrices } = useSignals();`
);

// Add activePrices prop to HistExtrato function signature
m = m.replace(
  /function HistExtrato\(\{ signal, onGoToChart \}: \{ signal: Signal; onGoToChart: \(par: string\) => void \}\) \{/,
  `function HistExtrato({ signal, onGoToChart, activePrices }: { signal: Signal; onGoToChart: (par: string) => void; activePrices: any; }) {`
);

// Pass activePrices when HistExtrato is rendered
m = m.replace(
  /<HistExtrato key=\{s\.id \|\| i\} signal=\{s\} onGoToChart=\{handleGoToChart\} \/>/g,
  `<HistExtrato key={s.id || i} signal={s} onGoToChart={handleGoToChart} activePrices={activePrices} />`
);

// Add currentPrice tracking inside HistExtrato and render it inside the relatorio block
m = m.replace(
  /const isOpen = signal.resultado === "ABERTO";/,
  `const isOpen = signal.resultado === "ABERTO";\n  const currentPrice = activePrices ? (activePrices[signal.par] || signal.precoEntrada) : signal.precoEntrada;`
);

m = m.replace(
  /<p className="text-\[9px\] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">\{signal\.relatorio\}<\/p>/,
  `<p className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{signal.relatorio}</p>
              {isOpen && (
                <div className="mt-2 text-[10px] text-brand-400 font-bold bg-slate-950 px-3 py-1.5 rounded-lg inline-block w-fit border border-brand-500/20">
                  📌 Preço Atual MTM: \$\{currentPrice.toFixed(4)\}
                </div>
              )}`
);

fs.writeFileSync("components/Dashboard/MetricCards.tsx", m);

// 3. HistoryView.tsx
let h = fs.readFileSync("components/Views/HistoryView.tsx", "utf8");
h = h.replace(
  /const \{ setSelectedPair, setActiveView \} = useSignals\(\);/,
  `const { setSelectedPair, setActiveView, activePrices } = useSignals();`
);
h = h.replace(
  /const isExpanded = expandedId === s\.id;/,
  `const isExpanded = expandedId === s.id;\n                const currentPrice = activePrices ? (activePrices[s.par] || s.precoEntrada) : s.precoEntrada;`
);
h = h.replace(
  /<ExpandedRow key=\{\`\$\{s\.id\}-exp\`\} s=\{s\} \/>/g,
  `<ExpandedRow key={\`\${s.id}-exp\`} s={s} currentPrice={currentPrice} />`
);

// Update ExpandedRow definition
h = h.replace(
  /function ExpandedRow\(\{ s \}: \{ s: Signal \}\) \{/,
  `function ExpandedRow({ s, currentPrice }: { s: Signal; currentPrice?: number }) {`
);

h = h.replace(
  /<p className="text-\[9px\] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">\{s\.relatorio\}<\/p>/g,
  `<p className="text-[9px] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">{s.relatorio}</p>
                {s.resultado === "ABERTO" && currentPrice && (
                  <div className="mt-2 text-[10px] text-brand-400 font-bold bg-slate-950 px-3 py-1.5 rounded-lg inline-block w-fit border border-brand-500/20">
                    📌 Preço Atual MTM: \$\{currentPrice.toFixed(4)\}
                  </div>
                )}`
);

fs.writeFileSync("components/Views/HistoryView.tsx", h);
console.log("All UIs updated with currentPrice and Relatorio fixes.");
