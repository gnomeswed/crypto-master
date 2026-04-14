const fs = require("fs");
let p = fs.readFileSync("components/Dashboard/MetricCards.tsx", "utf8");

// Fix 1: allow expansion on open trades
p = p.replace(
  /onClick=\{\(\) => !isOpen && setExpanded\(p => !p\)\}/g,
  `onClick={() => setExpanded(p => !p)}`
);

// Fix 2: show arrow on open trades
p = p.replace(
  /\{!isOpen && \(\s*expanded\s*\?\s*<ChevronUp className="w-3 h-3 text-slate-500 mt-0\.5" \/>\s*:\s*<ChevronDown className="w-3 h-3 text-slate-600 mt-0\.5" \/>\s*\)\}/g,
  `{expanded ? <ChevronUp className="w-3 h-3 text-slate-500 mt-0.5" /> : <ChevronDown className="w-3 h-3 text-slate-600 mt-0.5" />}`
);

// Fix 3: show details block on open trades
p = p.replace(
  /\{expanded && !isOpen && \(/g,
  `{expanded && (`
);

// Fix 4: add relatorio inside the expanded details grid
p = p.replace(
  /(\s*\{\s*signal\.fechamentoMotivo && \([\s\S]*?\}\s*<\/div>\s*\)\s*\})([\s\S]*?)(\s*<div className="col-span-3 flex gap-2 mt-1">)/g,
  `$1
          {signal.relatorio && (
            <div className="col-span-3 mt-1 p-2 bg-slate-900/50 rounded-lg border border-blue-500/10">
              <p className="text-[7px] font-bold text-blue-500/60 uppercase mb-1">Relatório SMC</p>
              <p className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{signal.relatorio}</p>
            </div>
          )}$3`
);

fs.writeFileSync("components/Dashboard/MetricCards.tsx", p);
console.log("Fix MetricCards aplicado.");
