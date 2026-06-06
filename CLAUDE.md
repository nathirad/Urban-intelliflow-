# CLAUDE.md — Urban IntelliFlow

> This file is read automatically by Claude Code. It is the single source of truth
> for what this project is, how it is structured, and the conventions to follow.
> Read `docs/SUPER_PROMPT.md` for the full product spec.

## What this is

**Urban IntelliFlow** — an adaptive traffic-signal system for Khon Kaen, Thailand.
Built for the BDI Young Innovator Hackathon 2026 (Smart City track).

Core idea: do NOT replace existing traffic lights. Add a small IoT box + CCTV + a
tiny Edge-AI chip beside each junction. AI counts vehicles in real time and adjusts
green/red timing instead of using a fixed schedule. Cost per junction drops from
~2.5–3M THB (full adaptive systems) to ~150,000 THB (~95% reduction).

Two operating modes:
- **Automatic** — Smart PLC + Edge AI controls priority junctions autonomously.
- **Manual** — a traffic officer gets a timing recommendation in-app and presses
  the signal manually (no hardware upgrade needed → makes city-wide rollout affordable).

## Architecture (high level)

```
CCTV (RTSP) → Jetson (YOLO26 + ByteTrack + Re-ID) → MQTT → Kafka
  → Spark Streaming (30s metrics) → MongoDB + PostgreSQL/PostGIS
  → Orchestrator Agent → [5 sub-agents] → Control Layer + Dashboards
```

Full detail: `docs/ARCHITECTURE.md` and `docs/AGENTS.md`.

## Repository layout

```
urban-intelliflow/
├── CLAUDE.md            ← you are here
├── README.md            ← human-facing quickstart
├── docs/
│   ├── SUPER_PROMPT.md  ← complete product/tech spec (source of truth)
│   ├── ARCHITECTURE.md  ← data flow + layers
│   └── AGENTS.md        ← multi-agent design
├── edge/                ← runs on Jetson Nano/Orin at each junction
│   ├── detector.py      ← YOLO26 + ByteTrack vehicle counting
│   ├── publisher.py     ← MQTT publish of metadata
│   └── requirements.txt
├── backend/             ← city cloud / on-prem server
│   ├── main.py          ← FastAPI app (API gateway)
│   ├── orchestrator.py  ← Orchestrator Agent (asyncio loop)
│   ├── agents/          ← 5 specialized sub-agents
│   └── requirements.txt
└── frontend/            ← React PWA dashboard (citizen + officer)
    ├── src/
    └── package.json
```

## Tech stack (use these exact choices)

| Layer | Technology |
|---|---|
| Detection | **YOLO26n** (budget/Jetson Nano) or **YOLO26m** (Jetson Orin) via `ultralytics` |
| Tracking | ByteTrack (Ultralytics tracking mode) |
| Dedup | Re-ID Merge (unique vehicle counting across overlapping cameras) |
| Vision-Language (cloud) | Gemini 1.5 Flash — incident narration + complaint image classification |
| Messaging | RTSP (camera), MQTT/Mosquitto (telemetry), Modbus RTU (PLC), Kafka (event queue) |
| Stream/Batch | Apache Spark (Streaming 30s + daily Batch), Hadoop archive |
| Storage | MongoDB (Data Lake), MinIO (objects), PostgreSQL + PostGIS (GIS + users) |
| Backend | Node.js / Python FastAPI |
| Frontend | React PWA + Tailwind + OpenLayers (NOT Google Maps) + recharts |
| Dashboard | Power BI (management) + React (operations) |
| Control | Smart PLC (auto) + Officer app (manual) |
| Infra | Docker + Kubernetes, self-hosted, open-source first |
| Governance | PDPA consent, ISO 27001 (encryption, RBAC, audit) |

## Conventions

- **Open-source / self-host first.** Avoid paid cloud (AWS/Azure/GCP) and Google Maps API.
- **Edge stays lean.** Only YOLO26 + ByteTrack + Re-ID run on-device. All language
  reasoning (Gemini) is cloud-side. Edge publishes metadata only, never raw video over MQTT.
