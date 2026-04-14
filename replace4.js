const fs = require("fs");
const path = "lib/SignalContext.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  /const fechamentoMotivo = `🖐️ Encerramento manual em \$\$\{currentPrice\.toFixed\(4\)\} — Resultado: \$\{result\}\.`;/,
  '`const fechamentoMotivo = "🖐️ A operação foi encerrada manualmente pelo usuário em $" + currentPrice.toFixed(4) + ".";`'
);

fs.writeFileSync(path, content);
console.log("closeTrade motive replaced.");
