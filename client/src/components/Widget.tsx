import { useEffect, useRef } from "react";
import { selectAsset, useMarket } from "../store/market";
import { spreadClass, signalText } from "../lib/rates";
import { sessionPoints, type ChartPoint } from "../lib/bars";
import {
  fmtSpot,
  fmtUsd,
  fmtSignedPct,
  fmtPct,
  fmtPrice,
  fmtNum,
  fmtInt,
} from "../lib/format";

// Sparkline (SVG) de la rueda intradía del ADR / referencia.
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

const chgClass = (v: number | null | undefined) =>
  v == null || v === 0 ? "" : v > 0 ? "good" : "bad";

/** Pestañas de activos: se resaltan (y titilan) cuando el activo tiene cartel. */
function Tabs() {
  const snapshot = useMarket((s) => s.snapshot);
  const selected = useMarket((s) => s.selected);
  const setSelected = useMarket((s) => s.setSelected);
  if (!snapshot) return null;
  const current = snapshot.assets[selected] ? selected : snapshot.order[0];
  return (
    <div className="tabs">
      {snapshot.order.map((id) => {
        const a = snapshot.assets[id];
        if (!a) return null;
        return (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={`tab ${id === current ? "sel" : ""} ${a.signal ? `sig-${a.signal}` : ""}`}
            title={signalText(a.signal) ?? undefined}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

// Contenido del widget flotante (se monta dentro de la ventana Picture-in-Picture).
// Usa el mismo store global, así que se actualiza en tiempo real con el feed.
export function Widget() {
  const asset = useMarket(selectAsset);
  const caucion = useMarket((s) => s.snapshot?.caucion ?? null);
  const feedEnabled = useMarket((s) => s.status?.feedEnabled ?? false);
  const wsConnected = useMarket((s) => s.wsConnected);
  const allBars = useMarket((s) => s.bars);

  const live = feedEnabled && wsConnected;
  const isRate = asset?.kind === "rate";
  const ext = asset?.ext ?? null;
  const spotRef = asset?.spot.ref ?? null;
  const futures = asset?.futures ?? [];
  const bars = asset?.chart ? allBars[asset.chart] ?? [] : [];
  // El gráfico usa el precio crudo de la referencia (sin el factor de escala).
  const chartLast = ext?.last != null ? ext.last / (asset?.extScale || 1) : null;

  // Al moverse el spot del activo, todo el widget se tiñe: verde si sube /
  // rojo si baja, con el tono según el tamaño del movimiento (>0,30% fuerte,
  // >0,15% medio, resto suave). Al cambiar de pestaña no se dispara.
  const assetId = asset?.id ?? null;
  const prev = useRef<{ id: string | null; v: number | null }>({ id: null, v: null });
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => {
    if (spotRef == null || !isFinite(spotRef)) return;
    const p = prev.current.id === assetId ? prev.current.v : null;
    if (p != null && spotRef !== p) {
      // ownerDocument.body = el body de la ventana flotante (no el de la página).
      const b = rootRef.current?.ownerDocument?.body;
      if (b) {
        // Tono según la magnitud del movimiento (suave / medio / fuerte).
        const abs = Math.abs(spotRef - p) / p;
        const color = spotRef > p
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
    prev.current = { id: assetId, v: spotRef };
  }, [spotRef, assetId]);

  // Vencimiento más cercano: tasas de bid/último/ask, precios, spread y volumen.
  const nearest = futures[0] ?? null;
  const sig = signalText(nearest?.signal);
  const spread =
    nearest && nearest.ask != null && nearest.bid != null ? nearest.ask - nearest.bid : null;
  const pts = (v: number | null | undefined) =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${fmtPrice(v)}`;

  const spotText = asset ? fmtSpot(spotRef, asset.currency, isRate) : "—";
  // La referencia en dólares va en su propia fila, salvo que ya sea el spot.
  const showExtRow = ext != null && asset?.kind !== "ext";

  return (
    <div className="w" ref={rootRef}>
      <Tabs />

      <table>
        <tbody>
          <tr>
            <td className="l">
              {asset?.label ?? "—"}{" "}
              {asset?.kind === "adr"
                ? asset.spot.used
                : isRate
                  ? "cauc."
                  : asset?.spot.stale
                    ? "cierre ant."
                    : "spot"}
              <span className={`dot ${live ? "on" : ""}`} />
            </td>
            <td className={`big ${spotText.length > 12 ? "long" : ""}`} colSpan={asset?.theoSpot != null ? 1 : 2}>
              {spotText}
            </td>
            {asset?.theoSpot != null && (
              <td className="theo">
                <div>teórico CCL</div>
                <div>{fmtPrice(asset.theoSpot, asset.theoSpot >= 100_000 ? 0 : 2)}</div>
              </td>
            )}
            <td className={`mid c ${chgClass(asset?.spot.changePct)}`}>
              {isRate ? "TNA" : fmtSignedPct(asset?.spot.changePct)}
            </td>
          </tr>
          {showExtRow && (
            <tr>
              <td className="l">{asset?.kind === "adr" ? "ADR" : "USD"}</td>
              <td colSpan={2}>{fmtUsd(ext?.last ?? null)}</td>
              <td className={`c ${chgClass(ext?.changePct)}`}>{fmtSignedPct(ext?.changePct)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {bars.length > 1 && (
        <div className="spark">
          <Spark points={sessionPoints(bars, chartLast)} down={(ext?.changePct ?? 0) < 0} />
        </div>
      )}

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
            {isRate ? (
              <>
                <tr>
                  <td className="l">Tasa %</td>
                  <td className="b">{fmtPrice(nearest.bid)}</td>
                  <td className="b">{fmtPrice(nearest.last)}</td>
                  <td className="b">{fmtPrice(nearest.ask)}</td>
                </tr>
                <tr>
                  <td className="l">
                    Dif. <span className="leg">vs cauc. (pts)</span>
                  </td>
                  <td className={chgClass(nearest.bidDiff)}>{pts(nearest.bidDiff)}</td>
                  <td className={chgClass(nearest.lastDiff)}>{pts(nearest.lastDiff)}</td>
                  <td className={chgClass(nearest.askDiff)}>{pts(nearest.askDiff)}</td>
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <td className="l">TNA</td>
                  <td className="b">{fmtPct(nearest.tnaBid)}</td>
                  <td className="b">{fmtPct(nearest.tnaLast)}</td>
                  <td className="b">{fmtPct(nearest.tnaAsk)}</td>
                </tr>
                <tr>
                  <td className="l">Precio</td>
                  <td>{fmtNum(nearest.bid)}</td>
                  <td>{fmtNum(nearest.last)}</td>
                  <td>{fmtNum(nearest.ask)}</td>
                </tr>
                {asset?.carry && (
                  <tr>
                    <td className="l">
                      Teórico <span className="leg">COC Cauc. {caucion?.days ?? 7}d.</span>
                    </td>
                    <td className="b">{fmtPct(nearest.tnaTheo)}</td>
                    <td colSpan={2}>{fmtNum(nearest.theoPrice)}</td>
                  </tr>
                )}
              </>
            )}
            <tr>
              <td className="l">Spread</td>
              <td className={asset?.kind === "adr" ? spreadClass(spread) : ""}>
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
