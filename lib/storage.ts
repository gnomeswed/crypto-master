import { Signal, SMCChecklist, RiskConfig, TradeCalculation } from './types';

const STORAGE_KEY = 'crypto_master_signals';

export function loadSignals(): Signal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSignals(signals: Signal[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
}

export function addSignal(signal: Signal): Signal[] {
  const signals = loadSignals();
  const updated = [signal, ...signals];
  saveSignals(updated);
  return updated;
}

export function updateSignal(id: string, updates: Partial<Signal>): Signal[] {
  const signals = loadSignals();
  const updated = signals.map((s) => (s.id === id ? { ...s, ...updates } : s));
  saveSignals(updated);
  return updated;
}

export function deleteSignal(id: string): Signal[] {
  if (typeof window === 'undefined') return [];
  const signals = loadSignals();
  const updated = signals.filter((s) => s.id !== id);
  localStorage.setItem('smc_signals', JSON.stringify(updated));
  return updated;
}

export function loadRiskConfig(): RiskConfig {
  if (typeof window === 'undefined') return { capitalTotal: 1000, riscoPorTradePercentual: 1 };
  const raw = localStorage.getItem('smc_risk_config');
  if (raw) return JSON.parse(raw);
  return { capitalTotal: 1000, riscoPorTradePercentual: 1 }; // defaults
}

export function saveRiskConfig(config: RiskConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('smc_risk_config', JSON.stringify(config));
}

export function calcularPosicaoBybit(
  capitalTotal: number,
  riscoPorTradePercentual: number, // e.g. 1 for 1%
  precoEntrada: number,
  precoStop: number
): TradeCalculation | null {
  if (precoEntrada <= 0 || precoStop <= 0 || precoEntrada === precoStop) return null;

  const riscoDecimal = riscoPorTradePercentual / 100;
  const isLong = precoEntrada > precoStop;
  
  const distanciaStop = isLong 
    ? (precoEntrada - precoStop) / precoEntrada 
    : (precoStop - precoEntrada) / precoEntrada;

  const valorRiscoUsdt = capitalTotal * riscoDecimal;
  const tamanhoPosicaoUsdt = valorRiscoUsdt / distanciaStop;
  const quantidadeMoeda = tamanhoPosicaoUsdt / precoEntrada;
  
  // Alavancagem mínima recomendada para suportar a margem izolada
  const alavancagemMinima = Math.ceil(tamanhoPosicaoUsdt / capitalTotal);

  return {
    direcao: isLong ? 'LONG' : 'SHORT',
    entrada: precoEntrada,
    stopLoss: precoStop,
    distanciaStopPercent: distanciaStop * 100,
    riscoUsdt: valorRiscoUsdt,
    tamanhoPosicaoUsdt,
    quantidadeMoeda,
    alavancagemMinima: Math.max(1, alavancagemMinima)
  };
}

export function generateId(): string {
  return `signal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function calcularRR(entry: number, sl: number, tp: number): number {
  if (!entry || !sl || !tp) return 0;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return 0;
  return Math.round((reward / risk) * 100) / 100;
}

export function calcularPontuacao(checklist: SMCChecklist): number {
  const valores = Object.values(checklist);
  const pontos = valores.filter(Boolean).length;
  // 8 critérios → normalizar para 0-10
  return Math.round((pontos / 8) * 10 * 10) / 10;
}

export function classificarSinal(pontuacao: number): {
  label: string;
  cor: string;
  descricao: string;
} {
  if (pontuacao >= 8) {
    return { label: 'OPERAR', cor: '#22c55e', descricao: 'Setup de alta qualidade confirmado.' };
  }
  if (pontuacao >= 5) {
    return { label: 'AGUARDAR CONFIRMAÇÃO', cor: '#f5a623', descricao: 'Setup parcial — aguardar mais confirmação.' };
  }
  return { label: 'EVITAR', cor: '#ef4444', descricao: 'Sinal fraco. Risco elevado sem confluências.' };
}
