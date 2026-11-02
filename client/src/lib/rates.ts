// TNA implícita a partir de un precio puntual (bid o ask) de un futuro,
// contra el spot (GGAL 24hs). Misma convención que el server: base 365.
const DAYS_BASIS = 365;

export function tnaFromPrice(
  price: number | null | undefined,
  spot: number | null | undefined,
  days: number | null | undefined,
): number | null {
  if (price == null || spot == null || days == null) return null;
  if (price <= 0 || spot <= 0 || days <= 0) return null;
  return (price / spot - 1) * (DAYS_BASIS / days);
}

// Color del spread de puntas (en pesos): <=10 verde, >10 y <=15 amarillo, >15 rojo.
export function spreadColor(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "#5a6571";
  if (s <= 10) return "#22c55e";
  if (s <= 15) return "#fbbf24";
  return "#ef4444";
}
