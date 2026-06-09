"""Configuración del server, cargada desde server/.env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Cargar .env ubicado en server/ (un nivel arriba de app/)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)


def _require(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Falta variable de entorno requerida: {name}")
    return val


@dataclass(frozen=True)
class Config:
    user: str
    password: str
    account: str
    rest_url: str
    ws_url: str
    host: str
    port: int
    market_id: str
    symbol_prefix: str
    log_level: str


config = Config(
    user=_require("PRIMARY_USER"),
    password=_require("PRIMARY_PASS"),
    account=os.environ.get("PRIMARY_ACCOUNT", ""),
    rest_url=os.environ.get("PRIMARY_REST_URL", "https://api.veta.xoms.com.ar/"),
    ws_url=os.environ.get("PRIMARY_WS_URL", "wss://api.veta.xoms.com.ar/"),
    host=os.environ.get("HOST", "0.0.0.0"),
    port=int(os.environ.get("PORT", "8080")),
    market_id=os.environ.get("MARKET_ID", "ROFX"),
    symbol_prefix=os.environ.get("SYMBOL_PREFIX", "DLR/"),
    log_level=os.environ.get("LOG_LEVEL", "info"),
)
