import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMarket } from "../store/market";
import { sessionPoints, type ChartPoint } from "../lib/bars";
import type { AssetSnapshot } from "../types";

const hhmm = (ts: number) =>
  new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="border border-border bg-white px-2 py-0.5 text-[13px]">
      <div className="num text-text">US$ {p.price.toFixed(2)}</div>
      <div className="num text-text-dim">{hhmm(p.ts)}</div>
    </div>
  );
}

/** Gráfico intradía del ADR / referencia en dólares del activo elegido. */
export function AdrChart({ asset }: { asset: AssetSnapshot }) {
  const bars = useMarket((s) => (asset.chart ? s.bars[asset.chart] : undefined)) ?? [];
  // El gráfico usa el precio crudo de la referencia (sin el factor de escala).
  const last = asset.ext?.last != null ? asset.ext.last / (asset.extScale || 1) : null;
  const changePct = asset.ext?.changePct ?? null;
  const points = sessionPoints(bars, last);

  // Color por variación del día (vs cierre previo), como Google.
  const down = changePct != null && changePct < 0;
  const color = down ? "#c00000" : "#00803a";

  // Eje X = rueda completa (6.5 h); la línea se va completando hacia la derecha.
  const SESSION_MS = 23_400_000;
  const firstTs = points[0]?.ts ?? 0;
  const endTs = Math.max(firstTs + SESSION_MS, points.at(-1)?.ts ?? firstTs);

  return (
    <section className="panel">
      <div className="panel-title">
        <span>{asset.extLabel ?? asset.chart} · intradía</span>
        <span className="font-normal text-text-dim">
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
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#d9d9d9" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={[firstTs, endTs]}
                allowDataOverflow
                tickFormatter={hhmm}
                tick={{ fill: "#000000", fontSize: 13 }}
                stroke="#000000"
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => (v as number).toFixed(2)}
                tick={{ fill: "#000000", fontSize: 13 }}
                stroke="#000000"
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
