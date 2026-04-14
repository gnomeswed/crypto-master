const fs = require("fs");
const path = "lib/SignalContext.tsx";
let content = fs.readFileSync(path, "utf8");

const regex = /function generateRelatorio\([\s\S]*?\n\n\/\/ ─── Types/m;
const newRelatorioText = `function generateRelatorio(analysis: any, pair: string, entry: number): string {
  const dir    = analysis.action === "Long" ? "COMPRA (Long)" : "VENDA (Short)";
  const cl     = analysis.checklist || {};
  
  let relatorio = \`🎯 SINAL DE \${dir} INICIADO\n\n\`;
  relatorio += \`Este sinal foi aberto porque nossa Inteligência Artificial (SMC) detectou uma forte oportunidade no par \${pair}. \`;
  
  const tempConfluences = [];
  if (cl.sweepConfirmado) tempConfluences.push("captura de liquidez institucional (Sweep)");
  if (cl.chochDetectado) tempConfluences.push("mudança de tendência (CHoCH)");
  if (cl.orderBlockQualidade) tempConfluences.push("um grande bloco de ordens ativo (OB)");
  
  if (tempConfluences.length > 0) {
    relatorio += \`Os principais indicadores que acionaram o alerta foram: \${tempConfluences.join(', ')}. \`;
  }

  if (analysis.indicators?.rsi) {
    const r = analysis.indicators.rsi;
    if (r < 30) relatorio += \`Além disso, o RSI está em \${r.toFixed(0)}, mostrando que o mercado está 'sobrevendido' (barato), o que apoia nossa compra na região.\n\`;
    else if (r > 70) relatorio += \`Além disso, o RSI está em \${r.toFixed(0)}, mostrando que o mercado está 'sobrecomprado' (caro), o que apoia nossa venda na resistência.\n\`;
    else relatorio += "\n";
  } else {
    relatorio += "\n";
  }

  if (analysis.setup) {
    relatorio += \`\n📍 Nossa entrada ideal é em $\${entry.toFixed(4)}.\n\`;
    relatorio += \`✅ Nosso alvo de lucro (Take Profit) está posicionado em $\${analysis.setup.tp.toFixed(4)}.\n\`;
    relatorio += \`🛡️ Nossa proteção (Stop Loss) está blindada em $\${analysis.setup.sl.toFixed(4)}.\n\`;
  }
  
  return relatorio;
}

function appendFechamentoRelatorio(existing: string, motivo: string): string {
  let friendlyMotivo = motivo;
  
  if (motivo.includes("Resultado: GREEN")) {
    friendlyMotivo = "🎉 Vitória! A operação correu perfeitamente e atingiu nosso alvo de lucro planejado (Take Profit). Dinheiro no bolso!";
  } else if (motivo.includes("Resultado: LOSS")) {
    friendlyMotivo = "⚠️ Proteção ativada! O mercado não acompanhou nossa projeção, e a operação foi encerrada automaticamente na nossa barreira de segurança (Stop Loss) para proteger nosso capital.";
  } else if (motivo.includes("🖐️")) {
    friendlyMotivo = "🖐️ A operação foi encerrada manualmente pelo usuário.";
  }
  
  return \`\${existing}\n\n🏁 FECHAMENTO DO SINAL:\n\${friendlyMotivo}\`;
}

// ─── Types`;

content = content.replace(regex, newRelatorioText);
fs.writeFileSync(path, content);
console.log("SignalContext reports replaced.");
