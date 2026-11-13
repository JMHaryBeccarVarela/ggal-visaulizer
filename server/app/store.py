"""
Store en memoria de market data (thread-safe), multi-activo.

Combina dos fuentes:
  - Primary (pyRofex): acciones en BYMA (CI y 24hs), índices y futuros de Rofex,
    bonos para el CCL y cauciones. Los callbacks llegan en el thread del
    websocket de pyRofex.
  - Finnhub: ADRs y referencias externas (thread propio).

FastAPI corre en el loop asyncio de uvicorn. Un lock protege las lecturas y
escrituras entre esos threads. El server arma un snapshot computado por activo
(tasas implícitas, teórico por caución, cartel, CCL) y lo reparte por WebSocket.
"""
from __future__ import annotations

import threading
import time
from typing import Any

from .assets import ASSETS, Asset
from .config import config
from .market_hours import days_to_maturity
from .rates import compute_rates, theoretical_growth

# Un "último operado" se toma como operación en vivo (y se le asocia el spot
# del momento) solo si su timestamp es reciente; si no, es un dato viejo.
_LIVE_TRADE_MS = 15_000

_PRICE_KEYS = ("last", "bid", "ask", "open", "high", "low", "prevClose")


def _num(v: Any) -> float | None:
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _price_of(v: Any) -> float | None:
    """CL/LA/SE/IV pueden venir como número o como {'price':.., 'date':..}."""
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        p = v.get("price")
        return float(p) if isinstance(p, (int, float)) else None
    return None


def _ref_price(summary: dict | None) -> float | None:
    """Precio de referencia de un instrumento: último → mid → settlement
    → cierre previo."""
    if not summary:
        return None
    for key in ("last", "mid", "settlement", "prevClose"):
        v = summary.get(key)
        if isinstance(v, (int, float)):
            return float(v)
    return None


class MarketStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._inst: dict[str, dict] = {}       # symbol -> instrument detail (Primary)
        self._role: dict[str, str] = {}        # symbol -> "future" | "ci" | "t24" | "index" | aux
        self._owner: dict[str, str] = {}       # symbol de futuro -> id del activo
        self._md: dict[str, dict] = {}         # symbol -> marketData mergeado
        self._last_update: dict[str, float] = {}
        # id del activo -> {"futures": [symbols], "ci": sym, "t24": sym, "index": sym}
        self._assets: dict[str, dict] = {}
        self._aux: dict[str, str] = {}         # "bondArs" | "bondUsd" | "caucion" | "caucionShort" -> symbol
        self._caucion_days: int | None = None
        self._caucion_short_days: int | None = None
        self._trade_spot: dict[str, dict] = {} # futuro -> {"spot", "ts"} al operarse
        self._ext: dict[str, dict] = {}        # símbolo Finnhub -> campos mergeados
        self._ext_ts: dict[str, float] = {}
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
        per_asset: dict[str, dict],
        aux: dict[str, dict] | None = None,
        caucion_days: int | None = None,
        caucion_short_days: int | None = None,
    ) -> None:
        """per_asset: id -> {"futures": [inst], "ci": inst, "t24": inst, "index": inst}."""
        with self._lock:
            self._inst = {}
            self._role = {}
            self._owner = {}
            self._assets = {}
            self._aux = {}
            self._caucion_days = caucion_days
            self._caucion_short_days = caucion_short_days

            for role, inst in (aux or {}).items():
                sym = inst["instrumentId"]["symbol"]
                self._inst[sym] = inst
                self._role[sym] = role
                self._aux[role] = sym

            for asset_id, found in per_asset.items():
                entry: dict = {"futures": [], "ci": None, "t24": None, "index": None}
                for f in found.get("futures") or []:
                    sym = f["instrumentId"]["symbol"]
                    self._inst[sym] = f
                    self._role[sym] = "future"
                    self._owner[sym] = asset_id
                    entry["futures"].append(sym)
                for role in ("ci", "t24", "index"):
                    inst = found.get(role)
                    if inst:
                        sym = inst["instrumentId"]["symbol"]
                        self._inst[sym] = inst
                        self._role[sym] = role
                        entry[role] = sym
                self._assets[asset_id] = entry

    def instruments_debug(self) -> dict:
        with self._lock:
            return {"assets": dict(self._assets), "aux": dict(self._aux)}

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
        spot = self._spot_now(self._owner.get(symbol))
        if spot is None:
            self._trade_spot.pop(symbol, None)
            return
        self._trade_spot[symbol] = {"spot": spot, "ts": now}

    def _spot_now(self, asset_id: str | None) -> float | None:
        """Último precio del spot de un activo en este instante. Requiere lock."""
        asset = next((a for a in ASSETS if a.id == asset_id), None)
        entry = self._assets.get(asset_id or "")
        if not asset or not entry:
            return None
        if asset.kind == "adr":
            use_t24 = config.spot_settlement.lower() == "24hs"
            order = (entry["t24"], entry["ci"]) if use_t24 else (entry["ci"], entry["t24"])
            for sym in order:
                last = _price_of(self._md.get(sym or "", {}).get("LA"))
                if last is not None:
                    return last
            return None
        if asset.kind == "index":
            md = self._md.get(entry["index"] or "", {})
            return _price_of(md.get("IV")) or _price_of(md.get("LA"))
        if asset.kind == "ext" and asset.ext:
            last = _num(self._ext.get(asset.ext, {}).get("last"))
            return last * asset.ext_scale if last is not None else None
        return None

    # ---------- referencias externas (Finnhub) ----------
    def update_ext(self, symbol: str, fields: dict) -> None:
        with self._lock:
            cur = self._ext.setdefault(symbol, {})
            for k, v in fields.items():
                if v is not None:
                    cur[k] = v
            self._ext_ts[symbol] = time.time() * 1000.0
            self._dirty = True

    # ---------- dirty flag ----------
    def take_dirty(self) -> bool:
        with self._lock:
            d = self._dirty
            self._dirty = False
            return d

    # ---------- summaries ----------
    def _summary(self, symbol: str | None) -> dict | None:
        """Resumen de un instrumento local. Requiere lock."""
        inst = self._inst.get(symbol or "")
        if not inst or not symbol:
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
        if last is None and role == "index":
            last = _price_of(md.get("IV"))  # los índices publican valor, no operaciones
        settlement = _price_of(md.get("SE"))
        prev_close = _price_of(md.get("CL"))

        summary = {
            "symbol": symbol,
            "role": role,
            "label": self._label(symbol, role),
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
    def _label(symbol: str, role: str) -> str:
        if role == "ci":
            return "CI"
        if role == "t24":
            return "24hs"
        # future: "GGAL/DIC26" -> "DIC26"
        idx = symbol.find("/")
        return symbol[idx + 1:] if idx >= 0 else symbol

    def _ext_summary(self, symbol: str | None, scale: float = 1.0) -> dict | None:
        """Resumen de una referencia externa (ADR, BTC, GLD). Requiere lock."""
        if not symbol:
            return None
        raw = self._ext.get(symbol, {})
        q = {k: (_num(raw.get(k)) * scale if _num(raw.get(k)) is not None else None)
             for k in _PRICE_KEYS}
        last, prev_close, bid, ask = q["last"], q["prevClose"], q["bid"], q["ask"]
        ref = last if last is not None else (
            (bid + ask) / 2 if (bid is not None and ask is not None) else None
        )
        return {
            "symbol": symbol,
            **q,
            "bidSize": _num(raw.get("bidSize")),
            "askSize": _num(raw.get("askSize")),
            "volume": _num(raw.get("volume")),
            "ref": ref,
            "changeAbs": (ref - prev_close) if (ref is not None and prev_close is not None) else None,
            "changePct": (
                (ref - prev_close) / prev_close
                if (ref is not None and prev_close not in (None, 0))
                else None
            ),
            "ts": self._ext_ts.get(symbol, 0.0),
        }

    # ---------- snapshot computado ----------
    def computed_snapshot(self) -> dict:
        with self._lock:
            raw: dict[str, dict] = {}
            for a in ASSETS:
                entry = self._assets.get(a.id) or {}
                raw[a.id] = {
                    "futures": [s for s in (self._summary(sym) for sym in entry.get("futures", [])) if s],
                    "ci": self._summary(entry.get("ci")),
                    "t24": self._summary(entry.get("t24")),
                    "index": self._summary(entry.get("index")),
                    "ext": self._ext_summary(a.ext, a.ext_scale),
                }
            aux = {role: self._summary(sym) for role, sym in self._aux.items()}
            trade_spot = dict(self._trade_spot)
            caucion_days = self._caucion_days
            caucion_short_days = self._caucion_short_days

        # Cauciones en pesos: cotizan en TNA %.
        caucion_pct = _ref_price(aux.get("caucion"))
        caucion_tna = caucion_pct / 100.0 if caucion_pct is not None else None
        short_pct = _ref_price(aux.get("caucionShort"))

        # CCL por bonos (último operado de cada uno).
        bond_ars = aux.get("bondArs")
        bond_usd = aux.get("bondUsd")
        ars_last = bond_ars.get("last") if bond_ars else None
        usd_last = bond_usd.get("last") if bond_usd else None
        ccl_bond = ars_last / usd_last if (ars_last and usd_last) else None

        assets = {
            a.id: self._compute_asset(
                a, raw[a.id], trade_spot, caucion_tna, caucion_days, short_pct, ccl_bond
            )
            for a in ASSETS
        }

        return {
            "assets": assets,
            "order": [a.id for a in ASSETS],
            "fx": {
                "bondArs": config.bond_ars,
                "bondUsd": config.bond_usd,
                "settlement": config.bond_settlement,
                "bondArsLast": ars_last,
                "bondUsdLast": usd_last,
                "cclBond": ccl_bond,
            },
            "caucion": {
                "days": caucion_days,
                "tna": caucion_tna,
                "shortDays": caucion_short_days,
                "shortTna": short_pct / 100.0 if short_pct is not None else None,
                "threshold": config.signal_threshold,
            },
            "ts": time.time() * 1000.0,
        }

    @staticmethod
    def _compute_asset(
        a: Asset,
        raw: dict,
        trade_spot: dict,
        caucion_tna: float | None,
        caucion_days: int | None,
        short_pct: float | None,
        ccl_bond: float | None,
    ) -> dict:
        ci, t24, index, ext, futures = (
            raw["ci"], raw["t24"], raw["index"], raw["ext"], raw["futures"],
        )

        # ---- spot de referencia según el tipo de activo ----
        if a.kind == "adr":
            use_t24 = config.spot_settlement.lower() == "24hs"
            spot_summary = (t24 or ci) if use_t24 else (ci or t24)
            spot_label = "24hs" if spot_summary is t24 else ("CI" if spot_summary else config.spot_settlement)
        elif a.kind == "index":
            spot_summary, spot_label = index, "índice Rofex"
        elif a.kind == "ext":
            spot_summary, spot_label = ext, a.ext_label or "ref."
        else:  # "rate": la referencia es la caución corta (en TNA %)
            spot_summary, spot_label = None, "caución"
        spot_ref = short_pct if a.kind == "rate" else _ref_price(spot_summary)
        # Sin último/valor en vivo el spot es el cierre anterior: las tasas quedan
        # desfasadas, así que no se muestra cartel.
        spot_stale = (
            a.kind != "rate" and spot_ref is not None
            and (spot_summary or {}).get("last") is None
        )

        # ---- futuros ----
        for fut in futures:
            days = fut.get("daysToMaturity")
            fut["spotRef"] = spot_ref
            rec = trade_spot.get(fut["symbol"])
            fut["tradeSpot"] = rec["spot"] if rec else None
            fut["tradeTs"] = rec["ts"] if rec else None

            if a.kind == "rate":
                # El precio del futuro ya es una tasa: se compara en puntos contra la caución.
                fut["rates"] = compute_rates(None, None, days).as_dict()
                fut["tnaLast"] = fut["tnaBid"] = fut["tnaAsk"] = None
                fut["tnaTheo"] = fut["theoPrice"] = None
                fut["signal"] = fut["signalEdge"] = None
                for side in ("bid", "last", "ask"):
                    p = fut.get(side)
                    fut[f"{side}Diff"] = (p - spot_ref) if (p is not None and spot_ref is not None) else None
                continue

            # TNA/TEA del último operado, contra el spot del instante de la
            # operación (sin operación vista en vivo quedan en None).
            r = compute_rates(fut.get("last"), rec["spot"] if rec else None, days)
            fut["rates"] = r.as_dict()
            fut["tnaLast"] = r.tna
            fut["tnaBid"] = compute_rates(fut.get("bid"), spot_ref, days).tna
            fut["tnaAsk"] = compute_rates(fut.get("ask"), spot_ref, days).tna

            # Teórico por cost of carry (renovando la caución) y cartel.
            growth = theoretical_growth(caucion_tna, caucion_days, days) if a.carry else None
            tna_theo = (growth - 1.0) * (365 / days) if growth is not None else None
            fut["tnaTheo"] = tna_theo
            fut["theoPrice"] = spot_ref * growth if (growth is not None and spot_ref) else None
            signal, edge = None, None
            if tna_theo is not None and not spot_stale:
                thr = config.signal_threshold
                if fut["tnaBid"] is not None and fut["tnaBid"] - tna_theo > thr:
                    signal, edge = "sell", fut["tnaBid"] - tna_theo
                elif fut["tnaAsk"] is not None and tna_theo - fut["tnaAsk"] > thr:
                    signal, edge = "buy", tna_theo - fut["tnaAsk"]
            fut["signal"] = signal
            fut["signalEdge"] = edge

        # ---- dólar implícito contra la referencia en USD y valor teórico ----
        # (ADR: acción × ratio ÷ ADR; BTC: índice en pesos ÷ BTC en dólares)
        ccl = theo = None
        ext_last = ext.get("last") if ext else None
        if a.currency == "ARS" and a.kind in ("adr", "index") and ext_last and spot_ref:
            ccl = spot_ref * a.ratio / ext_last
            if ccl_bond:
                theo = ext_last * ccl_bond / a.ratio

        return {
            "id": a.id,
            "label": a.label,
            "kind": a.kind,
            "currency": a.currency,
            "carry": a.carry,
            "ext": ext,
            "extLabel": a.ext_label,
            "extScale": a.ext_scale,
            "chart": a.chart,
            "ratio": a.ratio,
            "spot": {
                "ci": ci,
                "t24": t24,
                "index": index,
                "used": spot_label,
                "ref": spot_ref,
                "stale": spot_stale,
                "changePct": spot_summary.get("changePct") if spot_summary else None,
            },
            "futures": futures,
            "ccl": ccl,
            "gapPct": (ccl / ccl_bond - 1.0) if (ccl and ccl_bond) else None,
            "theoSpot": theo,
            "theoDiff": (spot_ref - theo) if (theo and spot_ref) else None,
            "theoDiffPct": (spot_ref / theo - 1.0) if (theo and spot_ref) else None,
            # Cartel del activo (el del vencimiento más cercano que tenga señal).
            "signal": next((f["signal"] for f in futures if f.get("signal")), None),
        }


store = MarketStore()
