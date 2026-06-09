import { create } from "zustand";
import type {
  MarketStatus,
  PrimaryState,
  QuoteSummary,
} from "../types";

interface MarketState {
  contracts: Record<string, QuoteSummary>;
  order: string[]; // simbolos ordenados por vencimiento
  spot: number | null;
  primaryState: PrimaryState;
  market: MarketStatus | null;
  wsConnected: boolean;
  lastUpdate: number;

  // Acciones
  applySnapshot: (data: {
    contracts: QuoteSummary[];
    spot: number | null;
    ts: number;
  }) => void;
  applyQuote: (q: QuoteSummary) => void;
  setSpot: (v: number | null) => void;
  setStatus: (s: { primaryState: PrimaryState; market: MarketStatus }) => void;
  setWsConnected: (v: boolean) => void;
}

export const useMarket = create<MarketState>((set) => ({
  contracts: {},
  order: [],
  spot: null,
  primaryState: "disconnected",
  market: null,
  wsConnected: false,
  lastUpdate: 0,

  applySnapshot: (data) =>
    set(() => {
      const map: Record<string, QuoteSummary> = {};
      for (const c of data.contracts) map[c.symbol] = c;
      const order = [...data.contracts]
        .sort((a, b) => a.daysToMaturity - b.daysToMaturity)
        .map((c) => c.symbol);
      return {
        contracts: map,
        order,
        spot: data.spot,
        lastUpdate: data.ts,
      };
    }),

  applyQuote: (q) =>
    set((state) => {
      const next = { ...state.contracts, [q.symbol]: q };
      let order = state.order;
      if (!order.includes(q.symbol)) {
        order = [...order, q.symbol].sort((a, b) => {
          const da = next[a]?.daysToMaturity ?? 99999;
          const db = next[b]?.daysToMaturity ?? 99999;
          return da - db;
        });
      }
      return { contracts: next, order, lastUpdate: q.ts };
    }),

  setSpot: (v) => set({ spot: v }),
  setStatus: (s) => set({ primaryState: s.primaryState, market: s.market }),
  setWsConnected: (v) => set({ wsConnected: v }),
}));
