"""
Activos que muestra la landing. Cada uno tiene futuros en Rofex y un spot de
referencia, que según el tipo sale de un lugar distinto:

  kind "adr"    acción en BYMA (CI / 24hs) + ADR en EE.UU. (Finnhub) → CCL.
  kind "equity" acción en BYMA (CI / 24hs) sin ADR.
  kind "index"  índice de Rofex (RFX20, calculado con su cartera).
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
    kind: str                    # "adr" | "equity" | "index" | "ext" | "rate"
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
    # Índice calculado: (ticker BYMA, cantidad) de la cartera; valor = Σ cantidad × precio 24hs.
    basket: tuple[tuple[str, float], ...] = ()
    basket_date: str | None = None


# Cartera vigente del ROFEX 20 (A3 Mercados, vigente desde 2026-09-18).
RFX20_CARTERA_FECHA = "2026-09-18"
RFX20_CARTERA: tuple[tuple[str, float], ...] = (
    ("ALUA", 10.06271), ("BBAR", 2.68592), ("BMA", 2.800371), ("BYMA", 65.370659),
    ("CEPU", 10.87567), ("COME", 91.748265), ("ECOG", 2.675538), ("EDN", 2.212366),
    ("GGAL", 12.635638), ("LOMA", 3.660094), ("METR", 2.238021), ("PAMP", 12.078651),
    ("SUPV", 4.264612), ("TECO2", 1.775205), ("TGNO4", 1.151765), ("TGSU2", 2.64651),
    ("TRAN", 2.759586), ("TXAR", 19.245274), ("VALO", 15.061863), ("YPFD", 11.208578),
)

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
    Asset(id="TXAR", label="TXAR", kind="equity", fut_root="TXAR", equity="TXAR"),
    # Primary solo publica el cierre de I.RFX20, así que el índice se calcula en
    # vivo con la cartera vigente de A3 Mercados (a3mercados.com.ar/info-de-mercado/
    # indices/rofex20). Con los cierres 24hs reproduce el valor oficial exacto.
    # Hay que actualizarla en cada rebalanceo trimestral.
    Asset(
        id="RFX20", label="RFX20", kind="index", fut_root="RFX20", index="I.RFX20",
        basket=RFX20_CARTERA, basket_date=RFX20_CARTERA_FECHA,
    ),
    Asset(id="CAUC", label="CAUC", kind="rate", fut_root="CAUC", carry=False),
]

ASSETS_BY_ID: dict[str, Asset] = {a.id: a for a in ASSETS}

# Símbolos externos (Finnhub) y de gráfico (Alpaca), sin repetir.
EXT_SYMBOLS: list[str] = list(dict.fromkeys(a.ext for a in ASSETS if a.ext))
CHART_SYMBOLS: set[str] = {a.chart for a in ASSETS if a.chart}
