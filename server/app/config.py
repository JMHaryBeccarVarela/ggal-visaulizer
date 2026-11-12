"""Configuración del server, cargada desde server/.env.

Dos fuentes de datos:
  - Primary API (pyRofex) → acción GGAL en BYMA (MERV) + futuros GGAL (ROFX).
  - Alpaca Market Data    → ADR de GGAL en NYSE/NASDAQ (feed IEX, gratis).

Primary es obligatorio. Alpaca es opcional: si faltan las keys, el server
levanta igual y el ADR aparece como "no configurado".
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Cargar .env ubicado en server/ (un nivel arriba de app/)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)


def _require(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Falta variable de entorno requerida: {name}")
    return val


def _env(name: str, default: str) -> str:
    """Devuelve el default si la variable no está o está vacía (p.ej.
    `ALPACA_FEED=` sin valor), para que un .env a medio llenar no rompa."""
    val = os.environ.get(name)
    return val if val else default


@dataclass(frozen=True)
class Config:
    # ---- Primary / pyRofex (BYMA + Rofex vía Veta) ----
    user: str
    password: str
    account: str
    rest_url: str
    ws_url: str

    # ---- GGAL en Primary ----
    equity_ticker: str        # ticker de la acción en BYMA, p.ej. "GGAL"
    futures_market: str       # marketId de los futuros, p.ej. "ROFX"
    spot_settlement: str      # "24hs" | "CI": plazo usado como spot para la tasa
    max_futures: int          # cuántos vencimientos mostrar (0 = todos los listados)

    # ---- Tasa teórica (cost of carry) y CCL por bonos ----
    caucion_days: int         # plazo de la caución en pesos usada como libre de riesgo
    signal_threshold: float   # diferencia mínima de TNA (fracción) para el cartel
    bond_ars: str             # bono en pesos para el CCL, p.ej. "AL30"
    bond_usd: str             # misma especie en dólar cable, p.ej. "AL30C"
    bond_settlement: str      # plazo de los bonos: "24hs" | "CI"

    # ---- ADR GGAL en NYSE/NASDAQ ----
    # Finnhub da el quote consolidado (precio/%); Alpaca queda solo para el
    # gráfico intradía (las velas de Finnhub free son premium).
    finnhub_key: str
    alpaca_key: str
    alpaca_secret: str
    alpaca_feed: str          # "iex" (free) | "sip" (pago)
    adr_symbol: str           # ticker del ADR, p.ej. "GGAL"
    adr_ratio: float          # acciones ordinarias por ADR (GGAL = 10)

    # ---- Server ----
    host: str
    port: int
    log_level: str
    cors_origins: str         # "*" o lista separada por comas (orígenes permitidos)

    @property
    def alpaca_enabled(self) -> bool:
        return bool(self.alpaca_key and self.alpaca_secret)

    @property
    def finnhub_enabled(self) -> bool:
        return bool(self.finnhub_key)


config = Config(
    user=_require("PRIMARY_USER"),
    password=_require("PRIMARY_PASS"),
    account=os.environ.get("PRIMARY_ACCOUNT", ""),
    rest_url=_env("PRIMARY_REST_URL", "https://api.veta.xoms.com.ar/"),
    ws_url=_env("PRIMARY_WS_URL", "wss://api.veta.xoms.com.ar/"),
    equity_ticker=_env("GGAL_EQUITY_TICKER", "GGAL"),
    futures_market=_env("GGAL_FUTURES_MARKET", "ROFX"),
    spot_settlement=_env("GGAL_SPOT_SETTLEMENT", "24hs"),
    max_futures=int(_env("GGAL_MAX_FUTURES", "2")),
    caucion_days=int(_env("CAUCION_DAYS", "7")),
    signal_threshold=float(_env("GGAL_SIGNAL_THRESHOLD", "0.02")),
    bond_ars=_env("CCL_BOND_ARS", "AL30"),
    bond_usd=_env("CCL_BOND_USD", "AL30C"),
    bond_settlement=_env("CCL_BOND_SETTLEMENT", "24hs"),
    finnhub_key=os.environ.get("FINNHUB_KEY", ""),
    alpaca_key=os.environ.get("ALPACA_KEY", ""),
    alpaca_secret=os.environ.get("ALPACA_SECRET", ""),
    alpaca_feed=_env("ALPACA_FEED", "iex"),
    adr_symbol=_env("ALPACA_ADR_SYMBOL", "GGAL"),
    adr_ratio=float(_env("GGAL_ADR_RATIO", "10")),
    host=_env("HOST", "0.0.0.0"),
    port=int(_env("PORT", "8080")),
    log_level=_env("LOG_LEVEL", "info"),
    cors_origins=_env("CORS_ORIGINS", "*"),
)
