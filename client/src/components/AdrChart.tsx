import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../lib/config";

interface Bar {
  t: string;
  c: number;
}
interface Point {
  ts: number;
  price: number;
}

const hhmm = (ts: number) =>
  new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-md border border-border bg-bg-elev px-2.5 py-1.5 text-xs shadow-panel">
      <div className="num text-text">US$ {p.price.toFixed(2)}</div>
      <div className="num text-text-dim">{hhmm(p.ts)}</div>
    </div>
  );
}

export function AdrChart() {
  const [points, setPoints] = useState<Point[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(apiUrl("/api/adr/bars"));
        const d = await r.json();
        const pts: Point[] = (d.bars || [])
          .map((b: Bar) => ({ ts: new Date(b.t).getTime(), price: b.c }))
          .filter((p: Point) => isFinite(p.ts) && isFinite(p.price));
        if (alive) {
          setPoints(pts);
          setLoaded(true);
        }
      } catch {
        if (alive) setLoaded(true);
      }
    }
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const last = points.at(-1)?.price ?? null;
  const first = points[0]?.price ?? null;
  const up = last != null && first != null ? last >= first : true;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <section className="panel">
      <div className="panel-title">
        <span>ADR GGAL · intradía</span>
        <span className="text-text-dim font-normal normal-case tracking-normal">5m · Alpaca</span>
      </div>
      <div className="h-48 px-2 py-3">
        {points.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            {loaded ? "Sin datos intradía (fuera de rueda o feed apagado)" : "Cargando…"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="adrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={hhmm}
                tick={{ fill: "#5a6571", fontSize: 11 }}
                stroke="#1f2a36"
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => (v as number).toFixed(2)}
                tick={{ fill: "#5a6571", fontSize: 11 }}
                stroke="#1f2a36"
                width={46}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill="url(#adrGrad)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
