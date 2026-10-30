"""
Tasas implícitas de los futuros de GGAL respecto del spot (acción en BYMA).

Convención acordada (base 365, días corridos):
    base  = F / S - 1                 # tasa directa del período
    TNA   = base * (365 / n)          # tasa nominal anual
    TEA   = (F / S) ** (365 / n) - 1  # tasa efectiva anual (capitalizada)

donde F = precio del futuro, S = spot (GGAL 24hs por defecto), n = días
corridos hasta el vencimiento del futuro.
"""
from __future__ import annotations

from dataclasses import dataclass

DAYS_BASIS = 365


@dataclass(frozen=True)
class Rates:
    days: int | None
    basisAbs: float | None   # F - S
    basisPct: float | None   # F / S - 1
    tna: float | None        # fracción (0.45 == 45%)
    tea: float | None        # fracción

    def as_dict(self) -> dict:
        return {
            "days": self.days,
            "basisAbs": self.basisAbs,
            "basisPct": self.basisPct,
            "tna": self.tna,
            "tea": self.tea,
        }


_EMPTY = Rates(days=None, basisAbs=None, basisPct=None, tna=None, tea=None)


def compute_rates(future: float | None, spot: float | None, days: int | None) -> Rates:
    """Tasa implícita de un futuro contra el spot. Devuelve campos None si
    falta algún dato o los precios no son positivos."""
    if (
        future is None
        or spot is None
        or days is None
        or future <= 0
        or spot <= 0
        or days <= 0
    ):
        return Rates(days=days, basisAbs=None, basisPct=None, tna=None, tea=None)

    ratio = future / spot
    basis_pct = ratio - 1.0
    tna = basis_pct * (DAYS_BASIS / days)
    tea = ratio ** (DAYS_BASIS / days) - 1.0
    return Rates(
        days=days,
        basisAbs=future - spot,
        basisPct=basis_pct,
        tna=tna,
        tea=tea,
    )
