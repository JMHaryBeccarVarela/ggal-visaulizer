import { useMarket } from "../store/market";
import { tnaFromPrice } from "../lib/rates";
import { fmtUsd, fmtSignedPct, fmtPct } from "../lib/format";

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

  return (
    <div className="w">
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

      <div className="futs">
        <div className="frow fhead">
          <span>Futuro</span>
          <span>TNA bid</span>
          <span>TNA ask</span>
        </div>
        {futures.length === 0 ? (
          <div className="empty">{feedEnabled ? "esperando datos…" : "datos en pausa"}</div>
        ) : (
          futures.map((f) => {
            const sref = f.spotRef ?? spotRef;
            const tb = tnaFromPrice(f.bid, sref, f.daysToMaturity);
            const ta = tnaFromPrice(f.ask, sref, f.daysToMaturity);
            return (
              <div className="frow" key={f.symbol}>
                <span className="fl">{f.label}</span>
                <span className="tb">{tb != null ? fmtPct(tb) : "—"}</span>
                <span className="ta">{ta != null ? fmtPct(ta) : "—"}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
