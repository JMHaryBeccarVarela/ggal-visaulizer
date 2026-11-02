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
  .last {
    display: flex; align-items: baseline; justify-content: space-between;
    background: rgba(245,158,11,.1); border: 1px solid rgba(245,158,11,.35);
    border-radius: 8px; padding: 5px 10px;
  }
  .last .lbl { color: #8b96a3; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .last .val { color: #fbbf24; font-weight: 600; font-size: 15px; }
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

  const win: Window = await dpip.requestWindow({ width: 330, height: 250 });
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

  // Ctrl+Q esconde el widget también cuando la ventana flotante tiene foco.
  win.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.ctrlKey && e.code === "KeyQ") {
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
