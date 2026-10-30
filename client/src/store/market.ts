import { create } from "zustand";
import type { DashboardSnapshot, StatusPayload } from "../types";

interface MarketState {
  snapshot: DashboardSnapshot | null;
  status: StatusPayload | null;
  wsConnected: boolean;
  lastUpdate: number;

  applySnapshot: (s: DashboardSnapshot) => void;
  setStatus: (s: StatusPayload) => void;
  setWsConnected: (v: boolean) => void;
}

export const useMarket = create<MarketState>((set) => ({
  snapshot: null,
  status: null,
  wsConnected: false,
  lastUpdate: 0,

  applySnapshot: (s) => set({ snapshot: s, lastUpdate: s.ts }),
  setStatus: (s) => set({ status: s }),
  setWsConnected: (v) => set({ wsConnected: v }),
}));
