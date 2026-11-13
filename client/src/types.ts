export type Role = "future" | "ci" | "t24" | "index";

export type ConnState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "idle"
  | "disabled";

/** Tipo de activo: de dónde sale el spot de referencia. */
export type AssetKind = "adr" | "index" | "ext" | "rate";

/** Cotización de un instrumento local (acción BYMA, índice o futuro Rofex). */
export interface LocalQuote {
  symbol: string;
  role: Role;
  label: string;
  maturityDate: string | null;
  daysToMaturity: number | null;
  bid: number | null;
  bidSize: number | null;
  ask: number | null;
  askSize: number | null;
  mid: number | null;
  last: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  settlement: number | null;
  volume: number | null;
  openInterest: number | null;
  ref: number | null;
  changeAbs: number | null;
  changePct: number | null;
  ts: number;
}

export interface Rates {
  days: number | null;
  basisAbs: number | null; // F - S
  basisPct: number | null; // F/S - 1
  tna: number | null; // fracción (0.45 = 45%)
  tea: number | null; // fracción
}

export interface FutureQuote extends LocalQuote {
  rates: Rates;
  spotRef: number | null;
  /** Spot en el instante de la última operación del futuro (null si no se vio en vivo). */
  tradeSpot: number | null;
  tradeTs: number | null;
  tnaLast: number | null; // último operado vs tradeSpot
  tnaBid: number | null;
  tnaAsk: number | null;
  tnaTheo: number | null; // cost of carry con la caución
  theoPrice: number | null;
  signal: "buy" | "sell" | null;
  signalEdge: number | null; // diferencia de TNA a favor (fracción)
  /** Solo futuros de tasa (CAUC): diferencia en puntos contra la caución. */
  bidDiff?: number | null;
  lastDiff?: number | null;
  askDiff?: number | null;
}

/** Cotización externa (Finnhub): ADR, BTC/USD, ETF GLD. */
export interface ExtQuote {
  symbol: string;
  last: number | null;
  bid: number | null;
  bidSize: number | null;
  ask: number | null;
  askSize: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  ref: number | null;
  changeAbs: number | null;
  changePct: number | null;
  ts: number;
}

export interface SpotBlock {
  ci: LocalQuote | null;
  t24: LocalQuote | null;
  index: LocalQuote | null;
  used: string; // "24hs" | "CI" | "índice Rofex" | ...
  ref: number | null;
  stale: boolean; // solo hay cierre anterior, sin valor en vivo
  changePct: number | null;
}

/** Todo lo de un activo: spot, referencia externa, futuros y dólar implícito. */
export interface AssetSnapshot {
  id: string;
  label: string;
  kind: AssetKind;
  currency: "ARS" | "USD";
  carry: boolean; // tiene teórico por caución + cartel
  ext: ExtQuote | null;
  extLabel: string | null;
  extScale: number;
  chart: string | null; // símbolo del gráfico intradía
  ratio: number; // acciones locales por ADR
  spot: SpotBlock;
  futures: FutureQuote[];
  ccl: number | null; // dólar implícito vs la referencia en USD
  gapPct: number | null; // ccl / cclBond - 1
  theoSpot: number | null; // referencia USD × CCL bono ÷ ratio
  theoDiff: number | null; // spot real − teórico
  theoDiffPct: number | null;
  signal: "buy" | "sell" | null;
}

/** CCL por bonos. */
export interface FxBlock {
  bondArs: string;
  bondUsd: string;
  settlement: string;
  bondArsLast: number | null;
  bondUsdLast: number | null;
  cclBond: number | null;
}

export interface CaucionBlock {
  days: number | null;
  tna: number | null; // fracción
  shortDays: number | null;
  shortTna: number | null;
  threshold: number; // umbral del cartel (fracción de TNA)
}

export interface DashboardSnapshot {
  assets: Record<string, AssetSnapshot>;
  order: string[];
  fx: FxBlock;
  caucion: CaucionBlock;
  ts: number;
}

export interface MarketStatus {
  open: boolean;
  state: "open" | "pre-open" | "closed" | "weekend";
  nextChange?: { state: string; minutesUntil: number };
}

export interface UsMarketStatus {
  open: boolean;
  state: string;
}

export interface StatusPayload {
  feedEnabled: boolean;
  primaryState: ConnState;
  adrState: ConnState;
  market: MarketStatus;
  usMarket: UsMarketStatus;
}

export type ServerMessage =
  | { type: "snapshot"; data: DashboardSnapshot; ts: number }
  | { type: "status"; data: StatusPayload; ts: number }
  | { type: "pong"; ts: number };
