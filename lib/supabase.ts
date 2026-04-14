import { createClient } from '@supabase/supabase-js';
import { Signal } from './types';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL    || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ─── Salvar sinal na nuvem (todos os campos) ────────────────
export async function saveSignalToCloud(signal: any) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('signals')
    .upsert([{           // upsert: cria ou atualiza se já existir
      id:               signal.id,
      par:              signal.par,
      pontuacao:        signal.pontuacao,
      direcao:          signal.direcao,
      preco_entrada:    signal.precoEntrada,
      preco_stop:       signal.precoStop,
      target_tp:        signal.targetTP ?? signal.setup?.tp,
      rr:               signal.rr,
      resultado:        signal.resultado,
      checklist:        signal.checklist,
      capital_simulado: signal.capitalSimulado,
      alavancagem:      signal.alavancagem,
      timeframe:        signal.timeframe,
      htf_bias:         signal.htfBias,
      relatorio:        signal.relatorio,
      reasons:          signal.reasons,
      data_hora:        signal.dataHora ?? new Date().toISOString(),
    }], { onConflict: 'id' });

  if (error) console.error('Erro Supabase save:', error);
  return data;
}

// ─── Buscar TODOS os sinais da nuvem ───────────────────────
export async function fetchSignalsFromCloud(): Promise<Signal[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(500);

    if (error) { console.error('Erro Supabase fetch:', error); return []; }

    // Mapeia colunas snake_case → camelCase (modelo Signal)
    return (data || []).map((row: any): Signal => ({
      id:              row.id,
      dataHora:        row.data_hora,
      par:             row.par,
      pontuacao:       row.pontuacao,
      direcao:         row.direcao,
      precoEntrada:    row.preco_entrada,
      precoStop:       row.preco_stop,
      targetTP:        row.target_tp,
      rr:              row.rr,
      resultado:       row.resultado,
      checklist:       row.checklist,
      capitalSimulado: row.capital_simulado,
      alavancagem:     row.alavancagem,
      timeframe:       row.timeframe,
      // Campos extras
      htfBias:         row.htf_bias,
      relatorio:       row.relatorio,
      reasons:         row.reasons,
      lucroFinalUsdt:  row.lucro_final_usdt,
    } as any));
  } catch { return []; }
}

// ─── Atualizar resultado de um sinal na nuvem ────────────
export async function updateSignalResult(id: string, resultado: string, lucroFinal?: number) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('signals')
    .update({ resultado, lucro_final_usdt: lucroFinal })
    .eq('id', id);

  if (error) console.error('Erro Supabase update:', error);
  return data;
}
