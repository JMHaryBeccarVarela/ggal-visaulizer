"""
Store en memoria de market data (thread-safe).

pyRofex entrega callbacks en un thread propio del websocket; FastAPI corre en
el loop asyncio de uvicorn. El store usa un lock para que ambos lados puedan
leer/escribir sin condiciones de carrera.

Solo market data básico: puntas, libro L2, último, OHLC, volumen, OI.
Sin tasas implícitas / arbitrajes / lecaps (se reconstruyen después).
"""
from __future__ import annotations

import threading
import time
from typing import Any

from .market_hours import days_to_maturity


def _num(v: Any) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _price_of(v: Any) -> float | None:
    """CL/LA/SE pueden venir como número o como {'price':..,'date':..}."""
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        p = v.get("price")
        return float(p) if isinstance(p, (int, float)) else None
    return None


class MarketStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._instruments: dict[str, dict] = {}   # symbol -> instrument detail
        self._md: dict[str, dict] = {}            # symbol -> marketData mergeado
        self._last_update: dict[str, float] = {}  # symbol -> epoch ms
        self._spot: float | None = None
        self._spot_manual = False
        self._spot_symbol: str | None = None
        self._dirty: set[str] = set()

    # ---- instrumentos ----
    def set_instruments(self, instruments: list[dict]) -> None:
        with self._lock:
            self._instruments = {
                i["instrumentId"]["symbol"]: i for i in instruments
            }

    def set_spot_symbol(self, symbol: str | None) -> None:
        with self._lock:
            self._spot_symbol = symbol

    def symbols(self) -> list[str]:
        with self._lock:
            return list(self._instruments.keys())

    def contracts(self) -> list[dict]:
        with self._lock:
            out = []
            for i in self._instruments.values():
                iid = i["instrumentId"]
                out.append({
                    "symbol": iid["symbol"],
                    "marketId": iid.get("marketId"),
                    "maturityDate": i.get("maturityDate"),
                    "tickSize": i.get("minPriceIncrement", {}).get("tickSize")
                    if isinstance(i.get("minPriceIncrement"), dict)
                    else i.get("tickSize"),
                    "currency": i.get("currency"),
                    "contractMultiplier": i.get("contractMultiplier"),
                })
            return out

    # ---- spot ----
    def set_spot(self, spot: float | None, manual: bool = True) -> None:
        with self._lock:
            self._spot = spot if (spot and spot > 0) else None
            self._spot_manual = bool(manual and self._spot is not None)

    def get_spot(self) -> float | None:
        with self._lock:
            return self._spot

    def is_spot_manual(self) -> bool:
        with self._lock:
            return self._spot_manual

    # ---- market data ----
    def update_market_data(self, symbol: str, partial: dict) -> None:
        is_spot = False
        with self._lock:
            if self._spot_symbol and symbol == self._spot_symbol:
                is_spot = True
            else:
                prev = self._md.get(symbol, {})
                merged = dict(prev)
                for k, v in partial.items():
                    if v is not None:
                        merged[k] = v
                self._md[symbol] = merged
                self._last_update[symbol] = time.time() * 1000.0
                self._dirty.add(symbol)

        if is_spot and not self.is_spot_manual():
            px = self._extract_spot_price(partial)
            if px is not None:
                self.set_spot(px, manual=False)

    @staticmethod
    def _extract_spot_price(md: dict) -> float | None:
        la = _price_of(md.get("LA"))
        bids = md.get("BI") or []
        offers = md.get("OF") or []
        bid = bids[0]["price"] if bids else None
        ask = offers[0]["price"] if offers else None
        mid = (bid + ask) / 2 if (bid is not None and ask is not None) else None
        se = _price_of(md.get("SE"))
        cl = _price_of(md.get("CL"))
        for cand in (la, mid, se, cl):
            if cand is not None:
                return cand
        return None

    def build_summary(self, symbol: str) -> dict | None:
        with self._lock:
            inst = self._instruments.get(symbol)
            if not inst:
                return None
            md = self._md.get(symbol, {})
            ts = self._last_update.get(symbol, 0)

        mat = inst.get("maturityDate")
        days = days_to_maturity(mat)

        bids = md.get("BI") or []
        offers = md.get("OF") or []
        bid_levels = [{"price": b["price"], "size": b["size"]} for b in bids]
        ask_levels = [{"price": o["price"], "size": o["size"]} for o in offers]

        bid = bid_levels[0]["price"] if bid_levels else None
        bid_size = bid_levels[0]["size"] if bid_levels else None
        ask = ask_levels[0]["price"] if ask_levels else None
        ask_size = ask_levels[0]["size"] if ask_levels else None
        mid = (bid + ask) / 2 if (bid is not None and ask is not None) else None

        last = _price_of(md.get("LA"))
        settlement = _price_of(md.get("SE"))
        prev_close = _price_of(md.get("CL"))
        ref = last if last is not None else (mid if mid is not None else settlement)

        spread_abs = (ask - bid) if (bid is not None and ask is not None) else None
        spread_bps = (spread_abs / mid * 10_000) if (spread_abs is not None and mid) else None

        change_abs = (ref - prev_close) if (ref is not None and prev_close is not None) else None
        change_pct = (
            (ref - prev_close) / prev_close
            if (ref is not None and prev_close not in (None, 0))
            else None
        )

        oi = md.get("OI")
        oi_size = oi.get("size") if isinstance(oi, dict) else _num(oi)
        volume = _num(md.get("EV")) or _num(md.get("TV")) or _num(md.get("NV"))

        return {
            "symbol": symbol,
            "maturityDate": mat,
            "daysToMaturity": days,
            "bid": bid,
            "bidSize": bid_size,
            "ask": ask,
            "askSize": ask_size,
            "mid": mid,
            "last": last,
            "open": _num(md.get("OP")),
            "high": _num(md.get("HI")),
            "low": _num(md.get("LO")),
            "prevClose": prev_close,
            "settlement": settlement,
            "volume": volume,
            "openInterest": oi_size,
            "trades": _num(md.get("TC")),
            "spreadAbs": spread_abs,
            "spreadBps": spread_bps,
            "changeAbs": change_abs,
            "changePct": change_pct,
            "bidLevels": bid_levels,
            "askLevels": ask_levels,
            "ts": ts,
        }

    def snapshot(self) -> dict:
        symbols = self.symbols()
        contracts = [s for s in (self.build_summary(sym) for sym in symbols) if s]
        contracts.sort(key=lambda c: c["daysToMaturity"])
        return {"contracts": contracts, "ts": time.time() * 1000.0}

    def take_dirty(self) -> list[str]:
        with self._lock:
            d = list(self._dirty)
            self._dirty.clear()
            return d


store = MarketStore()