- **Map = real Khon Kaen.** Use OpenLayers + OpenStreetMap tiles bounded to Mueang
  Khon Kaen (center ~lat 16.4419, lon 102.8360). Never a placeholder map.
- **Theme = logo palette.** Deep green `#1B4D3E`, gold `#C9A84C`, silver `#A8A9AD`,
  off-white `#F5F0E8`. Fonts: Sarabun (Thai) + DM Serif Display (English headlines).
  Never Inter/Roboto.
- **Language.** Thai UI labels where natural; English for code, API schemas, technical labels.
- **PDPA.** Any citizen location/identity data requires consent and must be anonymized
  before storage.

## Data contracts (keep these stable)

Edge → MQTT payload (per junction, per 30s window):
```json
{ "node_id": "A", "camera_id": "cam-001", "junction_id": "MITR-01",
  "timestamp": "ISO8601", "vehicle_count": 42, "queue_length_m": 85.0,
  "avg_speed_kmh": 12.3, "congestion_score": 0.78, "by_class": {"car":30,"motorcycle":10,"truck":2} }
```

Business Value API (`GET /api/business-value`):
```json
{ "time_saved_hours_today": 0, "fuel_saved_liters": 0, "pm25_reduction_ug": 0,
  "cost_per_junction_thb": 150000, "traditional_cost_thb": 2500000,
  "roi_month": 0, "junctions_deployed": 0, "junctions_planned": 0 }
```

## API surface (implemented)

The FastAPI gateway (`backend/main.py`) starts the Orchestrator simulation as a
background task on startup, so a single `uvicorn main:app` serves a fully live demo.
Disable the sim with `INTELLIFLOW_SIM=0`. Endpoints:

```
POST /api/auth/register           {email,name?,password,role} → {token,user}
POST /api/auth/login              {email,password} → {token,user}
GET  /api/auth/me                 (Bearer token) → current user
POST /api/auth/logout             invalidate token
GET  /api/summary                 KPI strip (active junctions, avg congestion, auto/manual, incidents, uptime)
GET  /api/junctions               live status of every junction (drives map + control)
GET  /api/junctions/{id}          single junction + history
POST /api/junctions/{id}/mode     toggle auto (Smart PLC) / manual (officer) — {"mode":"auto"|"manual"}
GET  /api/incidents               active incidents (Agent 2 + Gemini narration)
GET  /api/heatmap                 24h time-of-day congestion (Spark batch surrogate)
GET  /api/analytics/top?n=5       top-N congested junctions (live)
GET  /api/agents                  recent multi-agent activity log
GET  /api/business-value          Agent 4 economic/social metrics (see contract below)
POST /api/route                   Agent 3 route guidance — {"origin","destination"}
POST /api/complaint               Agent 5 classify — {"text"?,"image_b64"?}
GET  /api/citizen/stats           complaint donut + response KPIs
```

Shared live state lives in `backend/state.py` (in-memory for the demo; MongoDB +
PostgreSQL/PostGIS in production). Smoke tests: `backend/test_api.py` (`pytest -q`).

## Prototype scope (1-day hackathon)

Must have: YOLO26n counting on a sample traffic video; rule-based timing logic;
React dashboard with real Khon Kaen map + live mock metrics + Business Value section.
Should have: mock Kafka/MQTT pipeline; Business Value Agent; Gemini Flash demo.
Nice to have: ByteTrack visualization; simulated Modbus PLC toggle; citizen route demo.

## Running locally

See `README.md`. Each component (`edge/`, `backend/`, `frontend/`) is independently runnable.
Network may be offline during dev — prefer mock data feeds (`backend/orchestrator.py` has a
`--mock` mode) so the dashboard works without live cameras.

## When extending

- New agent → add under `backend/agents/`, register in `orchestrator.py`, document in `docs/AGENTS.md`.
- New data field → update the MQTT payload contract above AND the Spark schema.
- Keep edge inference model swappable: `YOLO('yolo26n.pt')` ↔ `YOLO('yolo26m.pt')` only.
