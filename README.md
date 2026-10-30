# GGAL · Tiempo real — ADR / BYMA / Futuros

Landing en tiempo real para **Grupo Financiero Galicia (GGAL)**:

- **ADR GGAL** (NYSE/NASDAQ, USD) — vía **Alpaca Market Data** (feed IEX, gratis).
- **Acción GGAL** (BYMA, ARS) — plazos **CI** y **24hs**, vía **Primary API / pyRofex**.
- **Futuros GGAL** (Matba Rofex, ARS) — los **dos vencimientos** más cercanos.
- **TNA y TEA implícitas** de cada futuro contra la acción GGAL (24hs).
- **Dólar implícito (CCL)** derivado del ADR vs BYMA.

> **Solo market data / terminal informativa.** No envía órdenes, no es un
> broker, no es DMA.

## Arquitectura

```
┌───────────────┐  pyRofex   ┌──────────────────┐   WS   ┌──────────────┐
│  Primary API  │ ─────────► │                  │ ─────► │              │
│ (BYMA + Rofex)│ market data │  Python+FastAPI  │        │  React (Vite)│
├───────────────┤            │   bridge + cache │ fanout │   Tailwind   │
│  Alpaca Data  │ ─────────► │  + TNA/TEA + CCL │ ─────► │              │
│   (ADR GGAL)  │  websocket  │                  │        │              │
└───────────────┘            └──────────────────┘        └──────────────┘
```

- **server/** — Python + FastAPI. `pyRofex` para BYMA/Rofex y un cliente
  WebSocket propio para Alpaca. Descubre los instrumentos de GGAL, mantiene el
  estado en memoria, calcula TNA/TEA/CCL y reparte un snapshot por WebSocket.
- **client/** — Vite + React + TS + Tailwind. Tarjetas de ADR, acción y futuros
  con la tasa implícita, actualizadas en vivo.

## Requisitos

- **Node 20+**
- **Python 3.11+**
- Credenciales de **Primary API** (tu broker, p.ej. Veta) — obligatorio.
- Cuenta gratuita de **Alpaca** (API key + secret) — opcional, para el ADR.

## Setup

```bash
# 1. Dependencias del cliente + orquestador
npm install

# 2. Dependencias del server Python
npm run install:server

# 3. Credenciales
cp server/.env.example server/.env   # y completá los valores

# 4. Levantar todo (server + cliente) con un comando
npm run dev
```

Salida:
- **Server** (FastAPI) → `http://localhost:8080`
  - REST: `GET /api/health`, `GET /api/snapshot`, `GET /api/instruments`
  - WS:   `ws://localhost:8080/ws`
- **Client** (Vite) → `http://localhost:5173` *(abrir esto en el navegador)*

Vite proxea `/api` y `/ws` al server, así que basta con abrir el cliente.

### Credenciales (`server/.env`)

```ini
# Primary API (BYMA + Rofex) — OBLIGATORIO
PRIMARY_USER=...
PRIMARY_PASS=...
PRIMARY_ACCOUNT=...            # cuenta visible en tu broker
PRIMARY_REST_URL=https://api.veta.xoms.com.ar/
PRIMARY_WS_URL=wss://api.veta.xoms.com.ar/

# Alpaca (ADR GGAL) — OPCIONAL (sin esto, el ADR no se muestra)
ALPACA_KEY=...
ALPACA_SECRET=...
ALPACA_FEED=iex               # free = iex; sip es pago

# Ajustes GGAL
GGAL_SPOT_SETTLEMENT=24hs      # plazo usado como spot para la tasa (24hs | CI)
GGAL_MAX_FUTURES=2             # vencimientos a mostrar (0 = todos)
GGAL_ADR_RATIO=10              # acciones por ADR
```

`server/.env` está gitignoreado: nunca se commitean las credenciales.

## Cálculo de la tasa

Para cada futuro, con `F` = precio del futuro, `S` = spot (GGAL 24hs) y
`n` = días corridos al vencimiento:

```
base = F / S - 1
TNA  = base · (365 / n)            # nominal anual, base 365
TEA  = (F / S) ^ (365 / n) - 1     # efectiva anual
```

El dólar implícito (CCL) se calcula como `precio_BYMA · ratio_ADR / ADR_USD`.

## Horarios

- **BYMA / Rofex**: rueda continua ~11:00–17:00 ART (lun–vie).
- **NYSE/NASDAQ (ADR)**: 09:30–16:00 ET (con DST).

El server mantiene los websockets conectados de forma permanente: con el
mercado cerrado se ve el último estado (último operado, cierre, settlement).
Los badges del header indican si cada mercado está abierto.

## Stack

- Python 3.11+ · FastAPI · uvicorn · pyRofex · websocket-client · requests
- Vite · React 18 · TypeScript · TailwindCSS · Zustand
