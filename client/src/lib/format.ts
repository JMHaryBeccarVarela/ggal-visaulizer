const nfArs = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfUsd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfInt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nfPct = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtPrice(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Pesos argentinos: "$ 7.250,50" */
export function fmtArs(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `$ ${nfArs.format(n)}`;
}

/** Dólares: "US$ 72.53" */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `US$ ${nfUsd.format(n)}`;
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return nfInt.format(n);
}

const nfNum = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Número compacto (hasta 2 decimales, sin forzarlos). Ej.: 5430 → "5.430". */
export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return nfNum.format(n);
}

/** Recibe una fracción (0.0345) y la muestra como porcentaje ("3,45%"). */
export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${nfPct.format(n * 100)}%`;
}

/** Igual que fmtPct pero con signo explícito (+/−). */
export function fmtSignedPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${nfPct.format(n * 100)}%`;
}

export function fmtDate(yyyymmdd: string | null | undefined): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "—";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-AR", {
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
  return `${d}d ${h % 24}h`;
}

/** Precio del spot según la moneda del activo; sin decimales si es muy grande. */
export function fmtSpot(
  n: number | null | undefined,
  currency: "ARS" | "USD",
  isRate = false,
): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  if (isRate) return `${fmtPrice(n)}%`;
  const body = fmtPrice(n, Math.abs(n) >= 100_000 ? 0 : 2);
  return currency === "USD" ? `US$ ${body}` : `$ ${body}`;
}
