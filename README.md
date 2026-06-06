# 🚦 Urban IntelliFlow

> Smarter Traffic, Better Khon Kaen — จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน
> BDI Young Innovator Hackathon 2026 · Smart City Track

Transform Khon Kaen's existing traffic lights into adaptive smart signals with
**IoT + Edge AI** — at ~95% lower cost than full adaptive systems
(2.5–3M THB → ~150,000 THB per junction).

## How it works

CCTV cameras already on the poles stream video to a small Edge-AI box (Jetson) at
each junction. **YOLO26** counts vehicles and **ByteTrack** tracks them in real time.
Only lightweight metadata (counts, queue length, congestion score) is published over
MQTT → Kafka → Spark, then a **Multi-Agent Orchestrator** decides optimal signal
timing. High-traffic junctions run in **Automatic** mode (Smart PLC); budget junctions
run in **Manual** mode (a traffic officer follows in-app timing recommendations).

## Project structure

| Folder | What | Runs on |
|---|---|---|
| `edge/` | YOLO26 detection + MQTT publisher | Jetson Nano/Orin at each junction |
| `backend/` | FastAPI gateway + Orchestrator + 5 agents | City cloud / on-prem |
| `frontend/` | React PWA dashboard (citizen + officer) | Browser / mobile |
| `docs/` | Full spec, architecture, agent design | — |

Read `CLAUDE.md` first if you're using Claude Code, and **[`DEMO.md`](DEMO.md)** for the
full demo script + pitch talking points.

## Quickstart — one command (live demo)

```bash
./start-demo.sh        # backend :8000 + frontend :5173, then Ctrl-C to stop
```

Open **http://localhost:5173**. The dashboard is **live immediately** — `backend/main.py`
runs the Orchestrator Agent's traffic simulation as a background task, so every number
is produced by the real agents. No cameras, Kafka, or database required.

The dashboard has four tabs: **Overview** (real Khon Kaen map + Business Value),
**Analytics & Incidents** (charts + Gemini-narrated incident feed), **Operations**
(per-junction timing + Auto/Manual PLC toggle), and **Citizen** (route guidance +
complaint classification).

## Quickstart — run pieces individually

```bash
# Backend (API + agents + sim)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # http://localhost:8000/docs
python orchestrator.py --mock             # (optional) watch agent decisions in the terminal

# Frontend (React PWA dashboard)
cd frontend && npm install && npm run dev # http://localhost:5173

# Edge (vehicle counting on a sample video)
cd edge && pip install -r requirements.txt
python detector.py --source sample_traffic.mp4 --model yolo26n.pt --show
```

## API (backend)

`GET /api/summary` · `GET /api/junctions` · `GET /api/junctions/{id}` ·
`POST /api/junctions/{id}/mode` · `GET /api/incidents` · `GET /api/heatmap` ·
`GET /api/analytics/top` · `GET /api/agents` · `GET /api/business-value` ·
`POST /api/route` · `POST /api/complaint` · `GET /api/citizen/stats`.
Interactive docs at `/docs`. Tests: `cd backend && pytest -q`.

## Tech stack

YOLO26 · ByteTrack · Re-ID Merge · NVIDIA Jetson · Gemini 1.5 Flash (VLLM) ·
MQTT · Kafka · Spark · MongoDB · PostgreSQL/PostGIS · FastAPI · React PWA ·
OpenLayers · Power BI · Docker/K8s · PDPA + ISO 27001

## Theme

Deep green `#1B4D3E` · Gold `#C9A84C` · Silver `#A8A9AD` · Off-white `#F5F0E8`
Fonts: Sarabun + DM Serif Display

## License

Open-source, self-hosted. Built for Khon Kaen Municipality.
