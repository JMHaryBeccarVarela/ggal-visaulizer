import { useEffect } from "react";
import { Header } from "./components/Header";
import { Price } from "./components/Price";
import { AdrChart } from "./components/AdrChart";
import { useMarket } from "./store/market";
import { connectWs } from "./lib/ws";
import { fetchAdrBars } from "./lib/bars";
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
import type { AdrQuote, LocalQuote } from "./types";

// Relleno de formato condicional según el signo.
function signClass(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "";
  return v > 0 ? "good" : "bad";
}

/** Fila de la tabla de contado (ADR o acción en BYMA). */
function SpotRow({
  name,
  market,
  q,
  highlight,
}: {
  name: string;
  market: string;
  q: AdrQuote | LocalQuote | null;
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

export default function App() {
  useEffect(() => {
    connectWs();
  }, []);

  // Barras intradía del ADR para el gráfico (refresco cada 30s; el server cachea).
  useEffect(() => {
    fetchAdrBars();
    const id = window.setInterval(fetchAdrBars, 30_000);
    return () => window.clearInterval(id);
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

  const { snapshot, status } = useMarket();
  const feedEnabled = status?.feedEnabled ?? false;
  const adr = snapshot?.adr ?? null;
  const spot = snapshot?.spot;
  const futures = snapshot?.futures ?? [];
  const spotUsed = spot?.used ?? "24hs";
  const fx = snapshot?.fx;
  const caucion = snapshot?.caucion;
  const bondArs = fx?.bondArs ?? "AL30";
  const bondUsd = fx?.bondUsd ?? "AL30C";

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

        {/* Dólar CCL: bonos vs GGAL, y valor teórico de la acción */}
        <div className="overflow-x-auto">
          <table className="xl">
            <thead>
              <tr>
                <th className="title" colSpan={8}>
                  Dólar CCL y valor teórico
                </th>
              </tr>
              <tr>
                <th>{bondArs} ({fx?.settlement ?? "24hs"})</th>
                <th>{bondUsd} ({fx?.settlement ?? "24hs"})</th>
                <th>CCL {bondArs}</th>
                <th>CCL GGAL (ADR)</th>
                <th>Brecha GGAL vs bono</th>
                <th>Acción teórica</th>
                <th>GGAL {spotUsed} − teórica</th>
                <th>Caución {caucion?.days ?? 7}d (TNA)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Price value={fx?.bondArsLast} />
                </td>
                <td>
                  <Price value={fx?.bondUsdLast} decimals={3} />
                </td>
                <td className="font-bold">
                  <Price value={fx?.cclBond} />
                </td>
                <td className="font-bold">
                  <Price value={snapshot?.ccl} />
                </td>
                <td className={signClass(fx?.gapPct)}>{fmtSignedPct(fx?.gapPct)}</td>
                <td className="font-bold">
                  <Price value={fx?.theoStock} />
                </td>
                <td className={signClass(fx?.theoDiff)}>
                  {fx?.theoDiff != null
                    ? `${fmtPrice(fx.theoDiff)} (${fmtSignedPct(fx.theoDiffPct)})`
                    : "—"}
                </td>
                <td>{fmtPct(caucion?.tna)}</td>
              </tr>
              <tr>
                <td className="note" colSpan={8}>
                  CCL bono = {bondArs} ÷ {bondUsd} (últimos operados) · CCL GGAL = GGAL{" "}
                  {spotUsed} × {snapshot ? fmtInt(snapshot.adrRatio) : "10"} ÷ ADR · Acción
                  teórica = ADR × CCL {bondArs} ÷ {snapshot ? fmtInt(snapshot.adrRatio) : "10"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Contado: ADR + acción BYMA */}
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
              <SpotRow name="ADR GGAL" market="NYSE/NASDAQ · USD" q={adr} />
              <SpotRow
                name="GGAL 24hs"
                market="BYMA · ARS"
                q={spot?.t24 ?? null}
                highlight={spotUsed === "24hs"}
              />
              <SpotRow
                name="GGAL CI"
                market="BYMA · ARS"
                q={spot?.ci ?? null}
                highlight={spotUsed === "CI"}
              />
            </tbody>
          </table>
        </div>

        {/* Futuros: puntas, tasas implícitas, teórico y cartel */}
        <div className="overflow-x-auto">
          <table className="xl">
            <thead>
              <tr>
                <th className="title" colSpan={17}>
                  Futuros GGAL (Rofex) · tasas vs GGAL {spotUsed}
                </th>
              </tr>
              <tr>
                <th rowSpan={2}>Futuro</th>
                <th rowSpan={2}>Vto.</th>
                <th rowSpan={2}>Días</th>
                <th colSpan={4}>Precios</th>
                <th colSpan={3}>TNA implícita</th>
                <th colSpan={2}>Teórico (caución)</th>
                <th rowSpan={2}>Señal</th>
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
                <th>TNA</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {futures.length === 0 ? (
                <tr>
                  <td className="note" colSpan={17}>
                    {feedEnabled ? "Esperando futuros de GGAL…" : "Sin datos (feed apagado)"}
                  </td>
                </tr>
              ) : (
                futures.map((f) => {
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
                      <td className={spreadClass(spread)}>{fmtPrice(spread)}</td>
                      <td>{fmtPct(f.tnaBid)}</td>
                      <td className="font-bold">{fmtPct(f.tnaLast)}</td>
                      <td>{fmtPct(f.tnaAsk)}</td>
                      <td className="font-bold">{fmtPct(f.tnaTheo)}</td>
                      <td>{fmtPrice(f.theoPrice)}</td>
                      <td
                        className={`c font-bold ${
                          f.signal === "sell" ? "bad" : f.signal === "buy" ? "good" : ""
                        }`}
                      >
                        {sig
                          ? `${sig}${f.signalEdge != null ? ` (${fmtSignedPct(f.signalEdge)})` : ""}`
                          : "—"}
                      </td>
                      <td>{fmtPct(f.rates.tea)}</td>
                      <td>{fmtPrice(f.tradeSpot)}</td>
                      <td>{fmtInt(f.volume)}</td>
                      <td>{fmtInt(f.openInterest)}</td>
                    </tr>
                  );
                })
              )}
              <tr>
                <td className="note" colSpan={17}>
                  TNA bid/ask contra el spot actual · TNA y TEA del último operado contra el
                  spot del instante de la operación (vacío hasta ver una operación en vivo) ·
                  Teórico = cost of carry renovando la caución · Señal si la punta se aleja más de{" "}
                  {fmtPct(caucion?.threshold ?? 0.02)} de TNA de la teórica.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AdrChart />

        <footer className="pb-6 text-[13px] text-text-dim">
          Datos: Primary API (pyRofex · BYMA/Rofex) + Finnhub / Alpaca (ADR). Planilla
          informativa — no operativa.
        </footer>
      </main>
    </div>
  );
}
