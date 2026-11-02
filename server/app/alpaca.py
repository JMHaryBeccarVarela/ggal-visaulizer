"""
Cliente de Alpaca Market Data para el ADR de GGAL (NYSE/NASDAQ).

Plan gratis → feed IEX en tiempo real (el consolidado SIP es pago).

  - Seed inicial por REST (snapshot): último trade, puntas, OHLC del día y
    cierre previo (para calcular la variación).
  - Stream por WebSocket: trades y quotes en vivo durante la rueda de EE.UU.

Corre en un thread propio (websocket-client). Si faltan las credenciales, el
cliente queda deshabilitado y el server funciona igual sin el ADR.
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

log = logging.getLogger("alpaca")

_REST_SNAPSHOT = "https://data.alpaca.markets/v2/stocks/{sym}/snapshot"
_WS_URL = "wss://stream.data.alpaca.markets/v2/{feed}"


class AlpacaClient:
    def __init__(self) -> None:
        self._state = "disabled"
        self._ws: websocket.WebSocketApp | None = None
        self._thread: threading.Thread | None = None
        self._stop = False

    @property
    def state(self) -> str:
        return self._state

    def _headers(self) -> dict:
        return {
            "APCA-API-KEY-ID": config.alpaca_key,
            "APCA-API-SECRET-KEY": config.alpaca_secret,
        }

    # ---------- arranque / parada ----------
    def start(self) -> None:
        if not config.alpaca_enabled:
            self._state = "disabled"
            log.warning(
                "Alpaca deshabilitado (faltan ALPACA_KEY / ALPACA_SECRET). "
                "El ADR de GGAL no se mostrará."
            )
            return
        if self._thread and self._thread.is_alive():
            return  # ya corriendo
        self._stop = False
        self._state = "disconnected"
        self._seed_rest()
        self._thread = threading.Thread(target=self._run, name="alpaca-ws", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop = True
        try:
            if self._ws:
                self._ws.close()
        except Exception:  # noqa: BLE001
            pass
        if config.alpaca_enabled:
            self._state = "idle"

    # ---------- seed REST ----------
    def _seed_rest(self) -> None:
        try:
            r = requests.get(
                _REST_SNAPSHOT.format(sym=config.adr_symbol),
                params={"feed": config.alpaca_feed},
                headers=self._headers(),
                timeout=10,
            )
            r.raise_for_status()
            snap = r.json()
        except Exception:  # noqa: BLE001
            log.exception("Fallo el seed REST de Alpaca (se continúa con el WS)")
            return

        lt = snap.get("latestTrade") or {}
        lq = snap.get("latestQuote") or {}
        db = snap.get("dailyBar") or {}
        pdb = snap.get("prevDailyBar") or {}

        fields: dict = {}
        if lt.get("p") is not None:
            fields["last"] = lt["p"]
        if lq.get("bp") is not None:
            fields["bid"] = lq["bp"]
            fields["bidSize"] = lq.get("bs")
        if lq.get("ap") is not None:
            fields["ask"] = lq["ap"]
            fields["askSize"] = lq.get("as")
        if db:
            fields["open"] = db.get("o")
            fields["high"] = db.get("h")
            fields["low"] = db.get("l")
            fields["volume"] = db.get("v")
            if "last" not in fields and db.get("c") is not None:
                fields["last"] = db.get("c")
        if pdb.get("c") is not None:
            fields["prevClose"] = pdb["c"]

        if fields:
            store.update_adr(fields)
            log.info(
                "ADR %s seed REST: last=%s prevClose=%s",
                config.adr_symbol, fields.get("last"), fields.get("prevClose"),
            )

    # ---------- websocket ----------
    def _run(self) -> None:
        url = _WS_URL.format(feed=config.alpaca_feed)
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
                log.exception("Alpaca run_forever error")
            if self._stop:
                break
            self._state = "disconnected"
            time.sleep(min(backoff, 30))
            backoff = min(backoff * 2, 30)

    def _on_open(self, ws) -> None:
        self._state = "authenticating"
        ws.send(json.dumps({
            "action": "auth",
            "key": config.alpaca_key,
            "secret": config.alpaca_secret,
        }))

    def _subscribe(self, ws) -> None:
        ws.send(json.dumps({
            "action": "subscribe",
            "trades": [config.adr_symbol],
            "quotes": [config.adr_symbol],
        }))

    def _on_message(self, ws, raw) -> None:
        try:
            msgs = json.loads(raw)
        except Exception:  # noqa: BLE001
            return
        if not isinstance(msgs, list):
            msgs = [msgs]
        for m in msgs:
            t = m.get("T")
            if t == "success":
                if m.get("msg") == "authenticated":
                    self._state = "connected"
                    self._subscribe(ws)
            elif t == "subscription":
                log.info(
                    "Alpaca suscripto: trades=%s quotes=%s",
                    m.get("trades"), m.get("quotes"),
                )
            elif t == "error":
                log.warning("Alpaca error: %s", m)
                # 401/403 → credenciales mal; cortamos el reintento.
                if m.get("code") in (401, 402, 403, 404, 406):
                    self._stop = True
            elif t == "t":  # trade
                if m.get("p") is not None:
                    store.update_adr({"last": m["p"]})
            elif t == "q":  # quote
                fields: dict = {}
                if m.get("bp") is not None:
                    fields["bid"] = m["bp"]
                    fields["bidSize"] = m.get("bs")
                if m.get("ap") is not None:
                    fields["ask"] = m["ap"]
                    fields["askSize"] = m.get("as")
                if fields:
                    store.update_adr(fields)

    def _on_error(self, ws, err) -> None:
        log.warning("Alpaca WS error: %s", err)

    def _on_close(self, ws, code, msg) -> None:
        if self._state == "connected":
            self._state = "disconnected"
        log.info("Alpaca WS cerrado (code=%s)", code)


alpaca = AlpacaClient()
