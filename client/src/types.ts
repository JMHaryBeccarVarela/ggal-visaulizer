export type Role = "future" | "ci" | "t24";

export type ConnState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "idle"
  | "disabled";

/** Cotización de un instrumento local (acción BYMA o futuro Rofex). */
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
}

/** Cotización del ADR (Alpaca). */
export interface AdrQuote {
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
  used: string; // "24hs" | "CI"
  ref: number | null;
}

export interface DashboardSnapshot {
  adr: AdrQuote | null;
  spot: SpotBlock;
  futures: FutureQuote[];
  ccl: number | null;
  adrRatio: number;
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
  alpacaState: ConnState;
  market: MarketStatus;
  usMarket: UsMarketStatus;
}

export type ServerMessage =
  | { type: "snapshot"; data: DashboardSnapshot; ts: number }
  | { type: "status"; data: StatusPayload; ts: number }
  | { type: "pong"; ts: number };
