import { Price } from "./Price";
import { ChangePill } from "./ChangePill";
import { fmtInt, fmtTime } from "../lib/format";

type Currency = "ARS" | "USD";

export interface QuoteCardProps {
  label: string;
  venue: string;
  currency: Currency;
  accent?: boolean;
  note?: string; // etiqueta chica (ej. "spot de la tasa")
  disabled?: boolean;
  disabledNote?: string;
  data: {
    ref: number | null;
    changePct: number | null;
    changeAbs: number | null;
    bid: number | null;
    bidSize: number | null;
    ask: number | null;
    askSize: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    prevClose: number | null;
    volume: number | null;
    ts: number;
  } | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-text-dim text-xs">{label}</span>
      <span className="num text-sm text-text">{children}</span>
    </div>
  );
}

export function QuoteCard({
  label,
  venue,
  currency,
  accent,
  note,
  disabled,
  disabledNote,
  data,
}: QuoteCardProps) {
  return (
    <div className={`panel flex flex-col ${accent ? "ring-1 ring-accent/40" : ""}`}>
      <div className="panel-title">
        <span className="flex items-center gap-2">
          <span className="text-text">{label}</span>
          <span className="text-text-dim font-normal normal-case tracking-normal">
            {venue}
          </span>
        </span>
        {note && <span className="text-accent text-[10px] normal-case">{note}</span>}
      </div>

      {disabled ? (
        <div className="px-4 py-8 text-center text-text-dim text-sm">
          {disabledNote ?? "No disponible"}
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <Price
              value={data?.ref ?? null}
              currency={currency}
              className="text-3xl font-semibold text-text"
            />
            <ChangePill pct={data?.changePct ?? null} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-5 border-t border-border pt-2">
            <Row label="Bid">
              <Price value={data?.bid ?? null} currency={currency} className="text-bull" />
              {data?.bidSize != null && (
                <span className="text-text-dim text-xs"> ×{fmtInt(data.bidSize)}</span>
              )}
            </Row>
            <Row label="Ask">
              <Price value={data?.ask ?? null} currency={currency} className="text-bear" />
              {data?.askSize != null && (
                <span className="text-text-dim text-xs"> ×{fmtInt(data.askSize)}</span>
              )}
            </Row>
            <Row label="Apertura">
              <Price value={data?.open ?? null} currency={currency} />
            </Row>
            <Row label="Cierre ant.">
              <Price value={data?.prevClose ?? null} currency={currency} />
            </Row>
            <Row label="Máximo">
              <Price value={data?.high ?? null} currency={currency} />
            </Row>
            <Row label="Mínimo">
              <Price value={data?.low ?? null} currency={currency} />
            </Row>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-text-dim">
            <span>Vol: {fmtInt(data?.volume ?? null)}</span>
            <span>{fmtTime(data?.ts)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
