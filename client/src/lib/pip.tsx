import { createRoot, type Root } from "react-dom/client";
import { Widget } from "../components/Widget";
import { useMarket } from "../store/market";

// Widget flotante "global" usando la Document Picture-in-Picture API:
// abre una ventana chica siempre-encima que flota sobre el resto de las apps.
// Soportado en Chrome/Edge (Chromium 116+). En otros navegadores no existe.
//
// Nota: la barra de título de la ventana (origen + botón cerrar) la dibuja el
// navegador y NO se puede ocultar desde la web. El contenido usa la misma
// estética de planilla de Excel que la página.

const WIDGET_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: #ffffff; }
  body {
    height: 100vh;
    padding: 8px;
    color: #000000;
    font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    user-select: none;
    overflow: hidden;
  }
  .w { display: flex; flex-direction: column; gap: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000000; padding: 1px 6px; text-align: right; white-space: nowrap; }
  th { background: #d9d9d9; font-weight: 700; text-align: center; }
  td.l { text-align: left; font-weight: 700; background: #f2f2f2; }
  td.b { font-weight: 700; }
  td.big { font-size: 26px; font-weight: 700; line-height: 1.15; }
  td.mid { font-size: 17px; font-weight: 700; }
  td.sig { text-align: center; font-weight: 700; }
  .good { background: #c6efce; color: #006100; }
  .bad { background: #ffc7ce; color: #9c0006; }
  .warn { background: #ffeb9c; color: #9c5700; }
  .dot { display: inline-block; width: 9px; height: 9px; margin-left: 6px; border: 1px solid #000000; background: #ffffff; }
  .dot.on { background: #00b050; }
  .spark { border: 1px solid #000000; }
  .empty { color: #595959; }
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

  const win: Window = await dpip.requestWindow({ width: 340, height: 310 });
  pipWin = win;

  // Carlito = equivalente métrico de Calibri, para equipos sin Office.
  const font = win.document.createElement("link");
  font.rel = "stylesheet";
  font.href = "https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap";
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
