import { useState } from "react";
import { useMarket } from "../store/market";
import { setFeed } from "../lib/api";
import { pipSupported, openWidget, closeWidget } from "../lib/pip";
import { fmtTime } from "../lib/format";
import type { ConnState } from "../types";

function Dot({ on, warn }: { on: boolean; warn?: boolean }) {
  const color = on ? "bg-bull" : warn ? "bg-accent" : "bg-text-dim";
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${color} ${on ? "animate-pulse" : ""}`} />
  );
}

function Badge({
  label,
  state,
  on,
  warn,
}: {
  label: string;
  state: string;
  on: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg-elev px-2.5 py-1">
      <Dot on={on} warn={warn} />
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text">{state}</span>
    </div>
  );
}

const CONN_LABEL: Record<ConnState, string> = {
  disconnected: "desconectado",
  connecting: "conectando",
  authenticating: "autenticando",
  connected: "conectado",
  idle: "en espera",
  disabled: "no config.",
};

function FeedButton() {
  const feedEnabled = useMarket((s) => s.status?.feedEnabled ?? false);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await setFeed(!feedEnabled);
    } catch {
      /* el status real llega por el WS */
    } finally {
      setPending(false);
    }
  }

  const label = pending
    ? feedEnabled
      ? "Apagando…"
      : "Encendiendo…"
    : feedEnabled
      ? "⏸ Apagar datos"
      : "▶ Encender datos";

  const cls = feedEnabled
    ? "btn border-bear/50 text-bear hover:bg-bear/10"
    : "btn-accent";

  return (
    <button onClick={toggle} disabled={pending} className={`${cls} disabled:opacity-60`}>
      {label}
    </button>
  );
}

function WidgetButton() {
  const open = useMarket((s) => s.widgetOpen);

  async function toggle() {
    if (open) {
      closeWidget();
      return;
    }
    if (!pipSupported()) {
      alert(
        "El widget flotante necesita Chrome o Edge (usa la Document Picture-in-Picture API).",
      );
      return;
    }
    try {
      await openWidget();
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      className="btn"
      title="Widget flotante siempre-encima (Alt+1 mostrar · Alt+2 esconder) — Chrome/Edge"
    >
      {open ? "✕ Widget" : "⧉ Widget"}
    </button>
  );
}

export function Header() {
  const { status, wsConnected, lastUpdate } = useMarket();

  const market = status?.market;
  const us = status?.usMarket;
  const primary = status?.primaryState ?? "disconnected";
  const alpaca = status?.alpacaState ?? "disconnected";

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-text">
              GGAL <span className="text-accent">· Tiempo real</span>
            </h1>
            <p className="text-xs text-text-dim">
              ADR (NYSE) · Acción (BYMA) · Futuros (Rofex) · TNA / TEA implícita
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FeedButton />
            <WidgetButton />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            label="BYMA/Rofex"
            state={market?.open ? "abierto" : "cerrado"}
            on={!!market?.open}
          />
          <Badge label="NYSE" state={us?.open ? "abierto" : "cerrado"} on={!!us?.open} />
          <Badge
            label="Primary"
            state={CONN_LABEL[primary]}
            on={primary === "connected"}
            warn={primary === "connecting"}
          />
          <Badge
            label="Alpaca"
            state={CONN_LABEL[alpaca]}
            on={alpaca === "connected"}
            warn={alpaca === "connecting" || alpaca === "authenticating"}
          />
          <div className="flex items-center gap-2 rounded-md border border-border bg-bg-elev px-2.5 py-1">
            <Dot on={wsConnected} />
            <span className="text-xs text-text-muted">Datos</span>
            <span className="num text-xs text-text">{fmtTime(lastUpdate)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
