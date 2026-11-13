"""
Activos que muestra la landing. Cada uno tiene futuros en Rofex y un spot de
referencia, que según el tipo sale de un lugar distinto:

  kind "adr"    acción en BYMA (CI / 24hs) + ADR en EE.UU. (Finnhub) → CCL.
  kind "index"  índice publicado por Rofex (I.RFX20, I.BTC).
  kind "ext"    referencia externa de Finnhub (sin spot local).
  kind "rate"   futuros de tasa: la referencia es la caución en pesos.

Para sumar un activo alcanza con agregarlo a ASSETS.
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import config


@dataclass(frozen=True)
class Asset:
    id: str
    label: str
    kind: str                    # "adr" | "index" | "ext" | "rate"
    fut_root: str                # raíz de los futuros en Rofex ("GGAL" → GGAL/DIC26)
    currency: str = "ARS"        # moneda de los futuros
    equity: str | None = None    # ticker de la acción en BYMA
    index: str | None = None     # símbolo del índice en Primary
    ext: str | None = None       # símbolo en Finnhub (ADR / referencia externa)
    ext_label: str | None = None
    ext_scale: float = 1.0       # factor para llevar el precio externo al del futuro
    ratio: float = 1.0           # acciones locales por ADR
    chart: str | None = None     # símbolo en Alpaca para el gráfico intradía
    carry: bool = True           # teórico por caución en pesos + cartel


ASSETS: list[Asset] = [
    Asset(
        id="GGAL", label="GGAL", kind="adr", fut_root=config.equity_ticker,
        equity=config.equity_ticker, ext=config.adr_symbol, ext_label="ADR GGAL",
        ratio=config.adr_ratio, chart=config.adr_symbol,
    ),
    Asset(
        id="PAMP", label="PAMP", kind="adr", fut_root="PAMP",
        equity="PAMP", ext="PAM", ext_label="ADR PAM", ratio=25, chart="PAM",
    ),
    Asset(
        id="YPFD", label="YPFD", kind="adr", fut_root="YPFD",
        equity="YPFD", ext="YPF", ext_label="ADR YPF", ratio=10, chart="YPF",
    ),
    Asset(id="RFX20", label="RFX20", kind="index", fut_root="RFX20", index="I.RFX20"),
    Asset(
        id="BTC", label="BTC", kind="index", fut_root="BTC", index="I.BTC",
        ext="BINANCE:BTCUSDT", ext_label="BTC/USD (Binance)",
    ),
    # Los futuros de ORO cotizan en USD por onza; la referencia es el ETF GLD
    # llevado a onza con un factor fijo. Sin teórico ni cartel (la caución es en pesos).
    Asset(
        id="ORO", label="ORO", kind="ext", fut_root="ORO", currency="USD",
        ext="GLD", ext_label="ETF GLD", ext_scale=config.gld_oz_factor,
        chart="GLD", carry=False,
    ),
    Asset(id="CAUC", label="CAUC", kind="rate", fut_root="CAUC", carry=False),
]

ASSETS_BY_ID: dict[str, Asset] = {a.id: a for a in ASSETS}

# Símbolos externos (Finnhub) y de gráfico (Alpaca), sin repetir.
EXT_SYMBOLS: list[str] = list(dict.fromkeys(a.ext for a in ASSETS if a.ext))
CHART_SYMBOLS: set[str] = {a.chart for a in ASSETS if a.chart}
