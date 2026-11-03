import { useEffect } from "react";
import { Header } from "./components/Header";
import { QuoteCard } from "./components/QuoteCard";
import { FutureCard } from "./components/FutureCard";
import { AdrChart } from "./components/AdrChart";
import { useMarket } from "./store/market";
import { connectWs } from "./lib/ws";
import { fetchAdrBars } from "./lib/bars";
import { openWidget, closeWidget, pipSupported, isWidgetOpen } from "./lib/pip";
import { fmtArs, fmtInt } from "./lib/format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </h2>
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

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {!feedEnabled && (
          <div className="panel border-accent/40 bg-accent/5 px-5 py-3 text-sm text-text-muted">
            ⏸ <span className="font-medium text-text">Datos en pausa.</span> Encendé la
            traída en tiempo real con el botón{" "}
            <span className="text-accent">▶ Encender datos</span> del header.
          </div>
        )}

        {/* Dólar implícito (CCL) */}
        <div className="panel flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-text-dim">
              Dólar implícito (CCL vía GGAL)
            </span>
            <span className="num text-xl font-semibold text-accent-bright">
              {snapshot?.ccl != null ? fmtArs(snapshot.ccl) : "—"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-text-dim">
              Ratio ADR
            </span>
            <span className="num text-sm text-text">
              {snapshot ? `${fmtInt(snapshot.adrRatio)} : 1` : "—"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-text-dim">
              Spot de la tasa
            </span>
            <span className="num text-sm text-text">GGAL {spotUsed}</span>
          </div>
          <p className="ml-auto max-w-xs text-right text-[10px] text-text-dim">
            CCL = precio BYMA × ratio ÷ ADR. TNA/TEA de cada futuro calculadas
            contra GGAL {spotUsed}.
          </p>
        </div>

        {/* Contado: ADR + acción BYMA */}
        <section className="space-y-3">
          <SectionTitle>Contado</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuoteCard
              label="ADR GGAL"
              venue="NYSE/NASDAQ"
              currency="USD"
              disabled={adr === null}
              disabledNote="ADR no configurado · agregá ALPACA_KEY / ALPACA_SECRET en server/.env"
              data={adr}
            />
            <QuoteCard
              label="GGAL"
              venue="BYMA · 24hs"
              currency="ARS"
              accent={spotUsed === "24hs"}
              note={spotUsed === "24hs" ? "spot de la tasa" : undefined}
              disabled={!spot?.t24}
              disabledNote="Sin datos de GGAL 24hs"
              data={spot?.t24 ?? null}
            />
            <QuoteCard
              label="GGAL"
              venue="BYMA · CI"
              currency="ARS"
              accent={spotUsed === "CI"}
              note={spotUsed === "CI" ? "spot de la tasa" : undefined}
              disabled={!spot?.ci}
              disabledNote="Sin datos de GGAL CI"
              data={spot?.ci ?? null}
            />
          </div>
        </section>

        <AdrChart />

        {/* Futuros */}
        <section className="space-y-3">
          <SectionTitle>Futuros · TNA / TEA implícita</SectionTitle>
          {futures.length === 0 ? (
            <div className="panel px-5 py-8 text-center text-sm text-text-dim">
              Esperando futuros de GGAL… (si el server ya conectó y no aparecen,
              revisá el ticker / segmento en <span className="num">server/.env</span>)
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {futures.map((f) => (
                <FutureCard key={f.symbol} fut={f} spotLabel={spotUsed} />
              ))}
            </div>
          )}
        </section>

        <footer className="pb-8 pt-2 text-center text-xs text-text-dim">
          Datos: Primary API (pyRofex · BYMA/Rofex) + Alpaca (ADR). Terminal
          informativa — no operativa.
        </footer>
      </main>
    </div>
  );
}
