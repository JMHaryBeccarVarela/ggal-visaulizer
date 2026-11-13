"""
Cliente de Primary API vía pyRofex.

Descubre y suscribe, para cada activo de assets.py:
  - Futuros en ROFX, los N vencimientos más cercanos.
  - Acción en BYMA (plazos CI y 24hs) o índice de Rofex → spot.
Además: bonos para el CCL y cauciones en pesos.

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

from .assets import ASSETS
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
    pyRofex.MarketDataEntry.INDEX_VALUE,
]


def _ticker_patterns(fut_root: str, equity: str | None) -> tuple[re.Pattern, re.Pattern | None]:
    # Futuro en Rofex: "GGAL/MMMYY" (p.ej. GGAL/DIC26). Excluye opciones/spreads.
    fut = re.compile(rf"^{re.escape(fut_root)}/[A-Z]{{3}}\d{{2}}$", re.IGNORECASE)
    # Acción en BYMA: "MERV - XMEV - GGAL - 24hs" / "- CI".
    eq = (
        re.compile(rf"-\s*{re.escape(equity)}\s*-\s*(CI|24hs)\s*$", re.IGNORECASE)
        if equity else None
    )
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
        """Auth + catálogo + descubrimiento de instrumentos. Idempotente."""
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

        by_symbol = {
            i.get("instrumentId", {}).get("symbol", ""): i for i in instruments
        }

        # Bonos para el CCL ("MERV - XMEV - AL30 - 24hs") y cauciones en pesos
        # ("MERV - XMEV - PESOS - 7D").
        term = re.escape(config.bond_settlement)
        bond_ars_re = re.compile(rf"-\s*{re.escape(config.bond_ars)}\s*-\s*{term}\s*$", re.IGNORECASE)
        bond_usd_re = re.compile(rf"-\s*{re.escape(config.bond_usd)}\s*-\s*{term}\s*$", re.IGNORECASE)
        cau_re = re.compile(r"-\s*PESOS\s*-\s*(\d+)D\s*$", re.IGNORECASE)
        aux: dict[str, dict] = {}         # rol -> instrument
        cauciones: dict[int, dict] = {}   # plazo en días -> instrument
        for sym, i in by_symbol.items():
            if bond_ars_re.search(sym):
                aux["bondArs"] = i
            elif bond_usd_re.search(sym):
                aux["bondUsd"] = i
            else:
                c = cau_re.search(sym)
                if c:
                    cauciones[int(c.group(1))] = i

        # Cauciones: el plazo configurado o, si ese día no cotiza, el más cercano.
        caucion_days = caucion_short_days = None
        if cauciones:
            caucion_days = min(cauciones, key=lambda d: abs(d - config.caucion_days))
            aux["caucion"] = cauciones[caucion_days]
            caucion_short_days = min(cauciones, key=lambda d: abs(d - config.caucion_short_days))
            if caucion_short_days != caucion_days:
                aux["caucionShort"] = cauciones[caucion_short_days]

        # Por activo: futuros (los N vencimientos más cercanos), acción e índice.
        per_asset: dict[str, dict] = {}
        for a in ASSETS:
            fut_re, eq_re = _ticker_patterns(a.fut_root, a.equity)
            futures = [
                i for sym, i in by_symbol.items()
                if fut_re.match(sym)
                and (not config.futures_market
                     or i["instrumentId"].get("marketId") == config.futures_market)
            ]
            futures.sort(key=lambda x: x.get("maturityDate") or "99999999")
            if config.max_futures > 0:
                futures = futures[: config.max_futures]
            found: dict = {"futures": futures, "ci": None, "t24": None, "index": None}
            if eq_re is not None:
                for sym, i in by_symbol.items():
                    m = eq_re.search(sym)
                    if m:
                        found["ci" if m.group(1).lower() == "ci" else "t24"] = i
            if a.index:
                found["index"] = by_symbol.get(a.index)
            per_asset[a.id] = found
            log.info(
                "%s: futuros=%s · CI=%s · 24hs=%s · índice=%s",
                a.id,
                [f["instrumentId"]["symbol"] for f in futures],
                bool(found["ci"]), bool(found["t24"]), bool(found["index"]),
            )
            if not futures:
                log.warning("No se encontraron futuros de %s en %s.", a.fut_root, config.futures_market)

        store.set_instruments(per_asset, aux, caucion_days, caucion_short_days)
        self._symbols = [
            i["instrumentId"]["symbol"]
            for found in per_asset.values()
            for i in (*found["futures"], found["ci"], found["t24"], found["index"])
            if i
        ] + [i["instrumentId"]["symbol"] for i in aux.values()]

        self._bootstrapped = True
        log.info(
            "Auxiliares: %s",
            {k: v["instrumentId"]["symbol"] for k, v in aux.items()},
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
