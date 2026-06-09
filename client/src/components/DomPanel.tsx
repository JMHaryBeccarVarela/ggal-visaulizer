import { useEffect, useMemo, useRef, useState } from "react";
import { useMarket } from "../store/market";
import { fmtBps, fmtInt, fmtPrice, shortSymbol } from "../lib/format";
import type { BookLevel, QuoteSummary } from "../types";

const LEVEL_KEY = "derivados.dom.pinned.v1";

interface RowProps {
  level: BookLevel;
  side: "bid" | "ask";
  isBest: boolean;
  maxSize: number;
  cumPct: number; // 0..1 acumulado del lado (para barra secundaria opcional)
  prevSize: number | null;
}

function Row({ level, side, isBest, maxSize, prevSize }: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prevSize === null || prevSize === level.size) return;
    const el = ref.current;
    if (!el) return;
    const cls = level.size > prevSize ? "flash-bull" : "flash-bear";
    el.classList.remove("flash-bull", "flash-bear");
    void el.offsetWidth;
    el.classList.add(cls);
  }, [level.size, prevSize]);

  const pct = maxSize > 0 ? (level.size / maxSize) * 100 : 0;
  const bg =
    side === "bid"
      ? "rgba(34,197,94,0.18)"
      : "rgba(239,68,68,0.18)";
  const txtPrice = side === "bid" ? "text-bull" : "text-bear";
  const bestRing = isBest
    ? side === "bid"
      ? "ring-1 ring-bull/40"
      : "ring-1 ring-bear/40"
    : "";

  return (
    <div
      ref={ref}
      className={`relative grid grid-cols-[1fr_auto] items-center px-3 py-1 rounded-sm ${bestRing}`}
      style={{
        background: `linear-gradient(to right, ${bg} ${pct}%, transparent ${pct}%)`,
      }}
    >
      <div className={`num font-mono text-sm ${txtPrice} ${isBest ? "font-semibold" : ""}`}>
        {fmtPrice(level.price)}
      </div>
      <div className="num font-mono text-xs text-text">{fmtInt(level.size)}</div>
    </div>
  );
}

