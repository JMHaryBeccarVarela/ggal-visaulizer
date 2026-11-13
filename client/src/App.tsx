import { useEffect } from "react";
import { Header } from "./components/Header";
import { Price } from "./components/Price";
import { AdrChart } from "./components/AdrChart";
import { selectAsset, useMarket } from "./store/market";
import { connectWs } from "./lib/ws";
import { fetchBars } from "./lib/bars";
import { openWidget, closeWidget, pipSupported, isWidgetOpen } from "./lib/pip";
import { signalText, spreadClass } from "./lib/rates";
import {
  fmtDate,
  fmtInt,
  fmtPct,
  fmtPrice,
  fmtSignedPct,
  fmtTime,
} from "./lib/format";
import type {
  AssetSnapshot,
  CaucionBlock,
  ExtQuote,
  FxBlock,
  LocalQuote,
} from "./types";

// Relleno de formato condicional según el signo.
function signClass(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "";
  return v > 0 ? "good" : "bad";
}

/** Menú de activos: la pestaña se resalta cuando el activo tiene cartel. */
function AssetTabs() {
  const snapshot = useMarket((s) => s.snapshot);
  const selected = useMarket((s) => s.selected);
  const setSelected = useMarket((s) => s.setSelected);
  if (!snapshot) return null;
  const current = snapshot.assets[selected] ? selected : snapshot.order[0];
  return (
    <div className="flex flex-wrap pl-px">
      {snapshot.order.map((id) => {
        const a = snapshot.assets[id];
        if (!a) return null;
        const sig = a.signal ? `sig-${a.signal}` : "";
        return (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={`tab ${id === current ? "sel" : ""} ${sig}`}
            title={signalText(a.signal) ?? undefined}
          >
            {a.label}
            {a.signal && (a.signal === "sell" ? " ▼" : " ▲")}
          </button>
        );
      })}
    </div>
  );
}

/** Fila de la tabla de contado (acción, índice, ADR o referencia externa). */
function SpotRow({
  name,
  market,
  q,
  highlight,
}: {
  name: string;
  market: string;
  q: ExtQuote | LocalQuote | null;
  highlight?: boolean;
}) {
  return (
    <tr>
      <td className="lbl">
        {name}
        {highlight && <span className="font-normal"> (spot)</span>}
      </td>
      <td className="t">{market}</td>
      <td className="font-bold">
        <Price value={q?.ref} />
      </td>
      <td className={signClass(q?.changePct)}>{fmtSignedPct(q?.changePct)}</td>
      <td>{fmtInt(q?.bidSize)}</td>
      <td>
        <Price value={q?.bid} />
      </td>
      <td>
        <Price value={q?.ask} />
      </td>
      <td>{fmtInt(q?.askSize)}</td>
      <td>{fmtPrice(q?.open)}</td>
      <td>{fmtPrice(q?.prevClose)}</td>
      <td>{fmtPrice(q?.high)}</td>
      <td>{fmtPrice(q?.low)}</td>
      <td>{fmtInt(q?.volume)}</td>
      <td className="c">{fmtTime(q?.ts)}</td>
    </tr>
  );
}

