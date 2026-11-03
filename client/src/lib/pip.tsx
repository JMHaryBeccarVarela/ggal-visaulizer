import { createRoot, type Root } from "react-dom/client";
import { Widget } from "../components/Widget";
import { useMarket } from "../store/market";

// Widget flotante "global" usando la Document Picture-in-Picture API:
// abre una ventana chica siempre-encima que flota sobre el resto de las apps.
// Soportado en Chrome/Edge (Chromium 116+). En otros navegadores no existe.
//
// Nota: la barra de título de la ventana (origen + botón cerrar) la dibuja el
// navegador y NO se puede ocultar desde la web. El borde blanco redondeado se
// aplica al contenido.

const WIDGET_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: #ffffff; }
  body {
    height: 100vh;
    border: 2px solid #cbd5e1;
    border-radius: 22px;
    padding: 14px 18px;
    color: #0f172a;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    user-select: none;
    overflow: hidden;
  }
  .w { display: flex; flex-direction: column; gap: 10px; }
  .hdr { display: flex; align-items: center; justify-content: space-between; }
  .ttl { font-weight: 700; color: #d97706; letter-spacing: .06em; font-size: 15px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; }
  .dot.on { background: #16a34a; box-shadow: 0 0 7px #16a34a; }
  .adr { display: flex; align-items: baseline; gap: 8px; }
  .adr .lbl { color: #64748b; font-size: 11px; }
  .adr .px { font-size: 26px; font-weight: 700; }
  .adr .chg { margin-left: auto; font-size: 20px; font-weight: 700; }
  .chg.up { color: #16a34a; } .chg.dn { color: #dc2626; }
  .near {
    background: rgba(245,158,11,.14); border: 1px solid rgba(245,158,11,.45);
    border-radius: 8px; padding: 7px 10px; display: flex; flex-direction: column; gap: 6px;
  }
  .near-hdr { display: flex; justify-content: space-between; align-items: baseline; color: #0f172a; font-weight: 700; font-size: 13px; }
  .near-hdr .days { color: #64748b; font-weight: 400; font-size: 11px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  .pv { text-align: center; color: #64748b; font-size: 11px; }
  .tcol { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .tl { color: #94a3b8; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; }
  .tv { font-weight: 700; font-size: 14px; }
  .tv.bid { color: #16a34a; } .tv.last { color: #d97706; } .tv.ask { color: #dc2626; }
  .near-foot { display: flex; justify-content: space-between; border-top: 1px solid rgba(245,158,11,.4); padding-top: 5px; font-size: 11px; color: #64748b; }
  .near-foot b { color: #0f172a; font-weight: 700; }
  .futs { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .frow { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; font-size: 13px; align-items: baseline; }
  .fhead { color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .fl { color: #0f172a; font-weight: 600; }
  .tb { color: #16a34a; text-align: right; min-width: 56px; }
  .ta { color: #dc2626; text-align: right; min-width: 56px; }
  .empty { color: #94a3b8; font-size: 12px; padding: 4px 0; }
`;

let pipWin: Window | null = null;
let pipRoot: Root | null = null;

export function pipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

export function isWidgetOpen(): boolean {
  return pipWin != null;
}

export async function openWidget(): Promise<void> {
  if (pipWin) {
    pipWin.focus?.();
    return;
  }
  const dpip = (window as unknown as { documentPictureInPicture?: any })
    .documentPictureInPicture;
  if (!dpip) throw new Error("Document Picture-in-Picture no soportado");

  const win: Window = await dpip.requestWindow({ width: 340, height: 305 });
  pipWin = win;

  const font = win.document.createElement("link");
  font.rel = "stylesheet";
  font.href =
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap";
  win.document.head.appendChild(font);

  const style = win.document.createElement("style");
  style.textContent = WIDGET_CSS;
  win.document.head.appendChild(style);
  try {
    win.document.title = "GGAL";
  } catch {
    /* algunos navegadores no dejan setear el título */
  }

  const mount = win.document.createElement("div");
  win.document.body.appendChild(mount);
  pipRoot = createRoot(mount);
  pipRoot.render(<Widget />);

  // Alt+2 esconde el widget también cuando la ventana flotante tiene foco.
  win.addEventListener("keydown", (e: KeyboardEvent) => {
    if (
      e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
      (e.code === "Digit2" || e.code === "Numpad2")
    ) {
      e.preventDefault();
      closeWidget();
    }
  });
  win.addEventListener("pagehide", () => {
    cleanup();
    useMarket.getState().setWidgetOpen(false);
  });

  useMarket.getState().setWidgetOpen(true);
}

function cleanup(): void {
  try {
    pipRoot?.unmount();
  } catch {
    /* ignore */
  }
  pipRoot = null;
  pipWin = null;
}

export function closeWidget(): void {
  if (pipWin) {
    try {
      pipWin.close();
    } catch {
      /* ignore */
    }
    cleanup();
  }
  useMarket.getState().setWidgetOpen(false);
}
