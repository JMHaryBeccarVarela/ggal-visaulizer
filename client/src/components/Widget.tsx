import { useEffect, useRef } from "react";
import { useMarket } from "../store/market";
import { tnaFromPrice, spreadColor } from "../lib/rates";
import { fmtUsd, fmtSignedPct, fmtPct, fmtPrice, fmtNum, fmtInt } from "../lib/format";

// Contenido del widget flotante (se monta dentro de la ventana Picture-in-Picture).
// Usa el mismo store global, así que se actualiza en tiempo real con el feed.
export function Widget() {
  const snapshot = useMarket((s) => s.snapshot);
  const feedEnabled = useMarket((s) => s.status?.feedEnabled ?? false);
  const wsConnected = useMarket((s) => s.wsConnected);

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
  useEffect(() => {
    if (adrLast == null || !isFinite(adrLast)) return;
    const p = prev.current;
    if (p != null && adrLast !== p) {
      // ownerDocument.body = el body de la ventana flotante (no el de la página).
      const b = rootRef.current?.ownerDocument?.body;
      if (b) {
        const abs = Math.abs(adrLast - p);
        const [blur, spread, alpha] =
          abs > 0.2 ? [90, 34, 0.9] : abs > 0.1 ? [66, 20, 0.65] : [46, 10, 0.45];
        const rgb = adrLast > p ? "34,197,94" : "239,68,68";
        b.style.transition = "none";
        b.style.boxShadow = `inset 0 0 ${blur}px ${spread}px rgba(${rgb},${alpha})`;
        void b.offsetWidth; // commit del glow
        b.style.transition = "box-shadow .9s ease-out";
        b.style.boxShadow = `inset 0 0 0 0 rgba(${rgb},0)`;
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
