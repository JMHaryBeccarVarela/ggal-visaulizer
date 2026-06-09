# Derivados — Screener de Futuros de Dólar (Matba Rofex)

Screener en tiempo real para futuros de dólar (DLR) de A3 / Matba Rofex.
Cotizaciones, puntas y libro L2 en vivo desde Primary API vía **pyRofex**.

> **Solo screener / terminal de información.** No envía órdenes, no es un
> broker, no es DMA. La operatoria se hace desde E-Trader / Matriz.

## Arquitectura

```
┌────────────────┐   pyRofex    ┌──────────────────┐    WS    ┌──────────────┐
│  Primary API   │ ───────────► │  Python+FastAPI  │ ───────► │  React (Vite)│
│ (Matba Rofex)  │  market data │   bridge / cache │  fanout  │   Tailwind   │
└────────────────┘              └──────────────────┘          └──────────────┘
```

- **server/** — Python + FastAPI + **pyRofex**. Se conecta a Primary (broker
  Veta), mantiene el libro en memoria y reparte market data por WebSocket a
  todos los clientes. Solo market data básico.
- **client/** — Vite + React + TS + Tailwind. Tabla de contratos, DOM L2 y
  biblioteca de estrategias.

## Requisitos

- **Node 20+** (cliente + orquestador)
- **Python 3.11+** (server)

## Setup

```bash
# 1. Dependencias del cliente + concurrently (orquestador)
npm install

# 2. Dependencias del server Python
npm run install:server      # = python -m pip install -r server/requirements.txt

# 3. Levantar todo (server Python + cliente Vite) con un comando
npm run dev
```

Salida:
- **Server** (FastAPI + pyRofex) → `http://localhost:8080`
  - REST: `GET /api/health`, `GET /api/contracts`, `GET /api/snapshot`, `POST /api/spot`
  - WS:   `ws://localhost:8080/ws`
- **Client** (Vite) → `http://localhost:5173` *(abrir esto en el navegador)*

Vite proxea `/api` y `/ws` al server, así que basta con abrir el cliente.

### Otros scripts (desde la raíz)

```bash
npm run dev:server   # solo el server Python (uvicorn --reload)
npm run dev:client   # solo el cliente Vite
npm run build        # build de producción del cliente
npm run typecheck    # tsc del cliente
```

### Credenciales

`server/.env` trae las credenciales de Primary/Veta (gitignored). La cuenta
(`PRIMARY_ACCOUNT`) es la cuenta visible del usuario en Veta (ej. `50054`).
Ver `server/.env.example`.

## Horario de mercado

Futuros DLR: **10:20 a 17:10 ART** (lun–vie, UTC-3). Fuera de horario el
server no abre el websocket de Primary (`primaryState: idle/disconnected`)
y el cliente muestra los últimos datos cacheados.

## Datos que provee el server (market data básico)

Por cada contrato DLR: bid/ask + size, mid, último, OHLC, cierre previo,
settlement, volumen, open interest, trade count, spread (abs y bps),
variación %, y **libro L2** (hasta 5 niveles por lado). El spot (DLR/SPOT)
se ingesta automático y se puede sobrescribir manual desde el header.

La analítica (tasas implícitas, curva, spreads inter-mes, arbitrajes,
Lecaps) se reconstruye en una etapa posterior sobre esta base.

## Stack

- Python 3.11+ · FastAPI · uvicorn · pyRofex · python-dotenv
- Vite · React 18 · TypeScript · TailwindCSS · Zustand
