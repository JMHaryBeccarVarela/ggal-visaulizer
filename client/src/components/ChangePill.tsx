import { fmtSignedPct } from "../lib/format";

/** Pill de variación del día (vs cierre previo). Verde si sube, rojo si baja. */
export function ChangePill({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span className="pill-neutral">—</span>;
  }
  const up = pct >= 0;
  return (
    <span className={up ? "pill-bull" : "pill-bear"}>
      <span>{up ? "▲" : "▼"}</span>
      <span className="num">{fmtSignedPct(pct)}</span>
    </span>
  );
}
