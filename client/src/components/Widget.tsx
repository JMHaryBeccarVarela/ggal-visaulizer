import { useEffect, useRef } from "react";
import { useMarket } from "../store/market";
import { tnaFromPrice, spreadColor } from "../lib/rates";
import { sessionPoints, type ChartPoint } from "../lib/bars";
import { fmtUsd, fmtSignedPct, fmtPct, fmtPrice, fmtNum, fmtInt } from "../lib/format";

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
  const color = down ? "#dc2626" : "#16a34a";
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
  const spotRef = snapshot?.spot?.ref ?? null;
  const futures = snapshot?.futures ?? [];
  const live = feedEnabled && wsConnected;
  const up = (adr?.changePct ?? 0) >= 0;

  // Al moverse el precio del ADR, glow difuminado de todo el widget: verde si
  // sube / rojo si baja, con intensidad según el tamaño del movimiento
  // (>20c fuerte, >10c medio, <=10c suave).
  const adrLast = adr?.last ?? null;
  const prev = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<number | null>(null);
  useEffect(() => {
    if (adrLast == null || !isFinite(adrLast)) return;
    const p = prev.current;
    if (p != null && adrLast !== p) {
      // ownerDocument.body = el body de la ventana flotante (no el de la página).
      const b = rootRef.current?.ownerDocument?.body;
      if (b) {
        // Tono según la magnitud del movimiento (suave / medio / fuerte).
        const abs = Math.abs(adrLast - p);
        const color = adrLast > p
          ? abs > 0.2 ? "#16a34a" : abs > 0.1 ? "#4ade80" : "#bbf7d0"
          : abs > 0.2 ? "#dc2626" : abs > 0.1 ? "#f87171" : "#fecaca";
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
    prev.current = adrLast;
  }, [adrLast]);

  // Vencimiento más cercano: TNA de bid/último/ask, precios, spread y volumen.
  const nearest = futures[0] ?? null;
  const rest = futures.slice(1);
  const sref = nearest ? nearest.spotRef ?? spotRef : spotRef;
  const tBid = nearest ? tnaFromPrice(nearest.bid, sref, nearest.daysToMaturity) : null;
  const tLast = nearest ? tnaFromPrice(nearest.last, sref, nearest.daysToMaturity) : null;
  const tAsk = nearest ? tnaFromPrice(nearest.ask, sref, nearest.daysToMaturity) : null;
  const spread =
    nearest && nearest.ask != null && nearest.bid != null ? nearest.ask - nearest.bid : null;

  return (
    <div className="w" ref={rootRef}>
      <div className="hdr">
        <span className="ttl">GGAL</span>
        <span className={`dot ${live ? "on" : "off"}`} />
      </div>

      <div className="adr">
        <span className="lbl">ADR</span>
        <span className="px">{fmtUsd(adr?.last ?? null)}</span>
        <span className={`chg ${up ? "up" : "dn"}`}>
          {adr?.changePct != null ? fmtSignedPct(adr.changePct) : "—"}
        </span>
      </div>

      <Spark points={sessionPoints(bars, adrLast)} down={(adr?.changePct ?? 0) < 0} />

      {nearest && (
        <div className="near">
          <div className="near-hdr">
            <span>{nearest.label}</span>
            <span className="days">
              {nearest.daysToMaturity != null ? `${nearest.daysToMaturity}d` : ""}
            </span>
          </div>
          <div className="g3">
            <div className="tcol">
              <div className="tl">TNA bid</div>
              <div className="tv bid">{tBid != null ? fmtPct(tBid) : "—"}</div>
            </div>
            <div className="tcol">
              <div className="tl">TNA últ</div>
              <div className="tv last">{tLast != null ? fmtPct(tLast) : "—"}</div>
            </div>
            <div className="tcol">
              <div className="tl">TNA ask</div>
              <div className="tv ask">{tAsk != null ? fmtPct(tAsk) : "—"}</div>
            </div>
          </div>
          <div className="g3">
            <div className="pv">{fmtNum(nearest.bid)}</div>
            <div className="pv">{fmtNum(nearest.last)}</div>
            <div className="pv">{fmtNum(nearest.ask)}</div>
          </div>
          <div className="near-foot">
            <span>
              Spread{" "}
              <b style={{ color: spreadColor(spread) }}>
                {spread != null ? fmtPrice(spread, 2) : "—"}
              </b>
            </span>
            <span>
              Vol <b>{fmtInt(nearest.volume)}</b>
            </span>
          </div>
        </div>
      )}

      <div className="futs">
        {futures.length === 0 ? (
          <div className="empty">{feedEnabled ? "esperando datos…" : "datos en pausa"}</div>
        ) : rest.length === 0 ? null : (
          <>
            <div className="frow fhead">
              <span>Futuro</span>
              <span>TNA bid</span>
              <span>TNA ask</span>
            </div>
            {rest.map((f) => {
              const sr = f.spotRef ?? spotRef;
              const b = tnaFromPrice(f.bid, sr, f.daysToMaturity);
              const a = tnaFromPrice(f.ask, sr, f.daysToMaturity);
              return (
                <div className="frow" key={f.symbol}>
                  <span className="fl">{f.label}</span>
                  <span className="tb">{b != null ? fmtPct(b) : "—"}</span>
                  <span className="ta">{a != null ? fmtPct(a) : "—"}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
