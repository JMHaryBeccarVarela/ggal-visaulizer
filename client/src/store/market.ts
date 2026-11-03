import { create } from "zustand";
import type { DashboardSnapshot, StatusPayload } from "../types";
import type { Bar } from "../lib/bars";

interface MarketState {
  snapshot: DashboardSnapshot | null;
  status: StatusPayload | null;
  wsConnected: boolean;
  lastUpdate: number;
  widgetOpen: boolean;
  adrBars: Bar[];

  applySnapshot: (s: DashboardSnapshot) => void;
  setStatus: (s: StatusPayload) => void;
  setWsConnected: (v: boolean) => void;
  setWidgetOpen: (v: boolean) => void;
  setAdrBars: (bars: Bar[]) => void;
}

export const useMarket = create<MarketState>((set) => ({
  snapshot: null,
  status: null,
  wsConnected: false,
  lastUpdate: 0,
  widgetOpen: false,
  adrBars: [],

  applySnapshot: (s) => set({ snapshot: s, lastUpdate: s.ts }),
  setStatus: (s) => set({ status: s }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setWidgetOpen: (v) => set({ widgetOpen: v }),
  setAdrBars: (bars) => set({ adrBars: bars }),
}));
