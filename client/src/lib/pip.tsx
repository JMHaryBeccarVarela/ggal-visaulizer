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
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: #0a0e14; }
  body {
    height: 100vh;
    border: 3px solid #ffffff;
    border-radius: 22px;
    padding: 14px 18px;
    color: #e6edf3;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    user-select: none;
    overflow: hidden;
  }
  @keyframes flashGreen { 0% { background: #114d29; } 100% { background: #0a0e14; } }
  body.flash { animation: flashGreen .7s ease-out; }
  .w { display: flex; flex-direction: column; gap: 10px; }
  .hdr { display: flex; align-items: center; justify-content: space-between; }
  .ttl { font-weight: 700; color: #f59e0b; letter-spacing: .06em; font-size: 15px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #5a6571; }
  .dot.on { background: #22c55e; box-shadow: 0 0 7px #22c55e; }
  .adr { display: flex; align-items: baseline; gap: 8px; }
  .adr .lbl { color: #8b96a3; font-size: 11px; }
  .adr .px { font-size: 26px; font-weight: 600; }
  .adr .chg { margin-left: auto; font-size: 13px; }
  .chg.up { color: #22c55e; } .chg.dn { color: #ef4444; }
  .near {
    background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.35);
    border-radius: 8px; padding: 7px 10px; display: flex; flex-direction: column; gap: 6px;
  }
  .near-hdr { display: flex; justify-content: space-between; align-items: baseline; color: #e6edf3; font-weight: 600; font-size: 13px; }
  .near-hdr .days { color: #8b96a3; font-weight: 400; font-size: 11px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
  .pv { text-align: center; color: #8b96a3; font-size: 11px; }
  .tcol { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .tl { color: #5a6571; font-size: 9.5px; text-transform: uppercase; letter-spacing: .03em; }
  .tv { font-weight: 600; font-size: 14px; }
  .tv.bid { color: #22c55e; } .tv.last { color: #fbbf24; } .tv.ask { color: #ef4444; }
  .near-foot { display: flex; justify-content: space-between; border-top: 1px solid rgba(245,158,11,.25); padding-top: 5px; font-size: 11px; color: #8b96a3; }
  .near-foot b { color: #e6edf3; font-weight: 600; }
  .futs { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #1f2a36; padding-top: 8px; }
  .frow { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; font-size: 13px; align-items: baseline; }
  .fhead { color: #5a6571; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .fl { color: #e6edf3; }
  .tb { color: #22c55e; text-align: right; min-width: 56px; }
  .ta { color: #ef4444; text-align: right; min-width: 56px; }
  .empty { color: #5a6571; font-size: 12px; padding: 4px 0; }
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
