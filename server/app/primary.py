"""
Cliente de Primary API vía pyRofex para GGAL.

Descubre y suscribe:
  - Acción GGAL en BYMA (MERV), plazos CI y 24hs  → spot.
  - Futuros GGAL en ROFX, los N vencimientos más cercanos.

Responsabilidades:
  - bootstrap: setear URLs de Veta, autenticar (REST) y descargar catálogo.
  - administrar la conexión websocket y rutear market data al store.

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
    pyRofex.MarketDataEntry.NOMINAL_VOLUME,
    pyRofex.MarketDataEntry.TRADE_COUNT,
]


def _ticker_patterns(ticker: str) -> tuple[re.Pattern, re.Pattern]:
    tk = re.escape(ticker)
    # Futuro GGAL en Rofex: "GGAL/MMMYY" (p.ej. GGAL/DIC25). Excluye opciones/spreads.
    fut = re.compile(rf"^{tk}/[A-Z]{{3}}\d{{2}}$", re.IGNORECASE)
    # Acción en BYMA: "MERV - XMEV - GGAL - 24hs" / "- CI" / "- 48hs".
    eq = re.compile(rf"{tk}\s*-\s*(CI|24hs|48hs)\s*$", re.IGNORECASE)
    return fut, eq


class PrimaryClient:
    def __init__(self) -> None:
        self._state = "disconnected"  # disconnected|connecting|connected|idle
        self._bootstrapped = False
        self._symbols: list[str] = []
        self._ws_open = False
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        return self._state

    @property
    def bootstrapped(self) -> bool:
        return self._bootstrapped

    # ---------- bootstrap (REST) ----------
    def bootstrap(self) -> None:
        """Auth + catálogo + descubrimiento de instrumentos GGAL. Idempotente."""
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

        fut_re, eq_re = _ticker_patterns(config.equity_ticker)
        futures: list[dict] = []
        eq_by_term: dict[str, dict] = {}  # 'ci' | '24hs' | '48hs' -> instrument

        for i in instruments:
            iid = i.get("instrumentId", {})
            sym = iid.get("symbol", "")
            if not sym:
                continue
            if fut_re.match(sym):
                mid = iid.get("marketId")
                if mid and config.futures_market and mid != config.futures_market:
                    continue
                futures.append(i)
                continue
            m = eq_re.search(sym)
            if m:
                eq_by_term[m.group(1).lower()] = i

        futures.sort(key=lambda x: x.get("maturityDate") or "99999999")
        if config.max_futures > 0:
            futures = futures[: config.max_futures]

        equity_ci = eq_by_term.get("ci")
        equity_t24 = eq_by_term.get("24hs")

        store.set_instruments(futures, equity_ci, equity_t24)
        self._symbols = [f["instrumentId"]["symbol"] for f in futures]
        for inst in (equity_ci, equity_t24):
            if inst:
                self._symbols.append(inst["instrumentId"]["symbol"])

        self._bootstrapped = True
        log.info(
            "Catálogo GGAL: %d futuro(s) %s · acción CI=%s · 24hs=%s",
            len(futures),
            [f["instrumentId"]["symbol"] for f in futures],
            equity_ci["instrumentId"]["symbol"] if equity_ci else "—",
            equity_t24["instrumentId"]["symbol"] if equity_t24 else "—",
        )
        if not futures:
            log.warning(
                "No se encontraron futuros de %s en %s. Revisá GGAL_EQUITY_TICKER "
                "/ GGAL_FUTURES_MARKET o que tu cuenta tenga acceso al segmento.",
                config.equity_ticker, config.futures_market,
            )
        if not (equity_ci or equity_t24):
            log.warning(
                "No se encontró la acción %s en BYMA (MERV). Revisá GGAL_EQUITY_TICKER.",
                config.equity_ticker,
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
            pyRofex.market_data_subscription(
                tickers=list(self._symbols),
                entries=_MD_ENTRIES,
                depth=5,
            )
            with self._lock:
                self._ws_open = True
                self._state = "connected"
            log.info("WS conectado. Suscriptos %d instrumentos.", len(self._symbols))
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
