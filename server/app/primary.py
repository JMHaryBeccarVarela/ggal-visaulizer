"""
Cliente de Primary API vía pyRofex.

Responsabilidades:
  - bootstrap: setear URLs de veta, autenticar (REST) y descargar catálogo.
  - administrar la conexión websocket según horario de mercado.
  - rutear callbacks de market data al store.

Solo market data. No envía órdenes.
"""
from __future__ import annotations

import logging
import re
import threading
from typing import Any

import pyRofex

from .config import config
from .store import store

log = logging.getLogger("primary")

# Futuro DLR directo: DLR/MMMYY (excluye opciones, calendar spreads, margen, SPOT)
_FUT_RE = re.compile(r"^DLR/[A-Z]{3}\d{2}$")

_MD_ENTRIES = [
    pyRofex.MarketDataEntry.BIDS,
    pyRofex.MarketDataEntry.OFFERS,
    pyRofex.MarketDataEntry.LAST,
    pyRofex.MarketDataEntry.OPENING_PRICE,
    pyRofex.MarketDataEntry.CLOSING_PRICE,
    pyRofex.MarketDataEntry.SETTLEMENT_PRICE,
    pyRofex.MarketDataEntry.HIGH_PRICE,
    pyRofex.MarketDataEntry.LOW_PRICE,
    pyRofex.MarketDataEntry.TRADE_VOLUME,
    pyRofex.MarketDataEntry.OPEN_INTEREST,
    pyRofex.MarketDataEntry.TRADE_EFFECTIVE_VOLUME,
    pyRofex.MarketDataEntry.NOMINAL_VOLUME,
    pyRofex.MarketDataEntry.TRADE_COUNT,
]


class PrimaryClient:
    def __init__(self) -> None:
        self._state = "disconnected"  # disconnected|connecting|connected|idle
        self._bootstrapped = False
        self._symbols: list[str] = []
        self._spot_symbol: str | None = None
        self._ws_open = False
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        return self._state

    # ---------- bootstrap (REST) ----------
    def bootstrap(self) -> None:
        """Auth + catálogo. Idempotente. Independiente del horario."""
        if self._bootstrapped:
            return
        log.info("Bootstrap pyRofex (veta)...")
        pyRofex._set_environment_parameter("url", config.rest_url, pyRofex.Environment.LIVE)
        pyRofex._set_environment_parameter("ws", config.ws_url, pyRofex.Environment.LIVE)
        pyRofex.initialize(
            user=config.user,
            password=config.password,
            account=config.account or "0",
            environment=pyRofex.Environment.LIVE,
        )

        det = pyRofex.get_detailed_instruments()
        instruments = det.get("instruments", []) if isinstance(det, dict) else []

        futures: list[dict] = []
        spot_symbol: str | None = None
        for i in instruments:
            sym = i.get("instrumentId", {}).get("symbol", "")
            mid = i.get("instrumentId", {}).get("marketId")
            if mid and mid != config.market_id:
                continue
            if _FUT_RE.match(sym):
                futures.append(i)
            elif sym == f"{config.symbol_prefix}SPOT":
                spot_symbol = sym

        futures.sort(key=lambda x: x.get("maturityDate") or "99999999")
        store.set_instruments(futures)
        store.set_spot_symbol(spot_symbol)
        self._symbols = [f["instrumentId"]["symbol"] for f in futures]
        self._spot_symbol = spot_symbol
        self._bootstrapped = True
        log.info(
            "Catálogo: %d futuros DLR%s",
            len(self._symbols),
            f" · Spot: {spot_symbol}" if spot_symbol else "",
        )

    # ---------- websocket ----------
    def _on_market_data(self, message: dict[str, Any]) -> None:
        try:
            if message.get("type") != "Md":
                return
            symbol = message.get("instrumentId", {}).get("symbol")
            md = message.get("marketData")
            if symbol and isinstance(md, dict):
                store.update_market_data(symbol, md)
        except Exception:  # noqa: BLE001 - no romper el thread del ws
            log.exception("Error procesando market data")

    def _on_error(self, message: Any) -> None:
        log.warning("WS error: %s", message)

    def _on_exception(self, exc: Exception) -> None:
        log.error("WS exception: %s", exc)
        with self._lock:
            self._ws_open = False
            if self._state == "connected":
                self._state = "disconnected"

    def connect_ws(self) -> None:
        with self._lock:
            if self._ws_open or self._state == "connecting":
                return
            if not self._symbols:
                return
            self._state = "connecting"
        log.info("Abriendo websocket y suscribiendo market data...")
        try:
            pyRofex.init_websocket_connection(
                market_data_handler=self._on_market_data,
                error_handler=self._on_error,
                exception_handler=self._on_exception,
            )
            tickers = list(self._symbols)
            if self._spot_symbol:
                tickers.append(self._spot_symbol)
            pyRofex.market_data_subscription(
                tickers=tickers,
                entries=_MD_ENTRIES,
                depth=5,
            )
            with self._lock:
                self._ws_open = True
                self._state = "connected"
            log.info("WS conectado. Suscriptos %d instrumentos.", len(tickers))
        except Exception:  # noqa: BLE001
            log.exception("Fallo al conectar websocket")
            with self._lock:
                self._ws_open = False
                self._state = "disconnected"

    def disconnect_ws(self, reason: str = "") -> None:
        with self._lock:
            if not self._ws_open:
                self._state = "idle"
                return
        try:
            pyRofex.close_websocket_connection()
        except Exception:  # noqa: BLE001
            log.debug("close_websocket_connection lanzó excepción (se ignora)")
        with self._lock:
            self._ws_open = False
            self._state = "idle"
        if reason:
            log.info("WS cerrado: %s", reason)


primary = PrimaryClient()
