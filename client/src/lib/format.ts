const nfPrice = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfPriceWide = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const nfInt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nfPct = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtPrice(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return decimals === 3 ? nfPriceWide.format(n) : nfPrice.format(n);
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return nfInt.format(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${nfPct.format(n * 100)}%`;
}

export function fmtBps(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${nfPct.format(n)} bps`;
}

export function fmtDate(yyyymmdd: string | null): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "—";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(2, 4)}`;
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

export function shortSymbol(symbol: string): string {
  // "DLR/MAY26" -> "MAY26"
  const idx = symbol.indexOf("/");
  return idx >= 0 ? symbol.slice(idx + 1) : symbol;
}
