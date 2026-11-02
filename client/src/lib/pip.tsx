import { createRoot, type Root } from "react-dom/client";
import { Widget } from "../components/Widget";

// Widget flotante "global" usando la Document Picture-in-Picture API:
// abre una ventana chica siempre-encima que flota sobre el resto de las apps.
// Soportado en Chrome/Edge (Chromium 116+). En otros navegadores no existe.

const WIDGET_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: #0a0e14; color: #e6edf3; padding: 12px;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums; user-select: none;
  }
  .w { display: flex; flex-direction: column; gap: 10px; }
  .hdr { display: flex; align-items: center; justify-content: space-between; }
  .ttl { font-weight: 700; color: #f59e0b; letter-spacing: .05em; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #5a6571; }
  .dot.on { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
  .adr { display: flex; align-items: baseline; gap: 8px; border-bottom: 1px solid #1f2a36; padding-bottom: 10px; }
  .adr .lbl { color: #8b96a3; font-size: 11px; }
  .adr .px { font-size: 24px; font-weight: 600; }
  .adr .chg { margin-left: auto; font-size: 12px; }
  .chg.up { color: #22c55e; } .chg.dn { color: #ef4444; }
  .futs { display: flex; flex-direction: column; gap: 4px; }
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

export async function openWidget(onClose?: () => void): Promise<void> {
  if (pipWin) {
    pipWin.focus?.();
    return;
  }
  const dpip = (window as unknown as { documentPictureInPicture?: any })
    .documentPictureInPicture;
  if (!dpip) throw new Error("Document Picture-in-Picture no soportado");

  const win: Window = await dpip.requestWindow({ width: 320, height: 230 });
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
    win.document.title = "GGAL · widget";
  } catch {
    /* algunos navegadores no dejan setear el título */
  }

  const mount = win.document.createElement("div");
  win.document.body.appendChild(mount);
  pipRoot = createRoot(mount);
  pipRoot.render(<Widget />);

  win.addEventListener("pagehide", () => {
    cleanup();
    onClose?.();
  });
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
}
