"""
Server FastAPI: bridge entre pyRofex (Primary) y el cliente React.

  REST:  GET  /api/health
         GET  /api/contracts
         GET  /api/snapshot
         POST /api/spot
  WS:    /ws   (broadcast de snapshot/quote/spot/status)

Solo market data. No envía órdenes.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import config
from .market_hours import is_market_open, market_status
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


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: dict[WebSocket, asyncio.Queue] = {}

    async def connect(self, ws: WebSocket) -> asyncio.Queue:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
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
    """Empuja quotes incrementales, spot y status a los clientes conectados."""
    last_spot: float | None = None
    last_status = 0.0
    while True:
        try:
            await asyncio.sleep(0.2)
            if manager.count == 0:
                continue

            # Quotes incrementales (símbolos que cambiaron)
            for sym in store.take_dirty():
                summary = store.build_summary(sym)
                if summary:
                    manager.broadcast(_msg("quote", summary))

            # Spot (solo en cambio)
            spot = store.get_spot()
            if spot != last_spot:
                last_spot = spot
                manager.broadcast(_msg("spot", spot))

            # Status cada ~1s
            now = time.time()
            if now - last_status >= 1.0:
                last_status = now
                manager.broadcast(_msg("status", {
                    "primaryState": primary.state,
                    "market": market_status(),
                }))
        except asyncio.CancelledError:
            break
        except Exception:  # noqa: BLE001
            log.exception("Error en broadcaster")


async def _hours_supervisor() -> None:
    """Abre/cierra el websocket de Primary según horario de mercado."""
    while True:
        try:
            open_ = is_market_open()
            if open_ and primary.state in ("disconnected", "idle"):
                await asyncio.to_thread(primary.connect_ws)
            elif not open_ and primary.state in ("connected", "connecting"):
                await asyncio.to_thread(primary.disconnect_ws, "mercado cerrado")
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            break
        except Exception:  # noqa: BLE001
            log.exception("Error en hours supervisor")
            await asyncio.sleep(30)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Iniciando server en %s:%d", config.host, config.port)
    try:
        await asyncio.to_thread(primary.bootstrap)
    except Exception:  # noqa: BLE001
        log.exception("Bootstrap pyRofex falló (se reintentará al abrir mercado)")

    tasks = [
        asyncio.create_task(_broadcaster()),
        asyncio.create_task(_hours_supervisor()),
    ]
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        with contextlib.suppress(Exception):
            await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.to_thread(primary.disconnect_ws, "shutdown")


app = FastAPI(title="Derivados · Screener DLR", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "primaryState": primary.state,
        "market": market_status(),
        "ts": time.time() * 1000.0,
    }


@app.get("/api/contracts")
async def contracts():
    return store.contracts()


@app.get("/api/snapshot")
async def snapshot():
    snap = store.snapshot()
    snap["spot"] = store.get_spot()
    snap["market"] = market_status()
    snap["primaryState"] = primary.state
    return snap


class SpotBody(BaseModel):
    spot: float | None = None


@app.post("/api/spot")
async def set_spot(body: SpotBody):
    store.set_spot(body.spot)
    return {"ok": True, "spot": store.get_spot()}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    q = await manager.connect(ws)

    # Snapshot inicial + status
    snap = store.snapshot()
    snap["spot"] = store.get_spot()
    await ws.send_json(_msg("snapshot", snap))
    await ws.send_json(_msg("status", {
        "primaryState": primary.state,
        "market": market_status(),
    }))

    async def sender():
        while True:
            message = await q.get()
            await ws.send_json(message)

    sender_task = asyncio.create_task(sender())
    try:
        while True:
            raw = await ws.receive_json()
            mtype = raw.get("type")
            if mtype == "ping":
                await ws.send_json(_msg("pong"))
            elif mtype == "setSpot":
                v = raw.get("spot")
                store.set_spot(v if isinstance(v, (int, float)) and v > 0 else None)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.debug("WS receive terminó", exc_info=True)
    finally:
        sender_task.cancel()
        with contextlib.suppress(Exception):
            await sender_task
        manager.disconnect(ws)
