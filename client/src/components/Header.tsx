import { useState } from "react";
import { useMarket } from "../store/market";
import { sendSpot } from "../lib/ws";
import { fmtMinutes, fmtTime } from "../lib/format";

const MARKET_LABEL: Record<string, string> = {
  open: "Mercado abierto",
  "pre-open": "Pre-apertura",
  closed: "Cerrado",
  weekend: "Fin de semana",
};

const PRIMARY_LABEL: Record<string, string> = {
  connected: "Primary conectado",
  connecting: "Conectando…",
  disconnected: "Desconectado",
  idle: "En espera",
};

function StatusDot({ state }: { state: string }) {
  const color =
    state === "connected" || state === "open"
      ? "bg-bull"
      : state === "connecting" || state === "pre-open"
        ? "bg-accent"
        : "bg-bear";
  const pulse = state === "connected" || state === "open" ? "animate-pulse" : "";
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${color} ${pulse}`} />
  );
}

export function Header() {
  const spot = useMarket((s) => s.spot);
  const market = useMarket((s) => s.market);
  const primaryState = useMarket((s) => s.primaryState);
  const wsConnected = useMarket((s) => s.wsConnected);
  const lastUpdate = useMarket((s) => s.lastUpdate);
  const contracts = useMarket((s) => s.contracts);
  const order = useMarket((s) => s.order);

  const [spotInput, setSpotInput] = useState<string>("");

  const onSpotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(spotInput.replace(",", "."));
    if (isFinite(v) && v > 0) {
      sendSpot(v);
      setSpotInput("");
    } else if (spotInput.trim() === "") {
      sendSpot(null);
    }
  };

  const useFrontMonth = () => {
    const front = order
      .map((s) => contracts[s])
      .find((c) => c && (c.last || c.mid || c.settlement));
    if (!front) return;
    const px = front.last ?? front.mid ?? front.settlement;
    if (px) sendSpot(px);
  };

  return (
    <header className="border-b border-border bg-bg-surface/80 backdrop-blur sticky top-0 z-20">
      <div className="px-6 py-3 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent to-accent-bright flex items-center justify-center text-bg font-bold">
            $
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">
              Mesa de Futuros DLR
            </div>
            <div className="text-xs text-text-muted">
              Matba Rofex · Primary API
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2">
          <StatusDot state={market?.state ?? "closed"} />
          <span className="text-sm">
            {MARKET_LABEL[market?.state ?? "closed"]}
          </span>
          {market && (
            <span className="text-xs text-text-muted">
              ({market.nextChange.state === "open" ? "abre" : "cierra"} en{" "}
              {fmtMinutes(market.nextChange.minutesUntil)})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusDot state={primaryState} />
          <span className="text-sm">{PRIMARY_LABEL[primaryState]}</span>
        </div>

        <div className="flex items-center gap-2">
          <StatusDot state={wsConnected ? "connected" : "disconnected"} />
          <span className="text-sm">
            {wsConnected ? "Server WS OK" : "Sin server"}
          </span>
        </div>

        <div className="flex-1" />

        <form onSubmit={onSpotSubmit} className="flex items-center gap-2">
          <label className="text-xs text-text-muted">Spot referencia:</label>
          <input
            className="input w-28 text-right"
            type="text"
            inputMode="decimal"
            placeholder={spot ? spot.toFixed(2) : "0,00"}
            value={spotInput}
            onChange={(e) => setSpotInput(e.target.value)}
            title="Tipeá un valor y presioná Enter o Fijar"
          />
          <button
            type="submit"
            className="btn-accent"
            title="Fijar el spot al valor ingresado (dejá vacío para volver al automático)"
          >
            Fijar
          </button>
          <button
            type="button"
            className="btn"
            onClick={useFrontMonth}
            title="Usar el precio del contrato más cercano al vencimiento como spot"
          >
            Usar más cercano
          </button>
        </form>

        <div className="text-xs text-text-muted">
          Última act: <span className="num">{fmtTime(lastUpdate)}</span>
        </div>
      </div>
    </header>
  );
}
