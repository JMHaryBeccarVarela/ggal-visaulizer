import { create } from "zustand";
import type { AssetSnapshot, DashboardSnapshot, StatusPayload } from "../types";
import type { Bar } from "../lib/bars";

const SELECTED_KEY = "selectedAsset";

function savedSelection(): string {
  try {
    return localStorage.getItem(SELECTED_KEY) || "GGAL";
  } catch {
    return "GGAL";
  }
}

interface MarketState {
  snapshot: DashboardSnapshot | null;
  status: StatusPayload | null;
  wsConnected: boolean;
  lastUpdate: number;
  widgetOpen: boolean;
  selected: string; // id del activo que se está mirando (página y widget)
  bars: Record<string, Bar[]>; // símbolo del gráfico -> barras intradía

  applySnapshot: (s: DashboardSnapshot) => void;
  setStatus: (s: StatusPayload) => void;
  setWsConnected: (v: boolean) => void;
  setWidgetOpen: (v: boolean) => void;
  setSelected: (id: string) => void;
  setBars: (symbol: string, bars: Bar[]) => void;
}

export const useMarket = create<MarketState>((set) => ({
  snapshot: null,
  status: null,
  wsConnected: false,
  lastUpdate: 0,
  widgetOpen: false,
  selected: savedSelection(),
  bars: {},

  // Un server viejo (sin "assets") manda otro formato: se ignora.
  applySnapshot: (s) => {
    if (s && s.assets) set({ snapshot: s, lastUpdate: s.ts });
  },
  setStatus: (s) => set({ status: s }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setWidgetOpen: (v) => set({ widgetOpen: v }),
  setSelected: (id) => {
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      /* sin storage: la selección dura lo que la pestaña */
    }
    set({ selected: id });
  },
  setBars: (symbol, bars) => set((st) => ({ bars: { ...st.bars, [symbol]: bars } })),
}));

/** Activo seleccionado (con fallback al primero si el guardado ya no existe). */
export function selectAsset(st: MarketState): AssetSnapshot | null {
  const snap = st.snapshot;
  if (!snap) return null;
  return snap.assets[st.selected] ?? snap.assets[snap.order[0] ?? ""] ?? null;
}
