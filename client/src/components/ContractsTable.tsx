import { useEffect, useRef } from "react";
import { useMarket } from "../store/market";
import {
  fmtBps,
  fmtInt,
  fmtPct,
  fmtPrice,
  shortSymbol,
} from "../lib/format";
import type { QuoteSummary } from "../types";

function PriceCell({
  value,
  prev,
}: {
  value: number | null;
  prev: number | null;
}) {
  const ref = useRef<HTMLTableCellElement>(null);
  useEffect(() => {
    if (value === null || prev === null || value === prev) return;
    const el = ref.current;
    if (!el) return;
    const cls = value > prev ? "flash-bull" : "flash-bear";
    el.classList.remove("flash-bull", "flash-bear");
    void el.offsetWidth; // reset animation
    el.classList.add(cls);
  }, [value, prev]);
  return (
    <td ref={ref} className="num text-right px-3 py-2">
      {fmtPrice(value)}
    </td>
  );
}

function ChangeCell({ c }: { c: QuoteSummary }) {
  if (c.changePct === null) {
    return <td className="num text-right px-3 py-2 text-text-muted">—</td>;
  }
  const up = c.changePct > 0;
  const cls = c.changePct === 0 ? "text-text-muted" : up ? "text-bull" : "text-bear";
  const arrow = c.changePct === 0 ? "" : up ? "▲" : "▼";
  return (
    <td className={`num text-right px-3 py-2 ${cls}`}>
      {arrow} {fmtPct(c.changePct)}
    </td>
  );
}

export function ContractsTable() {
  const order = useMarket((s) => s.order);
  const contracts = useMarket((s) => s.contracts);
  const prevRef = useRef<Record<string, number | null>>({});

  const rows = order.map((s) => contracts[s]).filter(Boolean) as QuoteSummary[];

  return (
    <div className="panel overflow-hidden">
      <div className="panel-title">
        <span>Contratos · Futuros DLR</span>
        <span className="text-text-dim normal-case font-normal">
          {rows.length} contratos · ordenado por vencimiento
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted bg-bg-elev/50">
              <th className="text-left px-3 py-2 font-medium">Contrato</th>
              <th className="text-right px-3 py-2 font-medium">Días</th>
              <th className="text-right px-3 py-2 font-medium">Bid</th>
              <th className="text-right px-3 py-2 font-medium text-text-dim">
                Size
              </th>
              <th className="text-right px-3 py-2 font-medium">Ask</th>
              <th className="text-right px-3 py-2 font-medium text-text-dim">
                Size
              </th>
              <th className="text-right px-3 py-2 font-medium">Spread</th>
              <th className="text-right px-3 py-2 font-medium">Último</th>
              <th className="text-right px-3 py-2 font-medium">Var %</th>
              <th className="text-right px-3 py-2 font-medium">Vol</th>
              <th className="text-right px-3 py-2 font-medium">OI</th>
              <th className="text-right px-3 py-2 font-medium">Settle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-8 text-text-muted">
                  Esperando datos de mercado…
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const prevPx = prevRef.current[c.symbol] ?? null;
              const newPx = c.last ?? c.mid ?? null;
              if (newPx !== null) prevRef.current[c.symbol] = newPx;
              return (
                <tr
                  key={c.symbol}
                  className="border-t border-border/60 hover:bg-bg-hover/40 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold">{shortSymbol(c.symbol)}</div>
                    <div className="text-[10px] text-text-dim">{c.symbol}</div>
                  </td>
                  <td className="num text-right px-3 py-2 text-text-muted">
                    {c.daysToMaturity || "—"}
                  </td>
                  <td className="num text-right px-3 py-2 text-bull">
                    {fmtPrice(c.bid)}
                  </td>
                  <td className="num text-right px-3 py-2 text-text-dim text-xs">
                    {fmtInt(c.bidSize)}
                  </td>
                  <td className="num text-right px-3 py-2 text-bear">
                    {fmtPrice(c.ask)}
                  </td>
                  <td className="num text-right px-3 py-2 text-text-dim text-xs">
                    {fmtInt(c.askSize)}
                  </td>
                  <td className="num text-right px-3 py-2 text-text-muted">
                    {c.spreadBps !== null ? fmtBps(c.spreadBps) : "—"}
                  </td>
                  <PriceCell value={newPx} prev={prevPx} />
                  <ChangeCell c={c} />
                  <td className="num text-right px-3 py-2 text-text-muted">
                    {fmtInt(c.volume)}
                  </td>
                  <td className="num text-right px-3 py-2 text-text-muted">
                    {fmtInt(c.openInterest)}
                  </td>
                  <td className="num text-right px-3 py-2 text-text-muted">
                    {fmtPrice(c.settlement)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
