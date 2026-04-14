const fs = require("fs");

// 1. MetricCards.tsx
let m = fs.readFileSync("components/Dashboard/MetricCards.tsx", "utf8");

m = m.replace(
  /function HistExtrato\(\{ signal, onGoToChart, activePrices \}: \{ signal: Signal; onGoToChart: \(par: string\) => void; activePrices: any; \}\) \{/,
  `function HistExtrato({ signal, onGoToChart, activePrices, scannedSignals }: { signal: Signal; onGoToChart: (par: string) => void; activePrices: any; scannedSignals: any[] }) {`
);

m = m.replace(
  /const isOpen = signal\.resultado === "ABERTO";\n\s*const currentPrice = activePrices \? \(activePrices\[signal\.par\] \|\| signal\.precoEntrada\) : signal\.precoEntrada;/,
  `const isOpen = signal.resultado === "ABERTO";
  const priceInfo = scannedSignals?.find((p: any) => p.pair === signal.par);
  let currentPrice = signal.precoEntrada;
  if (activePrices && activePrices[signal.par]) {
      currentPrice = activePrices[signal.par];
  } else if (priceInfo?.lastPrice) {
      currentPrice = parseFloat(priceInfo.lastPrice);
  }`
);

m = m.replace(
  /<HistExtrato key=\{s\.id \|\| i\} signal=\{s\} onGoToChart=\{handleGoToChart\} activePrices=\{activePrices\} \/>/g,
  `<HistExtrato key={s.id || i} signal={s} onGoToChart={handleGoToChart} activePrices={activePrices} scannedSignals={scannedSignals} />`
);

fs.writeFileSync("components/Dashboard/MetricCards.tsx", m);


// 2. HistoryView.tsx
let h = fs.readFileSync("components/Views/HistoryView.tsx", "utf8");

h = h.replace(
  /const \{ setSelectedPair, setActiveView, activePrices \} = useSignals\(\);/,
  `const { setSelectedPair, setActiveView, activePrices, scannedSignals } = useSignals();`
);

h = h.replace(
  /const isExpanded = expandedId === s\.id;\n\s*const currentPrice = activePrices \? \(activePrices\[s\.par\] \|\| s\.precoEntrada\) : s\.precoEntrada;/,
  `const isExpanded = expandedId === s.id;
                const priceInfo = scannedSignals?.find(p => p.pair === s.par);
                let currentPrice = s.precoEntrada;
                if (activePrices && activePrices[s.par]) {
                    currentPrice = activePrices[s.par];
                } else if (priceInfo?.lastPrice) {
                    currentPrice = parseFloat(priceInfo.lastPrice);
                }`
);

fs.writeFileSync("components/Views/HistoryView.tsx", h);
console.log("Fallback price logic updated.");
