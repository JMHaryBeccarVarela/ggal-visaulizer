import { apiUrl } from "./config";
import { useMarket } from "../store/market";

export interface Bar {
  t: string;
  c: number;
}
export interface ChartPoint {
  ts: number;
  price: number;
}

/** Trae las barras intradía del ADR y las guarda en el store. */
export async function fetchAdrBars(): Promise<void> {
  try {
    const r = await fetch(apiUrl("/api/adr/bars"));
    const d = await r.json();
    useMarket.getState().setAdrBars(Array.isArray(d.bars) ? d.bars : []);
  } catch {
    /* se reintenta en el próximo tick */
  }
}

/**
 * Puntos del gráfico: solo la rueda actual (última fecha con datos) y, como
 * último punto, el precio en vivo del ADR → la línea se mueve en tiempo real.
 */
export function sessionPoints(bars: Bar[], liveLast: number | null): ChartPoint[] {
  const lastBar = bars.at(-1);
  if (!lastBar) return [];
  const lastDay = lastBar.t.slice(0, 10);
  const pts: ChartPoint[] = bars
    .filter((b) => b.t.slice(0, 10) === lastDay && isFinite(b.c))
    .map((b) => ({ ts: new Date(b.t).getTime(), price: b.c }));
  const lastPt = pts.at(-1);
  if (lastPt && liveLast != null && isFinite(liveLast)) {
    const now = Date.now();
    if (now > lastPt.ts + 30_000) pts.push({ ts: now, price: liveLast });
    else pts[pts.length - 1] = { ts: lastPt.ts, price: liveLast };
  }
  return pts;
}
