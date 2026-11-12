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

// Cartel de arbitraje contra la TNA teórica (cost of carry con la caución).
export function signalText(signal: "buy" | "sell" | null | undefined): string | null {
  if (signal === "sell") return "VENDER FUTURO";
  if (signal === "buy") return "COMPRAR FUTURO";
  return null;
}

// Color del spread de puntas (en pesos): <=10 verde, >10 y <=15 amarillo, >15 rojo.
export function spreadColor(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "#595959";
  if (s <= 10) return "#006100";
  if (s <= 15) return "#9c5700";
  return "#9c0006";
}

// Igual que spreadColor, pero como relleno de celda (formato condicional).
export function spreadClass(s: number | null | undefined): string {
  if (s == null || !isFinite(s)) return "";
  if (s <= 10) return "good";
  if (s <= 15) return "warn";
  return "bad";
}
