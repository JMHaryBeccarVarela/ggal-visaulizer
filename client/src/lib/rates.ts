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
