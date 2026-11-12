import { useEffect, useRef } from "react";
import { useMarket } from "../store/market";
import { tnaFromPrice, spreadClass, signalText } from "../lib/rates";
import { sessionPoints, type ChartPoint } from "../lib/bars";
import { fmtArs, fmtUsd, fmtSignedPct, fmtPct, fmtPrice, fmtNum, fmtInt } from "../lib/format";

// Sparkline (SVG) de la rueda intradía del ADR.
function Spark({ points, down }: { points: ChartPoint[]; down: boolean }) {
  if (points.length < 2) return null;
  const W = 300;
  const H = 46;
  const SESSION_MS = 23_400_000; // rueda de 6.5 h
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const firstTs = points[0]?.ts ?? 0;
  const lastTs = points[points.length - 1]?.ts ?? firstTs;
  const span = Math.max(firstTs + SESSION_MS, lastTs) - firstTs || 1;
  const x = (ts: number) => ((ts - firstTs) / span) * W;
  const y = (v: number) => H - 2 - ((v - min) / range) * (H - 4);
  const line = points.map((p) => `${x(p.ts).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const color = down ? "#c00000" : "#00803a";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 46, display: "block" }}
    >
      <polygon
        points={`0,${H} ${line} ${x(lastTs).toFixed(1)},${H}`}
        fill={color}
        fillOpacity="0.12"
      />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Contenido del widget flotante (se monta dentro de la ventana Picture-in-Picture).
// Usa el mismo store global, así que se actualiza en tiempo real con el feed.
export function Widget() {
  const snapshot = useMarket((s) => s.snapshot);
  const feedEnabled = useMarket((s) => s.status?.feedEnabled ?? false);
  const wsConnected = useMarket((s) => s.wsConnected);
  const bars = useMarket((s) => s.adrBars);

  const adr = snapshot?.adr ?? null;
  const spot = snapshot?.spot ?? null;
  const local = spot ? (spot.used === "CI" ? spot.ci : spot.t24) : null;
  const spotRef = snapshot?.spot?.ref ?? null;
  const theoStock = snapshot?.fx?.theoStock ?? null; // ADR × CCL bono ÷ ratio
  const caucionDays = snapshot?.caucion?.days ?? 7;
  const futures = snapshot?.futures ?? [];
  const live = feedEnabled && wsConnected;

  // Al moverse el precio en pesos de la acción (spot BYMA), todo el widget se
  // tiñe: verde si sube / rojo si baja, con el tono según el tamaño del
  // movimiento (>0,30% fuerte, >0,15% medio, resto suave).
  const adrLast = adr?.last ?? null;
  const spotLast = local?.last ?? null;
  const prev = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => {
    if (spotLast == null || !isFinite(spotLast)) return;
    const p = prev.current;
    if (p != null && spotLast !== p) {
      // ownerDocument.body = el body de la ventana flotante (no el de la página).
      const b = rootRef.current?.ownerDocument?.body;
      if (b) {
        // Tono según la magnitud del movimiento (suave / medio / fuerte).
        const abs = Math.abs(spotLast - p) / p;
        const color = spotLast > p
          ? abs > 0.003 ? "#00b050" : abs > 0.0015 ? "#92d050" : "#c6efce"
          : abs > 0.003 ? "#ff0000" : abs > 0.0015 ? "#ff7c80" : "#ffc7ce";
        if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
        b.style.transition = "none";
        b.style.background = color;
        void b.offsetWidth; // commit del color
        // Mantiene el color un momento y recién ahí se destiñe a blanco (dura más).
        flashTimer.current = window.setTimeout(() => {
          b.style.transition = "background 1.6s ease-out";
          b.style.background = "#ffffff";
        }, 350);
      }
    }
    prev.current = spotLast;
  }, [spotLast]);

  // Vencimiento más cercano: TNA de bid/último/ask, precios, spread y volumen.
  const nearest = futures[0] ?? null;
  const sref = nearest ? nearest.spotRef ?? spotRef : spotRef;
  const tBid = nearest ? tnaFromPrice(nearest.bid, sref, nearest.daysToMaturity) : null;
  // TNA del último operado: contra el spot del instante de la operación (server).
  const tLast = nearest?.tnaLast ?? null;
  const sig = signalText(nearest?.signal);
  const tAsk = nearest ? tnaFromPrice(nearest.ask, sref, nearest.daysToMaturity) : null;
  const spread =
    nearest && nearest.ask != null && nearest.bid != null ? nearest.ask - nearest.bid : null;

  const chgClass = (v: number | null | undefined) =>
    v == null || v === 0 ? "" : v > 0 ? "good" : "bad";

  return (
    <div className="w" ref={rootRef}>
      <table>
        <tbody>
          <tr>
            <td className="l">
              GGAL {spot?.used ?? ""}
              <span className={`dot ${live ? "on" : ""}`} />
            </td>
            <td className="big">{fmtArs(local?.last ?? null)}</td>
            <td className="theo">
              <div>teórico CCL</div>
              <div>{fmtPrice(theoStock)}</div>
            </td>
            <td className={`mid c ${chgClass(local?.changePct)}`}>
              {local?.changePct != null ? fmtSignedPct(local.changePct) : "—"}
            </td>
          </tr>
          <tr>
            <td className="l">ADR</td>
            <td colSpan={2}>{fmtUsd(adr?.last ?? null)}</td>
            <td className={`c ${chgClass(adr?.changePct)}`}>
              {adr?.changePct != null ? fmtSignedPct(adr.changePct) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="spark">
        <Spark points={sessionPoints(bars, adrLast)} down={(adr?.changePct ?? 0) < 0} />
      </div>

      {nearest && (
        <table>
          <thead>
            <tr>
              <th>
                {nearest.label}
                {nearest.daysToMaturity != null ? ` · ${nearest.daysToMaturity}d` : ""}
              </th>
              <th>Bid</th>
              <th>Últ.</th>
              <th>Ask</th>
            </tr>
          </thead>
          <tbody>
            {sig && (
              <tr>
                <td colSpan={4} className={`sig ${nearest.signal === "sell" ? "bad" : "good"}`}>
                  {sig}
                  {nearest.signalEdge != null ? ` (${fmtSignedPct(nearest.signalEdge)})` : ""}
                </td>
              </tr>
            )}
            <tr>
              <td className="l">TNA</td>
              <td className="b">{tBid != null ? fmtPct(tBid) : "—"}</td>
              <td className="b">{tLast != null ? fmtPct(tLast) : "—"}</td>
              <td className="b">{tAsk != null ? fmtPct(tAsk) : "—"}</td>
            </tr>
            <tr>
              <td className="l">Precio</td>
              <td>{fmtNum(nearest.bid)}</td>
              <td>{fmtNum(nearest.last)}</td>
              <td>{fmtNum(nearest.ask)}</td>
            </tr>
            <tr>
              <td className="l">
                Teórico <span className="leg">COC Cauc. {caucionDays}d.</span>
              </td>
              <td className="b">{nearest.tnaTheo != null ? fmtPct(nearest.tnaTheo) : "—"}</td>
              <td colSpan={2}>{fmtNum(nearest.theoPrice)}</td>
            </tr>
            <tr>
              <td className="l">Spread</td>
              <td className={spreadClass(spread)}>
                {spread != null ? fmtPrice(spread, 2) : "—"}
              </td>
              <td className="l">Vol.</td>
              <td>{fmtInt(nearest.volume)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {futures.length === 0 && (
        <div className="empty">{feedEnabled ? "esperando datos…" : "datos en pausa"}</div>
      )}
    </div>
  );
}
