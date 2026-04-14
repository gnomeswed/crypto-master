const fs = require("fs");
const path = "components/Views/HistoryView.tsx";
let p = fs.readFileSync(path, "utf8");
p = p.replace(
  /<p className="text-\[9px\] text-slate-400 leading-relaxed">\{s\.relatorio\}<\/p>/g,
  `<p className="text-[9px] text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">{s.relatorio}</p>`
);
fs.writeFileSync(path, p);
console.log("HistoryView Fixed");
