export interface BookLevel {
  price: number;
  size: number;
}

export interface QuoteSummary {
  symbol: string;
  maturityDate: string | null;
  daysToMaturity: number;
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
  trades: number | null;
  spreadAbs: number | null;
  spreadBps: number | null;
  changeAbs: number | null;
  changePct: number | null;
  bidLevels: BookLevel[];
  askLevels: BookLevel[];
  ts: number;
}

export interface MarketStatus {
  open: boolean;
  state: "open" | "pre-open" | "closed" | "weekend";
  nextChange: { state: string; minutesUntil: number };
}

export type PrimaryState = "disconnected" | "connecting" | "connected" | "idle";

export interface Snapshot {
  contracts: QuoteSummary[];
  spot: number | null;
  ts: number;
}

export type ServerMessage =
  | { type: "snapshot"; data: Snapshot; ts: number }
  | { type: "quote"; data: QuoteSummary; ts: number }
  | { type: "spot"; data: number | null; ts: number }
  | {
      type: "status";
      data: { primaryState: PrimaryState; market: MarketStatus };
      ts: number;
    }
  | { type: "pong"; ts: number };
