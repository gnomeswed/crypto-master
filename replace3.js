const fs = require("fs");
const path = "lib/SignalContext.tsx";
let content = fs.readFileSync(path, "utf8");

const regex2 = /function buildFechamentoMotivo\([\s\S]*?\n\}/m;
const newBuildMotivo = `function buildFechamentoMotivo(
  tipo: "GREEN" | "LOSS",
  currentPrice: number,
  tp: number,
  sl: number,
  direcao: "LONG" | "SHORT",
): string {
  if (tipo === "GREEN") {
    return \`🎉 Vitória! A operação correu perfeitamente e atingiu nosso alvo de lucro (Take Profit) em $\${currentPrice.toFixed(4)}. Dinheiro no bolso!\`;
  }
  return \`⚠️ Proteção ativada! O mercado não acompanhou nossa projeção, e a operação foi encerrada automaticamente na barreira de segurança (Stop Loss) em $\${currentPrice.toFixed(4)} para proteger nosso capital.\`;
}`;

content = content.replace(regex2, newBuildMotivo);

// Also remove the double replacement inside appendFechamentoRelatorio so we just append the friendly motiv
const regex3 = /function appendFechamentoRelatorio[\s\S]*?return `\$\{existing\}\\n\\n🏁 FECHAMENTO DO SINAL:\\n\$\{friendlyMotivo\}`;/m;
const newAppend = `function appendFechamentoRelatorio(existing: string, motivo: string): string {
  return \`\${existing}\\n\\n🏁 FECHAMENTO DO SINAL:\\n\${motivo}\`;`;

content = content.replace(regex3, newAppend);

fs.writeFileSync(path, content);
console.log("Friendy strings applied.");
