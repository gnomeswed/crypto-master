export type Pair = 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'ADA' | 'XRP' | 'MATIC' | 'AVAX' | 'DOGE' | 'LINK';
export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export const PAIR_TO_SYMBOL: Record<Pair, string> = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT',
  ADA: 'ADAUSDT', XRP: 'XRPUSDT', MATIC: 'MATICUSDT', AVAX: 'AVAXUSDT',
  DOGE: 'DOGEUSDT', LINK: 'LINKUSDT',
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M1: '1 Minuto', M5: '5 Minutos', M15: '15 Minutos',
  H1: '1 Hora', H4: '4 Horas', D1: '1 Dia',
};

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SMCChecklist {
  liquidezIdentificada: boolean;
  sweepConfirmado: boolean;
  chochDetectado: boolean;
  orderBlockQualidade: boolean;
  contextoMacroAlinhado: boolean;
  volumeAlinhado: boolean;
  rrMinimoTresUm: boolean;
  entradaNaReacao: boolean;
}

export interface SMCAnalysis {
  score: number;
  action: 'Long' | 'Short' | 'Aguardar' | 'Evitar';
  reasons: string[];
  checklist: SMCChecklist;
  setup: {
    entry: number;
    tp: number;
    sl: number;
    rr: number;
  };
  bias: number;
  session: {
    name: string;
    color: string;
  };
  indicators: {
    rsi: number;
    ema200: number;
    volume: string;
  };
}

export interface RiskConfig {
  capitalTotal: number;
  riscoPorTradePercentual: number;
}

export interface MarketData {
  symbol: string;
  lastPrice: number;
  prevPrice24h: number;
  changePercent: number;
  PDH: number | null;
  PDL: number | null;
  EQH: number[];
  EQL: number[];
  asiaHigh: number | null;
  asiaLow: number | null;
  timestamp: number;
}

export interface TradeCalculation {
  direcao: 'LONG' | 'SHORT';
  entrada: number;
  stopLoss: number;
  takeProfit?: number;
  distanciaStopPercent: number;
  riscoUsdt: number;
  tamanhoPosicaoUsdt: number;
  quantidadeMoeda: number;
  alavancagemMinima: number;
}

export interface Signal {
  id: string;
  dataHora: string;
  par: string;
  timeframe?: Timeframe;
  pontuacao: number;
  direcao: 'LONG' | 'SHORT' | 'BUSCANDO';
  gatilho?: string;
  precoEntrada: number;
  precoStop: number;
  rr: number;
  resultado: 'ABERTO' | 'GREEN' | 'LOSS' | 'BREAK_EVEN';
  checklist: SMCChecklist;
  targetTP?: number;
  capitalSimulado?: number;
  alavancagem?: number;
  lucroFinalUsdt?: number;
  tradePosition?: TradeCalculation;
}

export interface MetricaSummary {
  totalSinais: number;
  greens: number;
  losses: number;
  abertos: number;
  taxaAcerto: number;
  rrMedioGreens: number;
  sinaisHoje: number;
}

export interface ChartDataPoint {
  data: string;
  acertividade: number;
  totalAcumulado: number;
}
