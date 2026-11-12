"""
Store en memoria de market data (thread-safe).

Combina dos fuentes:
  - Primary (pyRofex): acción GGAL en BYMA (plazos CI y 24hs) y futuros GGAL.
    Los callbacks llegan en un thread propio del websocket de pyRofex.
  - Alpaca: ADR de GGAL (NYSE/NASDAQ). Llega en el thread del websocket de Alpaca.

FastAPI corre en el loop asyncio de uvicorn. Un lock protege las lecturas y
escrituras entre esos threads. El server arma un snapshot computado (con
TNA/TEA de cada futuro y el dólar implícito) y lo reparte por WebSocket.
"""
from __future__ import annotations

import threading
import time
from typing import Any

from .config import config
from .market_hours import days_to_maturity
from .rates import compute_rates, theoretical_growth

# Un "último operado" se toma como operación en vivo (y se le asocia el spot
# del momento) solo si su timestamp es reciente; si no, es un dato viejo.
_LIVE_TRADE_MS = 15_000


def _num(v: Any) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _price_of(v: Any) -> float | None:
    """CL/LA/SE pueden venir como número o como {'price':.., 'date':..}."""
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        p = v.get("price")
        return float(p) if isinstance(p, (int, float)) else None
    return None


def _ref_price(summary: dict) -> float | None:
    """Precio de referencia de un instrumento local: último → mid → settlement
    → cierre previo."""
    for key in ("last", "mid", "settlement", "prevClose"):
        v = summary.get(key)
        if isinstance(v, (int, float)):
            return float(v)
    return None


class MarketStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._inst: dict[str, dict] = {}       # symbol -> instrument detail (Primary)
        self._role: dict[str, str] = {}        # symbol -> "future" | "ci" | "t24"
        self._md: dict[str, dict] = {}         # symbol -> marketData mergeado
        self._last_update: dict[str, float] = {}
        self._future_order: list[str] = []     # símbolos de futuros ordenados por vto
        self._ci_symbol: str | None = None
        self._t24_symbol: str | None = None
        self._aux: dict[str, str] = {}         # "bondArs" | "bondUsd" | "caucion" -> symbol
        self._caucion_days: int | None = None
        self._trade_spot: dict[str, dict] = {} # futuro -> {"spot", "ts"} al operarse
        self._adr: dict[str, Any] = {}         # ADR (Alpaca) mergeado
        self._adr_ts: float = 0.0
        self._dirty = False
        self._feed_enabled = False

    # ---------- feed on/off ----------
    @property
    def feed_enabled(self) -> bool:
        with self._lock:
            return self._feed_enabled

    def set_feed_enabled(self, value: bool) -> None:
        with self._lock:
            self._feed_enabled = bool(value)

    # ---------- instrumentos (Primary) ----------
    def set_instruments(
        self,
        futures: list[dict],
        equity_ci: dict | None,
        equity_t24: dict | None,
        aux: dict[str, dict] | None = None,
        caucion_days: int | None = None,
    ) -> None:
        with self._lock:
            self._inst = {}
            self._role = {}
            self._future_order = []
            self._aux = {}
            self._caucion_days = caucion_days

            for role, inst in (aux or {}).items():
                sym = inst["instrumentId"]["symbol"]
                self._inst[sym] = inst
                self._role[sym] = role
                self._aux[role] = sym

            for f in futures:
                sym = f["instrumentId"]["symbol"]
                self._inst[sym] = f
                self._role[sym] = "future"
                self._future_order.append(sym)

            if equity_ci:
                sym = equity_ci["instrumentId"]["symbol"]
                self._inst[sym] = equity_ci
                self._role[sym] = "ci"
                self._ci_symbol = sym
            if equity_t24:
                sym = equity_t24["instrumentId"]["symbol"]
                self._inst[sym] = equity_t24
                self._role[sym] = "t24"
                self._t24_symbol = sym

    def subscribed_symbols(self) -> list[str]:
        with self._lock:
            return list(self._inst.keys())

    def instruments_debug(self) -> dict:
        with self._lock:
            return {
                "futures": list(self._future_order),
                "ci": self._ci_symbol,
                "t24": self._t24_symbol,
            }

    # ---------- market data local (Primary) ----------
    def update_market_data(self, symbol: str, partial: dict) -> None:
        with self._lock:
            if symbol not in self._inst:
                return
            prev = self._md.get(symbol, {})
            now = time.time() * 1000.0
            if self._role.get(symbol) == "future":
                self._track_trade(symbol, prev.get("LA"), partial.get("LA"), now)
            merged = dict(prev)
            for k, v in partial.items():
                if v is not None:
                    merged[k] = v
            self._md[symbol] = merged
            self._last_update[symbol] = now
            self._dirty = True

    def _track_trade(self, symbol: str, old: Any, new: Any, now: float) -> None:
        """Al operarse un futuro, guarda el spot de ese instante para que la TNA
        del último operado no se mueva después con el spot. Requiere lock."""
        if new is None or old is None or new == old:
            return
        date = new.get("date") if isinstance(new, dict) else None
        if isinstance(date, (int, float)) and now - date > _LIVE_TRADE_MS:
            # Operación vieja (p.ej. tras reconectar): no se sabe el spot de ese momento.
            self._trade_spot.pop(symbol, None)
            return
        spot = self._spot_now()
        if spot is None:
            self._trade_spot.pop(symbol, None)
            return
        self._trade_spot[symbol] = {"spot": spot, "ts": now}

    def _spot_now(self) -> float | None:
        """Último precio del spot configurado (fallback: el otro plazo). Requiere lock."""
        use_t24 = config.spot_settlement.lower() == "24hs"
        order = (self._t24_symbol, self._ci_symbol) if use_t24 else (self._ci_symbol, self._t24_symbol)
        for sym in order:
            if not sym:
                continue
            last = _price_of(self._md.get(sym, {}).get("LA"))
            if last is not None:
                return last
        return None

    # ---------- ADR (Alpaca) ----------
    def update_adr(self, fields: dict) -> None:
        with self._lock:
            for k, v in fields.items():
                if v is not None:
                    self._adr[k] = v
            self._adr_ts = time.time() * 1000.0
            self._dirty = True

    # ---------- dirty flag ----------
    def take_dirty(self) -> bool:
        with self._lock:
            d = self._dirty
            self._dirty = False
            return d

    # ---------- summaries ----------
    def _summary(self, symbol: str) -> dict | None:
        """Resumen de un instrumento local (acción o futuro). Requiere lock."""
        inst = self._inst.get(symbol)
        if not inst:
            return None
        md = self._md.get(symbol, {})
        ts = self._last_update.get(symbol, 0)
        role = self._role.get(symbol, "")

        mat = inst.get("maturityDate")
        days = days_to_maturity(mat) if mat else None

        bids = md.get("BI") or []
        offers = md.get("OF") or []
        bid = bids[0]["price"] if bids else None
        bid_size = bids[0].get("size") if bids else None
        ask = offers[0]["price"] if offers else None
        ask_size = offers[0].get("size") if offers else None
        mid = (bid + ask) / 2 if (bid is not None and ask is not None) else None

        last = _price_of(md.get("LA"))
        settlement = _price_of(md.get("SE"))
        prev_close = _price_of(md.get("CL"))

        summary = {
            "symbol": symbol,
            "role": role,
            "label": self._label(symbol, role, mat),
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
            "volume": _num(md.get("EV")) or _num(md.get("TV")) or _num(md.get("NV")),
            "openInterest": (
                md["OI"].get("size") if isinstance(md.get("OI"), dict) else _num(md.get("OI"))
            ),
            "ts": ts,
        }
        ref = _ref_price(summary)
        summary["ref"] = ref
        summary["changeAbs"] = (
            ref - prev_close if (ref is not None and prev_close is not None) else None
        )
        summary["changePct"] = (
            (ref - prev_close) / prev_close
            if (ref is not None and prev_close not in (None, 0))
            else None
        )
        return summary

    @staticmethod
    def _label(symbol: str, role: str, mat: str | None) -> str:
        if role == "ci":
            return "GGAL · CI"
        if role == "t24":
            return "GGAL · 24hs"
        # future: "GGAL/DIC25" -> "DIC25"
        idx = symbol.find("/")
        return symbol[idx + 1:] if idx >= 0 else symbol

    def _adr_summary(self) -> dict | None:
        if not config.alpaca_enabled:
            return None
        adr = self._adr
        last = _num(adr.get("last"))
        prev_close = _num(adr.get("prevClose"))
        bid = _num(adr.get("bid"))
        ask = _num(adr.get("ask"))
        ref = last if last is not None else (
            (bid + ask) / 2 if (bid is not None and ask is not None) else None
        )
        return {
            "symbol": config.adr_symbol,
            "last": last,
            "bid": bid,
            "bidSize": _num(adr.get("bidSize")),
            "ask": ask,
            "askSize": _num(adr.get("askSize")),
            "open": _num(adr.get("open")),
            "high": _num(adr.get("high")),
            "low": _num(adr.get("low")),
            "prevClose": prev_close,
            "volume": _num(adr.get("volume")),
            "ref": ref,
            "changeAbs": (ref - prev_close) if (ref is not None and prev_close is not None) else None,
            "changePct": (
                (ref - prev_close) / prev_close
                if (ref is not None and prev_close not in (None, 0))
                else None
            ),
            "ts": self._adr_ts,
        }

    # ---------- snapshot computado ----------
    def computed_snapshot(self) -> dict:
        with self._lock:
            ci = self._summary(self._ci_symbol) if self._ci_symbol else None
            t24 = self._summary(self._t24_symbol) if self._t24_symbol else None
            futures = [s for s in (self._summary(sym) for sym in self._future_order) if s]
            adr = self._adr_summary()
            aux = {role: self._summary(sym) for role, sym in self._aux.items()}
            trade_spot = dict(self._trade_spot)
            caucion_days = self._caucion_days

        # Spot de referencia para la tasa: el plazo configurado, con fallback.
        spot_used = config.spot_settlement.lower()
        primary_spot = t24 if spot_used == "24hs" else ci
        fallback_spot = ci if spot_used == "24hs" else t24
        spot_summary = primary_spot or fallback_spot
        spot_ref = _ref_price(spot_summary) if spot_summary else None
        spot_label = "24hs" if (spot_summary is t24) else ("CI" if spot_summary else spot_used)

        # Caución en pesos (tasa libre de riesgo): cotiza en TNA %.
        caucion = aux.get("caucion")
        caucion_pct = _ref_price(caucion) if caucion else None
        caucion_tna = caucion_pct / 100.0 if caucion_pct is not None else None

        for fut in futures:
            days = fut.get("daysToMaturity")
            # TNA/TEA del último operado, contra el spot del instante de la
            # operación (sin operación vista en vivo quedan en None).
            rec = trade_spot.get(fut["symbol"])
            r = compute_rates(fut.get("last"), rec["spot"] if rec else None, days)
            fut["rates"] = r.as_dict()
            fut["spotRef"] = spot_ref

            fut["tradeSpot"] = rec["spot"] if rec else None
            fut["tradeTs"] = rec["ts"] if rec else None
            fut["tnaLast"] = (
                compute_rates(fut.get("last"), rec["spot"], days).tna if rec else None
            )
            fut["tnaBid"] = compute_rates(fut.get("bid"), spot_ref, days).tna
            fut["tnaAsk"] = compute_rates(fut.get("ask"), spot_ref, days).tna

            # Teórico por cost of carry (renovando la caución) y cartel.
            growth = theoretical_growth(caucion_tna, caucion_days, days)
            tna_theo = (growth - 1.0) * (365 / days) if growth is not None else None
            fut["tnaTheo"] = tna_theo
            fut["theoPrice"] = (
                spot_ref * growth if (growth is not None and spot_ref) else None
            )
            signal, edge = None, None
            if tna_theo is not None:
                thr = config.signal_threshold
                if fut["tnaBid"] is not None and fut["tnaBid"] - tna_theo > thr:
                    signal, edge = "sell", fut["tnaBid"] - tna_theo
                elif fut["tnaAsk"] is not None and tna_theo - fut["tnaAsk"] > thr:
                    signal, edge = "buy", tna_theo - fut["tnaAsk"]
            fut["signal"] = signal
            fut["signalEdge"] = edge

        # Dólar implícito (CCL) desde el ADR: (precio_BYMA_ARS * ratio) / ADR_USD
        ccl = None
        if adr and adr.get("last") and spot_ref:
            try:
                ccl = (spot_ref * config.adr_ratio) / adr["last"]
            except ZeroDivisionError:
                ccl = None

        # CCL por bonos (último operado de cada uno) y valor teórico de la acción.
        bond_ars = aux.get("bondArs")
        bond_usd = aux.get("bondUsd")
        ars_last = bond_ars.get("last") if bond_ars else None
        usd_last = bond_usd.get("last") if bond_usd else None
        ccl_bond = ars_last / usd_last if (ars_last and usd_last) else None
        theo_stock = (
            adr["last"] * ccl_bond / config.adr_ratio
            if (ccl_bond and adr and adr.get("last") and config.adr_ratio)
            else None
        )
        fx = {
            "bondArs": config.bond_ars,
            "bondUsd": config.bond_usd,
            "settlement": config.bond_settlement,
            "bondArsLast": ars_last,
            "bondUsdLast": usd_last,
            "cclBond": ccl_bond,
            "cclAdr": ccl,
            "gapPct": (ccl / ccl_bond - 1.0) if (ccl and ccl_bond) else None,
            "theoStock": theo_stock,
            "theoDiff": (spot_ref - theo_stock) if (theo_stock and spot_ref) else None,
            "theoDiffPct": (spot_ref / theo_stock - 1.0) if (theo_stock and spot_ref) else None,
        }

        return {
            "adr": adr,
            "spot": {"ci": ci, "t24": t24, "used": spot_label, "ref": spot_ref},
            "futures": futures,
            "ccl": ccl,
            "fx": fx,
            "caucion": {
                "days": caucion_days,
                "tna": caucion_tna,
                "threshold": config.signal_threshold,
            },
            "adrRatio": config.adr_ratio,
            "ts": time.time() * 1000.0,
        }


store = MarketStore()
