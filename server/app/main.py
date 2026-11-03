"""
Server FastAPI: bridge entre Primary (pyRofex) + Alpaca y el cliente React.

  REST:  GET  /api/health
         GET  /api/snapshot      (snapshot computado: ADR, spot, futuros, TNA/TEA, CCL)
         GET  /api/instruments   (debug: instrumentos GGAL descubiertos)
         POST /api/feed/start     (enciende la traída de datos en tiempo real)
         POST /api/feed/stop      (la apaga: corta los websockets de Primary y Alpaca)
  WS:    /ws                      (broadcast de snapshot computado + status)

El feed arranca APAGADO: no se conecta a Primary/Alpaca hasta que la UI lo
enciende (botón). Así no se mantiene la sesión del broker abierta de gusto.

Solo market data. No envía órdenes.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .alpaca import alpaca
from .finnhub import finnhub
from .config import config
from .market_hours import market_status, us_market_status
from .primary import primary
from .store import store

logging.basicConfig(
    level=getattr(logging, config.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("server")


def _msg(type_: str, data=None) -> dict:
    return {"type": type_, "data": data, "ts": time.time() * 1000.0}


def _status() -> dict:
    return {
        "feedEnabled": store.feed_enabled,
        "primaryState": primary.state,
        "adrState": finnhub.state,
        "market": market_status(),
        "usMarket": us_market_status(),
    }


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: dict[WebSocket, asyncio.Queue] = {}

    async def connect(self, ws: WebSocket) -> asyncio.Queue:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._clients[ws] = q
        log.info("Cliente WS conectado (%d totales)", len(self._clients))
        return q

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.pop(ws, None)
        log.info("Cliente WS desconectado (%d totales)", len(self._clients))

    @property
    def count(self) -> int:
        return len(self._clients)

    def broadcast(self, message: dict) -> None:
        for q in self._clients.values():
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass  # cliente lento: se descarta el mensaje


manager = ConnectionManager()


async def _broadcaster() -> None:
    """Reparte el snapshot computado cuando cambió algo, y el status cada ~1s."""
    last_status = 0.0
    while True:
        try:
            await asyncio.sleep(0.25)
            if manager.count == 0:
                continue

            if store.take_dirty():
                manager.broadcast(_msg("snapshot", store.computed_snapshot()))

            now = time.time()
            if now - last_status >= 1.0:
                last_status = now
                manager.broadcast(_msg("status", _status()))
        except asyncio.CancelledError:
            break
        except Exception:  # noqa: BLE001
            log.exception("Error en broadcaster")


async def _apply_feed_state() -> None:
    """Conecta o desconecta las fuentes de datos según el flag de feed."""
    if store.feed_enabled:
        if not primary.bootstrapped:
            await asyncio.to_thread(primary.bootstrap)
        await asyncio.to_thread(primary.connect_ws)
        with contextlib.suppress(Exception):
            finnhub.start()
    else:
        with contextlib.suppress(Exception):
            finnhub.stop()
        await asyncio.to_thread(primary.disconnect_ws, "feed apagado")


async def _connection_supervisor() -> None:
    """Mantiene el estado de las conexiones alineado con el flag de feed:
    reconecta si se cayó estando encendido, y corta si se apagó."""
    while True:
        try:
            await _apply_feed_state()
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            break
        except Exception:  # noqa: BLE001
            log.exception("Error en connection supervisor")
            await asyncio.sleep(10)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "Iniciando server en %s:%d · feed APAGADO (encendé desde la UI)",
        config.host, config.port,
    )
    tasks = [
        asyncio.create_task(_broadcaster()),
        asyncio.create_task(_connection_supervisor()),
    ]
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        with contextlib.suppress(Exception):
            await asyncio.gather(*tasks, return_exceptions=True)
        with contextlib.suppress(Exception):
            finnhub.stop()
        await asyncio.to_thread(primary.disconnect_ws, "shutdown")


app = FastAPI(title="GGAL · ADR / BYMA / Futuros", lifespan=lifespan)

_allow_origins = (
    ["*"]
    if config.cors_origins.strip() == "*"
    else [o.strip() for o in config.cors_origins.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"ok": True, **_status(), "ts": time.time() * 1000.0}


@app.get("/api/instruments")
async def instruments():
    return store.instruments_debug()


@app.get("/api/adr/bars")
async def adr_bars():
    return await asyncio.to_thread(alpaca.fetch_bars)


@app.get("/api/snapshot")
async def snapshot():
    snap = store.computed_snapshot()
    snap["status"] = _status()
    return snap


@app.post("/api/feed/start")
async def feed_start():
    store.set_feed_enabled(True)
    await _apply_feed_state()
    return {"feedEnabled": True}


@app.post("/api/feed/stop")
async def feed_stop():
    store.set_feed_enabled(False)
    await _apply_feed_state()
    return {"feedEnabled": False}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    q = await manager.connect(ws)

    await ws.send_json(_msg("snapshot", store.computed_snapshot()))
    await ws.send_json(_msg("status", _status()))

    async def sender():
        while True:
            message = await q.get()
            await ws.send_json(message)

    sender_task = asyncio.create_task(sender())
    try:
        while True:
            raw = await ws.receive_json()
            if raw.get("type") == "ping":
                await ws.send_json(_msg("pong"))
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.debug("WS receive terminó", exc_info=True)
    finally:
        sender_task.cancel()
        with contextlib.suppress(Exception):
            await sender_task
        manager.disconnect(ws)
