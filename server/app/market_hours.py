"""
Horario de mercado Matba Rofex para futuros DLR.
Apertura 10:20, cierre 17:10, hora Argentina (UTC-3, sin DST).
Operativo lunes a viernes.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

OPEN_MIN = 10 * 60 + 20   # 10:20
CLOSE_MIN = 17 * 60 + 10  # 17:10
AR_OFFSET = timedelta(hours=-3)


def _now_ar() -> tuple[int, int]:
    """Devuelve (weekday, minutos_desde_medianoche) en hora Argentina."""
    now_ar = datetime.now(timezone.utc) + AR_OFFSET
    return now_ar.weekday(), now_ar.hour * 60 + now_ar.minute


def is_market_open() -> bool:
    weekday, minutes = _now_ar()
    if weekday >= 5:  # 5=sábado, 6=domingo
        return False
    return OPEN_MIN <= minutes <= CLOSE_MIN


def market_status() -> dict:
    weekday, minutes = _now_ar()

    if weekday >= 5:
        days_until_monday = 7 - weekday  # sáb->2, dom->1
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

    # Después del cierre
    minutes_until_tomorrow = 24 * 60 - minutes + OPEN_MIN
    skip = 2 * 24 * 60 if weekday == 4 else 0  # viernes -> próximo lunes
    return {
        "open": False,
        "state": "closed",
        "nextChange": {"state": "open", "minutesUntil": minutes_until_tomorrow + skip},
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
