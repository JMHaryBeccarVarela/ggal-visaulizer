"""
Cliente de Finnhub para el ADR de GGAL (quote consolidado).

Finnhub (free) da el quote consolidado — precio, cierre previo, OHLC = igual a
TradingView/CNBC — con precio en tiempo real por un WebSocket de trades.
Las velas intradía son premium, así que el gráfico sigue usando Alpaca.

Corre en threads propios (websocket-client). Si falta la key, queda deshabilitado.
"""
from __future__ import annotations

import json
import logging
import threading
import time

import requests
import websocket  # websocket-client

from .config import config
from .store import store

log = logging.getLogger("finnhub")

_QUOTE_URL = "https://finnhub.io/api/v1/quote"
_WS_URL = "wss://ws.finnhub.io"


class FinnhubClient:
    def __init__(self) -> None:
        self._state = "disabled"
        self._ws: websocket.WebSocketApp | None = None
        self._ws_thread: threading.Thread | None = None
        self._poll_thread: threading.Thread | None = None
        self._stop = False

    @property
    def state(self) -> str:
        return self._state

    # ---------- start / stop ----------
    def start(self) -> None:
        if not config.finnhub_enabled:
            self._state = "disabled"
            log.warning("Finnhub deshabilitado (falta FINNHUB_KEY). El ADR no se mostrará.")
            return
        if self._ws_thread and self._ws_thread.is_alive():
            return
        self._stop = False
        self._state = "disconnected"
        self._fetch_quote()  # seed inicial
        self._poll_thread = threading.Thread(target=self._poll, name="finnhub-poll", daemon=True)
        self._poll_thread.start()
        self._ws_thread = threading.Thread(target=self._run_ws, name="finnhub-ws", daemon=True)
        self._ws_thread.start()

    def stop(self) -> None:
        self._stop = True
        try:
            if self._ws:
                self._ws.close()
        except Exception:  # noqa: BLE001
            pass
        if config.finnhub_enabled:
            self._state = "idle"

    # ---------- REST quote ----------
    def _fetch_quote(self) -> None:
        try:
            r = requests.get(
                _QUOTE_URL,
                params={"symbol": config.adr_symbol, "token": config.finnhub_key},
                timeout=10,
            )
            r.raise_for_status()
            q = r.json()
            c = q.get("c")
            if not c:  # Finnhub devuelve 0 cuando no hay dato
                return
            store.update_adr({
                "last": c,
                "prevClose": q.get("pc"),
                "open": q.get("o"),
                "high": q.get("h"),
                "low": q.get("l"),
            })
        except Exception:  # noqa: BLE001
            log.exception("Fallo el quote de Finnhub")

    def _poll(self) -> None:
        # Refresca cierre previo / OHLC y hace de fallback del precio.
        while not self._stop:
            time.sleep(12)
            if self._stop:
                break
            self._fetch_quote()

    # ---------- WebSocket (trades en tiempo real) ----------
    def _run_ws(self) -> None:
        url = f"{_WS_URL}?token={config.finnhub_key}"
        backoff = 1
        while not self._stop:
            self._state = "connecting"
            self._ws = websocket.WebSocketApp(
                url,
                on_open=self._on_open,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close,
            )
            try:
                self._ws.run_forever(ping_interval=20, ping_timeout=10)
            except Exception:  # noqa: BLE001
                log.exception("Finnhub run_forever error")
            if self._stop:
                break
            self._state = "disconnected"
            time.sleep(min(backoff, 30))
            backoff = min(backoff * 2, 30)

    def _on_open(self, ws) -> None:
        self._state = "connected"
        ws.send(json.dumps({"type": "subscribe", "symbol": config.adr_symbol}))
        log.info("Finnhub suscripto a %s", config.adr_symbol)

    def _on_message(self, ws, raw) -> None:
        try:
            m = json.loads(raw)
        except Exception:  # noqa: BLE001
            return
        if m.get("type") == "trade":
            data = m.get("data") or []
            if data:
                p = data[-1].get("p")
                if p is not None:
                    store.update_adr({"last": p})

    def _on_error(self, ws, err) -> None:
        log.warning("Finnhub WS error: %s", err)

    def _on_close(self, ws, code, msg) -> None:
        if self._state == "connected":
            self._state = "disconnected"


finnhub = FinnhubClient()
