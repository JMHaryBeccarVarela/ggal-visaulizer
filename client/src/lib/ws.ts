import { useMarket } from "../store/market";
import { wsUrl } from "./config";
import type { ServerMessage } from "../types";

let socket: WebSocket | null = null;
let reconnectDelay = 1000;
const MAX_DELAY = 15_000;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;

export function connectWs(): void {
  if (socket && socket.readyState !== WebSocket.CLOSED) return;
  const ws = new WebSocket(wsUrl());
  socket = ws;

  ws.onopen = () => {
    reconnectDelay = 1000;
    useMarket.getState().setWsConnected(true);
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 20_000);
  };

  ws.onmessage = (ev) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(ev.data) as ServerMessage;
    } catch {
      return;
    }
    const s = useMarket.getState();
    switch (msg.type) {
      case "snapshot":
        s.applySnapshot(msg.data);
        break;
      case "status":
        s.setStatus(msg.data);
        break;
      case "pong":
      default:
        break;
    }
  };

  ws.onclose = () => {
    useMarket.getState().setWsConnected(false);
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    socket = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connectWs, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  };

  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* onclose maneja el reconnect */
    }
  };
}
