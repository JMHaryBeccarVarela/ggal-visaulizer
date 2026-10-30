"""
Horarios de mercado.

  - Local (BYMA / Matba Rofex): rueda continua ~11:00 a 17:00 ART (UTC-3,
    sin DST). Aplica a la acción GGAL y a los futuros GGAL.
  - EE.UU. (NYSE/NASDAQ): 09:30 a 16:00 hora del Este, con DST. Aplica al ADR.

Los badges son informativos: Primary manda igual el último estado completo
con el mercado cerrado, y Alpaca manda el último trade fuera de rueda.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

# ---- Mercado local (BYMA / Rofex) ----
OPEN_MIN = 11 * 60          # 11:00
CLOSE_MIN = 17 * 60         # 17:00
AR_OFFSET = timedelta(hours=-3)

# ---- Mercado EE.UU. (ADR) ----
_ET = ZoneInfo("America/New_York")
US_OPEN_MIN = 9 * 60 + 30   # 09:30 ET
US_CLOSE_MIN = 16 * 60      # 16:00 ET


def _now_ar() -> tuple[int, int]:
    """(weekday, minutos desde medianoche) en hora Argentina."""
    now_ar = datetime.now(timezone.utc) + AR_OFFSET
    return now_ar.weekday(), now_ar.hour * 60 + now_ar.minute


def is_market_open() -> bool:
    weekday, minutes = _now_ar()
    if weekday >= 5:
        return False
    return OPEN_MIN <= minutes <= CLOSE_MIN


def market_status() -> dict:
    """Estado del mercado local (BYMA / Rofex)."""
    weekday, minutes = _now_ar()

    if weekday >= 5:
        days_until_monday = 7 - weekday
        minutes_until = days_until_monday * 24 * 60 - minutes + OPEN_MIN
        return {
            "open": False,
            "state": "weekend",
            "nextChange": {"state": "open", "minutesUntil": minutes_until},
        }

    if minutes < OPEN_MIN:
        return {
            "open": False,
            "state": "pre-open",
            "nextChange": {"state": "open", "minutesUntil": OPEN_MIN - minutes},
        }

    if minutes <= CLOSE_MIN:
        return {
            "open": True,
            "state": "open",
            "nextChange": {"state": "closed", "minutesUntil": CLOSE_MIN - minutes},
        }

    minutes_until_tomorrow = 24 * 60 - minutes + OPEN_MIN
    skip = 2 * 24 * 60 if weekday == 4 else 0  # viernes -> lunes
    return {
        "open": False,
        "state": "closed",
        "nextChange": {"state": "open", "minutesUntil": minutes_until_tomorrow + skip},
    }


def us_market_status() -> dict:
    """Estado del mercado de EE.UU. (NYSE/NASDAQ) para el ADR."""
    now_et = datetime.now(_ET)
    weekday = now_et.weekday()
    minutes = now_et.hour * 60 + now_et.minute
    is_open = weekday < 5 and US_OPEN_MIN <= minutes < US_CLOSE_MIN
    return {
        "open": is_open,
        "state": "open" if is_open else ("weekend" if weekday >= 5 else "closed"),
    }


def days_to_maturity(maturity_date: str | None) -> int:
    """Días corridos hasta un vencimiento 'YYYYMMDD'."""
    if not maturity_date or len(maturity_date) != 8 or not maturity_date.isdigit():
        return 0
    y, m, d = int(maturity_date[:4]), int(maturity_date[4:6]), int(maturity_date[6:8])
    mat = datetime(y, m, d, tzinfo=timezone.utc)
    today_ar = datetime.now(timezone.utc) + AR_OFFSET
    today = datetime(today_ar.year, today_ar.month, today_ar.day, tzinfo=timezone.utc)
    return max(0, (mat - today).days)
