import { Price } from "./Price";
import { ChangePill } from "./ChangePill";
import { fmtInt, fmtPct, fmtSignedPct, fmtDate, fmtTime } from "../lib/format";
import type { FutureQuote } from "../types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-text-dim text-xs">{label}</span>
      <span className="num text-sm text-text">{children}</span>
    </div>
  );
}

function RateBig({ label, value }: { label: string; value: number | null }) {
  const ok = value !== null && isFinite(value);
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-text-dim">{label}</span>
      <span className={`num text-2xl font-semibold ${ok ? "text-accent-bright" : "text-text-dim"}`}>
        {ok ? fmtPct(value) : "—"}
      </span>
    </div>
  );
}

export function FutureCard({ fut, spotLabel }: { fut: FutureQuote; spotLabel: string }) {
  const r = fut.rates;
  return (
    <div className="panel flex flex-col">
      <div className="panel-title">
        <span className="flex items-center gap-2">
          <span className="text-text">GGAL {fut.label}</span>
          <span className="text-text-dim font-normal normal-case tracking-normal">
            Futuro · Rofex
          </span>
        </span>
        <span className="text-text-dim text-[10px] normal-case">
          {fmtDate(fut.maturityDate)}
          {fut.daysToMaturity != null && ` · ${fut.daysToMaturity}d`}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <Price
            value={fut.ref}
            currency="ARS"
            className="text-3xl font-semibold text-text"
          />
          <ChangePill pct={fut.changePct} />
        </div>

        {/* Bloque de tasas implícitas vs spot */}
        <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
          <div className="flex items-start justify-between">
            <RateBig label="TNA" value={r.tna} />
            <RateBig label="TEA" value={r.tea} />
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-text-dim">Base</span>
              <span className="num text-sm text-text">{fmtSignedPct(r.basisPct)}</span>
              <span className="text-[10px] text-text-dim num">
                {r.days != null ? `${r.days}d` : "—"}
              </span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-text-dim">
            vs GGAL {spotLabel}
            {fut.spotRef != null && (
              <>
                {" "}
                (<span className="num">${fmtInt(fut.spotRef)}</span>)
              </>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-5 border-t border-border pt-2">
          <Row label="Bid">
            <Price value={fut.bid} currency="ARS" className="text-bull" />
            {fut.bidSize != null && (
              <span className="text-text-dim text-xs"> ×{fmtInt(fut.bidSize)}</span>
            )}
          </Row>
          <Row label="Ask">
            <Price value={fut.ask} currency="ARS" className="text-bear" />
            {fut.askSize != null && (
              <span className="text-text-dim text-xs"> ×{fmtInt(fut.askSize)}</span>
            )}
          </Row>
          <Row label="Settlement">
            <Price value={fut.settlement} currency="ARS" />
          </Row>
          <Row label="Interés abierto">{fmtInt(fut.openInterest)}</Row>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-text-dim">
          <span>Vol: {fmtInt(fut.volume)}</span>
          <span>{fmtTime(fut.ts)}</span>
        </div>
      </div>
    </div>
  );
}