function ImbalanceBar({
  bidTotal,
  askTotal,
}: {
  bidTotal: number;
  askTotal: number;
}) {
  const total = bidTotal + askTotal;
  const bidPct = total > 0 ? (bidTotal / total) * 100 : 50;
  const skew = bidPct - 50;
  const tone =
    Math.abs(skew) < 5 ? "text-text-muted" : skew > 0 ? "text-bull" : "text-bear";
  const label =
    Math.abs(skew) < 5
      ? "Balanceado"
      : skew > 0
        ? `+${skew.toFixed(0)}% bid`
        : `${skew.toFixed(0)}% ask`;
  return (
    <div className="px-3 py-2 border-t border-border space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">Imbalance</span>
        <span className={`num font-semibold ${tone}`}>{label}</span>
      </div>
      <div className="relative h-2 bg-bg-elev rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-bull"
          style={{ width: `${bidPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-bear"
          style={{ width: `${100 - bidPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-text-dim num">
        <span>{fmtInt(bidTotal)} bid</span>
        <span>{fmtInt(askTotal)} ask</span>
      </div>
    </div>
  );
}

function SpreadRow({ quote }: { quote: QuoteSummary }) {
  const last = quote.last;
  const mid = quote.mid;
  return (
    <div className="px-3 py-2 my-1 border-y border-border bg-bg-elev/40">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">
          Spread{" "}
          <span className="num text-text">
            {quote.spreadAbs !== null ? quote.spreadAbs.toFixed(2) : "—"}
          </span>{" "}
          <span className="text-text-dim">({fmtBps(quote.spreadBps)})</span>
        </span>
        <span className="text-text-muted">
          Last{" "}
          <span className="num text-accent font-semibold">{fmtPrice(last)}</span>
          {mid !== null && (
            <>
              {" "}
              · Mid <span className="num text-text">{fmtPrice(mid)}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function DomPanel() {
  const order = useMarket((s) => s.order);
  const contracts = useMarket((s) => s.contracts);

  const [pinned, setPinned] = useState<string>(() => {
    try {
      return localStorage.getItem(LEVEL_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // Auto-pin al front-month si nada cargado
  useEffect(() => {
    if (!pinned && order.length > 0) {
      setPinned(order[0]!);
    }
  }, [order, pinned]);

  useEffect(() => {
    if (pinned) {
      try {
        localStorage.setItem(LEVEL_KEY, pinned);
      } catch {
        /* ignore */
      }
    }
  }, [pinned]);

  const quote = pinned ? contracts[pinned] : undefined;
  const prevSizes = useRef<Map<string, number>>(new Map());

  const {
    asksReversed,
    bids,
    bidTotal,
    askTotal,
    maxSize,
  } = useMemo(() => {
    const askLevels = quote?.askLevels ?? [];
    const bidLevels = quote?.bidLevels ?? [];
    const bidTotal = bidLevels.reduce((acc, l) => acc + l.size, 0);
    const askTotal = askLevels.reduce((acc, l) => acc + l.size, 0);
    const maxSize = Math.max(
      1,
      ...askLevels.map((l) => l.size),
      ...bidLevels.map((l) => l.size),
    );
    return {
      asksReversed: [...askLevels].reverse(), // peor primero, mejor (top of book) abajo
      bids: bidLevels,
      bidTotal,
      askTotal,
      maxSize,
    };
  }, [quote]);

  // Snapshot de tamaños previos por nivel (key = price) para flash
  const prevSnap = prevSizes.current;
  const nextSnap = new Map<string, number>();
  for (const l of asksReversed) nextSnap.set(`a${l.price}`, l.size);
  for (const l of bids) nextSnap.set(`b${l.price}`, l.size);
  // Defer commit hasta el próximo render
  useEffect(() => {
    prevSizes.current = nextSnap;
  });

  return (
    <div className="panel flex flex-col">
      <div className="panel-title">
        <span>DOM L2</span>
        <select
          className="input text-sm"
          value={pinned}
          onChange={(e) => setPinned(e.target.value)}
        >
          {order.length === 0 && <option value="">—</option>}
          {order.map((s) => (
            <option key={s} value={s}>
              {shortSymbol(s)}
            </option>
          ))}
        </select>
      </div>

      {!quote ? (
        <div className="p-6 text-center text-text-muted text-sm">
          Esperando datos del contrato…
        </div>
      ) : asksReversed.length === 0 && bids.length === 0 ? (
        <div className="p-6 text-center text-text-muted text-sm">
          Sin punta visible (fuera de horario o sin liquidez).
        </div>
      ) : (
        <>
          <div className="px-2 pt-2 flex-1">
            {/* Asks: peor arriba, best ask al pie de la sección ask */}
            <div className="space-y-0.5">
              {asksReversed.map((lvl, idx) => (
                <Row
                  key={`a${lvl.price}`}
                  level={lvl}
                  side="ask"
                  isBest={idx === asksReversed.length - 1}
                  maxSize={maxSize}
                  cumPct={0}
                  prevSize={prevSnap.get(`a${lvl.price}`) ?? null}
                />
              ))}
            </div>

            <SpreadRow quote={quote} />

            {/* Bids: best arriba, peor al pie */}
            <div className="space-y-0.5">
              {bids.map((lvl, idx) => (
                <Row
                  key={`b${lvl.price}`}
                  level={lvl}
                  side="bid"
                  isBest={idx === 0}
                  maxSize={maxSize}
                  cumPct={0}
                  prevSize={prevSnap.get(`b${lvl.price}`) ?? null}
                />
              ))}
            </div>
          </div>

          <ImbalanceBar bidTotal={bidTotal} askTotal={askTotal} />
        </>
      )}
    </div>
  );
}
