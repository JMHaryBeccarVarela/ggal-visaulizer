import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMarket } from "../store/market";
import { sessionPoints, type ChartPoint } from "../lib/bars";

const hhmm = (ts: number) =>
  new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="rounded-md border border-border bg-bg-elev px-2.5 py-1.5 text-xs shadow-panel">
      <div className="num text-text">US$ {p.price.toFixed(2)}</div>
      <div className="num text-text-dim">{hhmm(p.ts)}</div>
    </div>
  );
}

export function AdrChart() {
  const bars = useMarket((s) => s.adrBars);
  const adrLast = useMarket((s) => s.snapshot?.adr?.last ?? null);
  const points = sessionPoints(bars, adrLast);

  const first = points[0]?.price ?? null;
  const last = points.at(-1)?.price ?? null;
  const up = last != null && first != null ? last >= first : true;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <section className="panel">
      <div className="panel-title">
        <span>ADR GGAL · intradía</span>
        <span className="text-text-dim font-normal normal-case tracking-normal">
          rueda actual · tiempo real
        </span>
      </div>
      <div className="h-48 px-2 py-3">
        {points.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-dim">
            Sin datos de la rueda (fuera de horario o feed apagado)
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
