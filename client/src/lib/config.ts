// Base de la API/WS del server.
//
//   - En dev queda vacío → se usan rutas relativas y el proxy de Vite
//     (localhost:8080).
//   - En producción (Netlify), se setea VITE_API_BASE con la URL de Render
//     (ej. https://ggal-api.onrender.com) y el front le pega ahí.

const RAW = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");

export const API_BASE = RAW;

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function wsUrl(): string {
  if (API_BASE) {
    const u = new URL(API_BASE);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/ws`;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}