/** Referencias: caución y, si el activo tiene par en dólares, CCL y valor teórico. */
function ReferenceTable({
  asset,
  fx,
  caucion,
}: {
  asset: AssetSnapshot;
  fx: FxBlock;
  caucion: CaucionBlock;
}) {
  const hasUsdPair = asset.currency === "ARS" && asset.ext != null && asset.kind !== "ext";
  const cols: { head: string; cell: React.ReactNode; cls?: string }[] = [];
  if (hasUsdPair) {
    const ratio = fmtInt(asset.ratio);
    cols.push(
      { head: `${fx.bondArs} (${fx.settlement})`, cell: <Price value={fx.bondArsLast} /> },
      { head: `${fx.bondUsd} (${fx.settlement})`, cell: <Price value={fx.bondUsdLast} decimals={3} /> },
      { head: `CCL ${fx.bondArs}`, cell: <Price value={fx.cclBond} />, cls: "font-bold" },
      {
        head: asset.kind === "adr" ? `CCL ${asset.label} (ADR)` : `Dólar implícito ${asset.label}`,
        cell: <Price value={asset.ccl} />,
        cls: "font-bold",
      },
      {
        head: `Brecha ${asset.label} vs bono`,
        cell: fmtSignedPct(asset.gapPct),
        cls: signClass(asset.gapPct),
      },
      {
        head:
          asset.kind === "adr"
            ? `Acción teórica (ADR × CCL ÷ ${ratio})`
            : `${asset.label} teórico (USD × CCL)`,
        cell: <Price value={asset.theoSpot} />,
        cls: "font-bold",
      },
      {
        head: "Spot − teórico",
        cell:
          asset.theoDiff != null
            ? `${fmtPrice(asset.theoDiff)} (${fmtSignedPct(asset.theoDiffPct)})`
            : "—",
        cls: signClass(asset.theoDiff),
      },
    );
  }
  cols.push({ head: `Caución ${caucion.days ?? 7}d (TNA)`, cell: fmtPct(caucion.tna) });
  if (caucion.shortDays != null && caucion.shortDays !== caucion.days) {
    cols.push({ head: `Caución ${caucion.shortDays}d (TNA)`, cell: fmtPct(caucion.shortTna) });
  }
  return (
    <div className="overflow-x-auto">
      <table className="xl">
        <thead>
          <tr>
            <th className="title" colSpan={cols.length}>
              {hasUsdPair ? "Dólar CCL, valor teórico y caución" : "Caución en pesos"}
            </th>
          </tr>
          <tr>
            {cols.map((c) => (
              <th key={c.head}>{c.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cols.map((c) => (
              <td key={c.head} className={c.cls}>
                {c.cell}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Contado: el spot del activo y su referencia en dólares. */
function SpotTable({ asset }: { asset: AssetSnapshot }) {
  if (asset.kind === "rate") return null; // la referencia (caución) ya está arriba
  const { spot, ext, extLabel } = asset;
  return (
    <div className="overflow-x-auto">
      <table className="xl">
        <thead>
          <tr>
            <th className="title" colSpan={14}>
              Contado
            </th>
          </tr>
          <tr>
            <th>Instrumento</th>
            <th>Mercado</th>
            <th>Último</th>
            <th>Var. %</th>
            <th>Cant.</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Cant.</th>
            <th>Apertura</th>
            <th>Cierre ant.</th>
            <th>Máximo</th>
            <th>Mínimo</th>
            <th>Volumen</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          {asset.kind === "adr" && (
            <>
              <SpotRow name={extLabel ?? "ADR"} market="NYSE/NASDAQ · USD" q={ext} />
              <SpotRow
                name={`${asset.label} 24hs`}
                market="BYMA · ARS"
                q={spot.t24}
                highlight={spot.used === "24hs"}
              />
              <SpotRow
                name={`${asset.label} CI`}
                market="BYMA · ARS"
                q={spot.ci}
                highlight={spot.used === "CI"}
              />
            </>
          )}
          {asset.kind === "index" && (
            <>
              <SpotRow
                name={`Índice ${asset.label}`}
                market="Rofex · ARS"
                q={spot.index}
                highlight
              />
              {ext && <SpotRow name={extLabel ?? "Ref."} market="USD" q={ext} />}
            </>
          )}
          {asset.kind === "ext" && (
            <SpotRow
              name={`${asset.label} ref. (${extLabel ?? ""}${
                asset.extScale !== 1 ? ` × ${fmtPrice(asset.extScale)}` : ""
              })`}
              market={asset.currency}
              q={ext}
              highlight
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Futuros de tasa (CAUC): el precio ya es una tasa; se compara contra la caución. */
function RateFuturesTable({ asset }: { asset: AssetSnapshot }) {
  const pts = (v: number | null | undefined) =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${fmtPrice(v)}`;
  return (
    <div className="overflow-x-auto">
      <table className="xl">
        <thead>
          <tr>
            <th className="title" colSpan={11}>
              Futuros {asset.label} (Rofex) · tasa vs caución ({fmtPrice(asset.spot.ref)}%)
            </th>
          </tr>
          <tr>
            <th rowSpan={2}>Futuro</th>
            <th rowSpan={2}>Vto.</th>
            <th rowSpan={2}>Días</th>
            <th colSpan={3}>Tasa (%)</th>
            <th colSpan={3}>Diferencia vs caución (puntos)</th>
            <th rowSpan={2}>Volumen</th>
            <th rowSpan={2}>Int. abierto</th>
          </tr>
          <tr>
            <th>Bid</th>
            <th>Último</th>
            <th>Ask</th>
            <th>Bid</th>
            <th>Último</th>
            <th>Ask</th>
          </tr>
        </thead>
        <tbody>
          {asset.futures.map((f) => (
            <tr key={f.symbol}>
              <td className="lbl">{f.label}</td>
              <td className="c">{fmtDate(f.maturityDate)}</td>
              <td>{f.daysToMaturity ?? "—"}</td>
              <td>
                <Price value={f.bid} />
              </td>
              <td className="font-bold">
                <Price value={f.last} />
              </td>
              <td>
                <Price value={f.ask} />
              </td>
              <td className={signClass(f.bidDiff)}>{pts(f.bidDiff)}</td>
              <td className={signClass(f.lastDiff)}>{pts(f.lastDiff)}</td>
              <td className={signClass(f.askDiff)}>{pts(f.askDiff)}</td>
              <td>{fmtInt(f.volume)}</td>
              <td>{fmtInt(f.openInterest)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Futuros: puntas, tasas implícitas, teórico por caución y cartel. */
function FuturesTable({
  asset,
  caucion,
  feedEnabled,
}: {
  asset: AssetSnapshot;
  caucion: CaucionBlock;
  feedEnabled: boolean;
}) {
  const carry = asset.carry;
  const cols = carry ? 17 : 14;
  // El semáforo del spread está calibrado para acciones (ticks de $1).
  const spreadCls = (s: number | null) => (asset.kind === "adr" ? spreadClass(s) : "");
  return (
    <div className="overflow-x-auto">
      <table className="xl">
        <thead>
          <tr>
            <th className="title" colSpan={cols}>
              Futuros {asset.label} (Rofex) · tasas{asset.currency === "USD" ? " en USD" : ""} vs{" "}
              {asset.kind === "adr" ? `${asset.label} ${asset.spot.used}` : asset.spot.used}
            </th>
          </tr>
          <tr>
            <th rowSpan={2}>Futuro</th>
            <th rowSpan={2}>Vto.</th>
            <th rowSpan={2}>Días</th>
            <th colSpan={4}>Precios</th>
            <th colSpan={3}>TNA implícita</th>
            {carry && <th colSpan={2}>Teórico (caución)</th>}
            {carry && <th rowSpan={2}>Señal</th>}
            <th rowSpan={2}>TEA últ.</th>
            <th rowSpan={2}>Spot al operar</th>
            <th rowSpan={2}>Volumen</th>
            <th rowSpan={2}>Int. abierto</th>
          </tr>
          <tr>
            <th>Bid</th>
            <th>Último</th>
            <th>Ask</th>
            <th>Spread</th>
            <th>Bid</th>
            <th>Último</th>
            <th>Ask</th>
            {carry && <th>TNA</th>}
            {carry && <th>Precio</th>}
          </tr>
        </thead>
        <tbody>
          {asset.futures.length === 0 ? (
            <tr>
              <td className="note" colSpan={cols}>
                {feedEnabled
                  ? `Esperando futuros de ${asset.label}…`
                  : "Sin datos (feed apagado)"}
              </td>
            </tr>
          ) : (
            asset.futures.map((f) => {
              const spread = f.ask != null && f.bid != null ? f.ask - f.bid : null;
              const sig = signalText(f.signal);
              return (
                <tr key={f.symbol}>
                  <td className="lbl">{f.label}</td>
                  <td className="c">{fmtDate(f.maturityDate)}</td>
                  <td>{f.daysToMaturity ?? "—"}</td>
                  <td>
                    <Price value={f.bid} />
                  </td>
                  <td className="font-bold">
                    <Price value={f.last} />
                  </td>
                  <td>
                    <Price value={f.ask} />
                  </td>
                  <td className={spreadCls(spread)}>{fmtPrice(spread)}</td>
                  <td>{fmtPct(f.tnaBid)}</td>
                  <td className="font-bold">{fmtPct(f.tnaLast)}</td>
                  <td>{fmtPct(f.tnaAsk)}</td>
                  {carry && <td className="font-bold">{fmtPct(f.tnaTheo)}</td>}
                  {carry && <td>{fmtPrice(f.theoPrice)}</td>}
                  {carry && (
                    <td
                      className={`c font-bold ${
                        f.signal === "sell" ? "bad" : f.signal === "buy" ? "good" : ""
                      }`}
                    >
                      {sig
                        ? `${sig}${f.signalEdge != null ? ` (${fmtSignedPct(f.signalEdge)})` : ""}`
                        : "—"}
                    </td>
                  )}
                  <td>{fmtPct(f.rates.tea)}</td>
                  <td>{fmtPrice(f.tradeSpot)}</td>
                  <td>{fmtInt(f.volume)}</td>
                  <td>{fmtInt(f.openInterest)}</td>
                </tr>
              );
            })
          )}
          <tr>
            <td className="note" colSpan={cols}>
              TNA bid/ask contra el spot actual · TNA y TEA del último operado contra el spot
              del instante de la operación (vacío hasta ver una operación en vivo)
              {carry
                ? ` · Teórico = cost of carry renovando la caución · Señal si la punta se aleja más de ${fmtPct(
                    caucion.threshold,
                  )} de TNA de la teórica.`
                : " · Sin teórico ni señal: el futuro cotiza en dólares y la caución es en pesos."}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    connectWs();
  }, []);

  // Shortcuts del widget: Alt+1 muestra, Alt+2 esconde.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
      if (e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        if (pipSupported() && !isWidgetOpen()) openWidget().catch(() => {});
      } else if (e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        closeWidget();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const snapshot = useMarket((s) => s.snapshot);
  const feedEnabled = useMarket((s) => s.status?.feedEnabled ?? false);
  const asset = useMarket(selectAsset);
  const chart = asset?.chart ?? null;

  // Barras intradía del gráfico del activo elegido (refresco cada 30s; el server cachea).
  useEffect(() => {
    if (!chart) return;
    fetchBars(chart);
    const id = window.setInterval(() => fetchBars(chart), 30_000);
    return () => window.clearInterval(id);
  }, [chart]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-4">
        {!feedEnabled && (
          <div className="warn border border-border px-3 py-1">
            <b>Datos en pausa.</b> Encendé la traída en tiempo real con el botón{" "}
            <b>▶ Encender datos</b>.
          </div>
        )}

        <AssetTabs />

        {!snapshot || !asset ? (
          <div className="border border-border px-3 py-1 text-text-dim">
            Esperando datos del server…
          </div>
        ) : (
          <>
            {asset.spot.stale && (
              <div className="warn border border-border px-3 py-1">
                <b>Spot de {asset.label} sin valor en vivo:</b> Primary solo informa el cierre
                anterior, así que las tasas contra el spot están desfasadas y no se muestra
                cartel.
              </div>
            )}
            <ReferenceTable asset={asset} fx={snapshot.fx} caucion={snapshot.caucion} />
            <SpotTable asset={asset} />
            {asset.kind === "rate" ? (
              <RateFuturesTable asset={asset} />
            ) : (
              <FuturesTable asset={asset} caucion={snapshot.caucion} feedEnabled={feedEnabled} />
            )}
            {chart && <AdrChart asset={asset} />}
          </>
        )}

        <footer className="pb-6 text-[13px] text-text-dim">
          Datos: Primary API (pyRofex · BYMA/Rofex) + Finnhub / Alpaca (referencias en USD).
          Planilla informativa — no operativa.
        </footer>
      </main>
    </div>
  );
}
