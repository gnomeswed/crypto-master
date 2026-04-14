import { createClient } from "@supabase/supabase-js";
import { Signal } from "./types";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL    || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// salvar sinal na nuvem
export async function saveSignalToCloud(signal: any) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("signals")
    .upsert([{
      id:                signal.id,
      par:               signal.par,
      pontuacao:         signal.pontuacao,
      direcao:           signal.direcao,
      preco_entrada:     signal.precoEntrada,
      preco_stop:        signal.precoStop,
      target_tp:         signal.targetTP ?? signal.setup?.tp,
      rr:                signal.rr,
      resultado:         signal.resultado,
      checklist:         signal.checklist,
      capital_simulado:  signal.capitalSimulado,
      alavancagem:       signal.alavancagem,
      timeframe:         signal.timeframe,
      htf_bias:          signal.htfBias,
      relatorio:         signal.relatorio,
      reasons:           signal.reasons,
      data_hora:         signal.dataHora ?? new Date().toISOString(),
      data_hora_fim:     signal.dataHoraFim ?? null,
      lucro_final_pct:   signal.lucroFinalPct ?? null,
      fechamento_motivo: signal.fechamentoMotivo ?? null,
    }], { onConflict: "id" });
  if (error) console.error("Erro Supabase save:", error);
  return data;
}

// buscar todos os sinais da nuvem
export async function fetchSignalsFromCloud(): Promise<Signal[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .order("data_hora", { ascending: false })
      .limit(500);
    if (error) { console.error("Erro Supabase fetch:", error); return []; }
    return (data || []).map((row: any): Signal => ({
      id:               row.id,
      dataHora:         row.data_hora,
      dataHoraFim:      row.data_hora_fim ?? undefined,
      par:              row.par,
      pontuacao:        row.pontuacao,
      direcao:          row.direcao,
      precoEntrada:     row.preco_entrada,
      precoStop:        row.preco_stop,
      targetTP:         row.target_tp,
      rr:               row.rr,
      resultado:        row.resultado,
      checklist:        row.checklist,
      capitalSimulado:  row.capital_simulado,
      alavancagem:      row.alavancagem,
      timeframe:        row.timeframe,
      htfBias:          row.htf_bias,
      relatorio:        row.relatorio,
      reasons:          row.reasons,
      lucroFinalUsdt:   row.lucro_final_usdt,
      lucroFinalPct:    row.lucro_final_pct ?? undefined,
      fechamentoMotivo: row.fechamento_motivo ?? undefined,
    } as any));
  } catch { return []; }
}

// atualizar resultado com novos campos de fechamento
export async function updateSignalResult(
  id: string,
  resultado: string,
  lucroFinal?: number,
  lucroFinalPct?: number,
  fechamentoMotivo?: string,
) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("signals")
    .update({
      resultado,
      lucro_final_usdt:  lucroFinal,
      lucro_final_pct:   lucroFinalPct,
      fechamento_motivo: fechamentoMotivo,
      data_hora_fim:     new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error("Erro Supabase update:", error);
  return data;
}
