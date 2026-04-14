const fs = require("fs");
const path = "lib/SignalContext.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  /\`const fechamentoMotivo = "🖐️ A operação foi encerrada manualmente pelo usuário em \\$" \+ currentPrice\.toFixed\(4\) \+ "\.";\`/g,
  `const fechamentoMotivo = "🖐️ A operação foi encerrada manualmente pelo usuário em $" + currentPrice.toFixed(4) + ".";`
);

fs.writeFileSync(path, content);
console.log("TS Fix Applied.");
