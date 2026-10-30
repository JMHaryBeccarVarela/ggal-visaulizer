import { useEffect, useRef, useState } from "react";
import { fmtArs, fmtUsd, fmtPrice } from "../lib/format";

type Currency = "ARS" | "USD" | "RAW";

function render(value: number | null | undefined, currency: Currency, decimals: number): string {
  if (currency === "ARS") return fmtArs(value);
  if (currency === "USD") return fmtUsd(value);
  return fmtPrice(value, decimals);
}

/** Número que "flashea" verde/rojo cuando cambia de valor. */
export function Price({
  value,
  currency = "RAW",
  decimals = 2,
  className = "",
}: {
  value: number | null | undefined;
  currency?: Currency;
  decimals?: number;
  className?: string;
}) {
  const prev = useRef<number | null | undefined>(undefined);
  const [flash, setFlash] = useState<"" | "flash-bull" | "flash-bear">("");

  useEffect(() => {
    const p = prev.current;
    if (value != null && p != null && value !== p) {
      setFlash(value > p ? "flash-bull" : "flash-bear");
      const t = window.setTimeout(() => setFlash(""), 800);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return (
    <span className={`num rounded px-0.5 ${flash} ${className}`}>
      {render(value, currency, decimals)}
    </span>
  );
}
