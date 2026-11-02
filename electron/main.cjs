// Widget de escritorio GGAL (Electron).
// Ventana sin bordes, transparente y SIEMPRE-ENCIMA: flota sobre cualquier app
// de la PC (incluso pantalla completa). Reusa la UI del widget (widget.html),
// que se conecta a la API en tiempo real.
//
// Correr:  npm run widget
// Atajos GLOBALES (funcionan en toda la PC, no solo en el navegador):
//   Alt+1        -> mostrar
//   Alt+2        -> esconder
//   Alt+Shift+Q  -> cerrar la app
//
// API: por defecto la de Render. Se puede cambiar con la variable de entorno
//   GGAL_API=https://tu-api  npm run widget

const { app, BrowserWindow, globalShortcut, screen } = require("electron");
const path = require("path");

const WIDTH = 330;
const HEIGHT = 270;
const API = process.env.GGAL_API || "https://ggal-api.onrender.com";

let win = null;
let isQuiting = false;

function createWindow() {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    minWidth: 220,
    minHeight: 170,
    x: sw - WIDTH - 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    maximizable: false,
    minimizable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // Flota por encima de todo, incluso de apps en pantalla completa.
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, "widget.html"), {
    search: "api=" + encodeURIComponent(API),
  });

  // El botón ✕ (y cerrar) esconde en vez de matar la app, así Alt+1 la puede
  // volver a mostrar. Para cerrar de verdad: Alt+Shift+Q.
  win.on("close", (e) => {
    if (!isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("Alt+1", () => {
    if (win) win.show();
  });
  globalShortcut.register("Alt+2", () => {
    if (win) win.hide();
  });
  globalShortcut.register("Alt+Shift+Q", () => {
    isQuiting = true;
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// No cerramos la app al esconder la ventana (en Windows/Linux window-all-closed
// cerraría); la mantenemos viva para poder re-mostrarla con Alt+1.
app.on("window-all-closed", () => {
  if (isQuiting) app.quit();
});
