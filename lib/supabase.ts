import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Apenas inicializa se as chaves existirem para evitar erro de build
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export async function saveSignalToCloud(signal: any) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('signals')
    .insert([{
      par: signal.par,
      pontuacao: signal.pontuacao,
      direcao: signal.direcao,
      preco_entrada: signal.precoEntrada,
      preco_stop: signal.precoStop,
      target_tp: signal.targetTP,
      rr: signal.rr,
      resultado: signal.resultado,
      checklist: signal.checklist
    }]);
  
  if (error) console.error('Erro Supabase:', error);
  return data;
}

export async function fetchSignalsFromCloud() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('data_hora', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar do Supabase:', error);
      return [];
    }
    return data;
  } catch (err) {
    return [];
  }
}
