import { useEffect } from "react";
import { Header } from "./components/Header";
import { KPIRow } from "./components/KPIRow";
import { ContractsTable } from "./components/ContractsTable";
import { DomPanel } from "./components/DomPanel";
import { StrategyLibrary } from "./components/StrategyLibrary";
import { connectWs } from "./lib/ws";

export default function App() {
  useEffect(() => {
    connectWs();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-6 py-5 space-y-5">
        <KPIRow />
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 items-start">
          <ContractsTable />
          <DomPanel />
        </div>
        <StrategyLibrary />
        <footer className="text-center text-xs text-text-dim pt-4 pb-8">
          Datos provistos por Primary API (pyRofex) · Matba Rofex · Screener — no operativo
        </footer>
      </main>
    </div>
  );
}
