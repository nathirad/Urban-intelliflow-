# URBAN INTELLIFLOW — SUPER PROMPT (v2.0)
# BDI Young Innovator Hackathon 2026 | Smart City Track
# Language: English | Synthesized from: advisor meeting transcripts, proposal PDF, architecture diagrams, tech-stack notes
# ─────────────────────────────────────────────────────────────────────────────

## PROJECT IDENTITY

**Name:** Urban IntelliFlow
**Tagline:** Transform existing traffic lights into smart signals with IoT + Edge AI — low cost, actually deployable.

**Logo color palette (use everywhere — web, slides, diagrams):**
  - Primary deep forest green : #1B4D3E
  - Accent gold               : #C9A84C
  - Text silver               : #A8A9AD
  - Warm off-white background  : #F5F0E8

**Map scope:** Khon Kaen city, Thailand — built from REAL Khon Kaen intersections and traffic signals (NOT a generic placeholder map).


## ═══════════════════════════════════════════════════
##  1. CONTEXT BRIEF (Why this project exists)
## ═══════════════════════════════════════════════════

Khon Kaen ranks #4 most congested city in Thailand at 44.8% density — and is the ONLY city in the Thai top-5 where congestion is getting WORSE (+0.8 pp YoY). Commuters lose ~81 hours/year in peak-hour traffic; in 15 minutes a car moves only 6.5 km. Root cause: rapid economic growth (Isan GPP +93% in 15 years; Khon Kaen is a Big-5 province) without matching public-transport capacity.

Previous solutions stalled:
- LRT light rail: ~26,900M THB for a single line; decade-long build.
- Full adaptive traffic systems: 2.5–3M THB per intersection → city-wide rollout financially impossible.

Core insight (from advisor meetings + field study):
> Don't replace the old traffic infrastructure. Keep the existing signal cabinet and add a small IoT box, a CCTV camera, and a tiny Edge-AI chip beside each junction. AI adjusts green/red timing in real time from actual vehicle counts instead of a fixed schedule.

Cost: from 2.5–3M THB → ~150,000 THB per junction (~95% reduction) by reusing existing poles, cabinets, and wiring.

Dual-mode operation:
- **Automatic mode** — Smart PLC + Edge AI controls high-priority junctions autonomously.
- **Manual mode** — A traffic officer at a budget junction receives a timing recommendation in the app and presses the signal manually. No hardware upgrade required.

This hybrid is the key to real city-wide coverage instead of isolated smart patches.


## ═══════════════════════════════════════════════════
##  2. TECHNICAL STACK
## ═══════════════════════════════════════════════════

### 2A. Edge AI — Detection & Tracking

**PRIMARY DETECTION MODEL — use YOLO26:**
  - **YOLO26n** (nano) — default for budget junction nodes; runs on Jetson Nano / CPU-class edge devices.
  - **YOLO26m** (medium) — for high-traffic priority junctions where Jetson Orin is available; higher accuracy.

  Why YOLO26 (released Sept 2025, Ultralytics): it is the newest YOLO family member, purpose-built for edge and low-power devices — native end-to-end NMS-free inference (simpler deployment, lower latency), DFL removed for easier export to edge hardware, ProgLoss + STAL for better small-object accuracy (motorcycles!), and up to ~43% faster CPU inference. It follows the same interface as YOLOv8/YOLO11, so the team can swap weights with minimal code change.
  - Weights: `yolo26n.pt`, `yolo26m.pt` via the `ultralytics` Python package.
  - Note: Khon Kaen traffic is motorcycle-heavy — YOLO26's small-object improvements (STAL) directly help motorcycle counting accuracy.

**TRACKING:**
  ByteTrack — multi-object tracking, continuous vehicle ID across frames (compatible with YOLO26 tracking mode).

**DEDUPLICATION:**
  Re-ID Merge — removes double-counting of the same vehicle across overlapping cameras within one node (unique vehicle counting).

**EDGE HARDWARE (confirmed):**
  - NVIDIA Jetson Nano — budget inference node (runs YOLO26n).
  - NVIDIA Jetson Orin (recommended upgrade) — handles YOLO26m comfortably at high-traffic priority intersections.

**ADDITIONAL HARDWARE RECOMMENDATIONS (advisory — not web-page content):**
  - Raspberry Pi 5 (8GB) + Hailo-8L AI module — ultra-budget node; Hailo adds ~13 TOPS at low power; viable for solar-powered remote junctions.
  - Hikvision DS-2CD2T47G2-L (4MP ColorVu) — smart CCTV with RTSP + color night vision; mounts in existing cabinets.
  - LoRa WAN gateway (RAK7258) — telemetry uplink for junctions without fiber/4G.
  - Modbus RTU relay box (Waveshare, ~3,000 THB) — bridges Edge-AI output to legacy traffic-light PLC.
  - Industrial 4G LTE router (Teltonika RUT956) — Kafka stream uplink where fiber is unavailable.
  - LiFePO4 UPS (48V 20Ah) — power-fluctuation backup; keeps signal node alive.

**COMPLEMENTARY AI MODEL — Gemini 1.5 Flash (Vision-Language / VLLM):**
  Deployed cloud-side, NOT at edge. Roles:
    a) Incident analysis — when ByteTrack flags an anomaly (stopped vehicle, wrong-way entry), send a frame to Gemini Flash → natural-language incident description for the officer dashboard.
    b) Complaint-image classification — citizens submit road photos; Gemini Flash labels "pothole / signal malfunction / illegal parking / flooding" and routes to the right department.
    c) Daily pattern insight — batch job sends a heatmap screenshot with prompt: "Describe bottleneck patterns and suggest tomorrow's timing optimization."
    d) Dashboard explainability — narrates congestion spikes in plain language for non-technical city managers.
  Keeps edge inference lean (YOLO26 + ByteTrack) while Gemini handles higher-level reasoning + citizen-facing language.


### 2B. Transport / Messaging
  - RTSP — pull video from CCTV (one RTSP endpoint per camera)
  - MQTT (Mosquitto) — lightweight pub/sub for IoT telemetry, junction node → city cloud
  - Modbus RTU — serial protocol to legacy traffic-light PLC relay
  - Apache Kafka — distributed event queue; ingests MQTT, timestamp ordering, durability, fan-out to Spark; handles all city nodes at once
  - Divide-and-conquer: each zone = one Kafka partition; nodes pre-aggregate → only metadata sent (count, queue_length, congestion_score, timestamp, camera_id), not raw video → low bandwidth.

### 2C. Stream & Batch Processing
  - Apache Spark Streaming — 30s micro-batch; computes vehicle_count, avg_speed, queue_length, congestion_score per node
  - Hadoop / Spark Batch — daily job; historical analysis → Time-of-Day Plan per intersection
  - Cross-check Engine — fuses supply-side (camera counts) with demand-side (citizen GPS, complaints)

### 2D. Storage
  | Layer | Tech | Content |
  |---|---|---|
  | Data Lake (raw) | MongoDB (NoSQL) | camera events, video metadata, MQTT telemetry, re-ID records |
  | Object Storage | MinIO (S3-compatible, self-hosted) | raw video, 3D point cloud, logs |
  | Spatial DB | PostgreSQL + PostGIS | city GIS map, road network, intersection geometry, user data |
  | Warehouse | PostgreSQL (Lakehouse) | historical KPIs, OD matrix, ML feature store |
  MongoDB chosen for high-volume unstructured IoT scale; PostgreSQL/PostGIS for fixed-schema GIS + user data.

### 2E. Services & Applications
  - Node.js API Gateway (REST / GraphQL)
  - React PWA — single codebase, role-based:
      • Citizen view: city map, route navigation, congestion, ETA
      • Officer view: junction heatmap, recommended timing, manual override
  - Open-source City Map (OpenLayers + OpenStreetMap Khon Kaen extract) — NOT Google Maps (cost); city-scoped tiles are cheap
  - Power BI Dashboard — city-management KPIs
  - Smart PLC Controller (Auto mode) — applies timing to signal hardware

### 2F. Control & Actuation
  - Automatic: Central brain → Smart PLC → signal control (priority intersections)
  - Manual: Central brain → Officer app → officer sets timing (legacy junctions) — the budget-coverage innovation
  - Officer notification: push alert when congestion_score > threshold

### 2G. Infrastructure & Governance
  - Self-hosted, open-source first (avoid Azure/AWS cloud cost)
  - Docker + Kubernetes on city private cloud / on-premise
  - Monitoring: Prometheus + Grafana + Loki
  - PDPA: user location data requires consent; anonymized before storage
  - ISO 27001: encryption at rest + in transit, RBAC, audit logging


## ═══════════════════════════════════════════════════
##  3. MULTI-AGENT ORCHESTRATION ARCHITECTURE
## ═══════════════════════════════════════════════════

An AI Agent Orchestration Layer sits between the data pipeline and the decision/actuation layer. A central **Orchestrator Agent** coordinates specialized sub-agents (Multi-Agent system).

### Orchestrator Agent (Central Brain)
  - Role: receive aggregated state from all zone nodes → coordinate sub-agents → emit final signal-timing plans + alerts
  - Input: Kafka events (congestion_score, queue_length, timestamp per node)
  - Output: timing plans → Control Layer; insights → Dashboard
  - Tech: LangGraph or custom async Python orchestrator (asyncio); runs on city cloud

### Sub-Agents

**Agent 1 — Signal Timing Optimizer**
  - Computes optimal green/red duration per junction from current queue + Time-of-Day Plan
  - Rule-based priority queue + ML regression (trained on Spark batch output)
  - Out: timing_plan {junction_id, green_seconds, red_seconds, valid_until}

**Agent 2 — Anomaly & Incident Detector**
  - Monitors congestion trends; flags spikes/accidents/road works
  - z-score on rolling 5-min window; triggers Gemini Flash VLLM when z > 3σ for visual verification
  - Out: incident_alert {type, location, severity, gemini_description, recommended_action}

**Agent 3 — Route Guidance Agent**
  - Answers citizen route queries on the real-time congestion map
  - A* / Dijkstra on PostGIS road graph weighted by congestion_score
  - Out: route_suggestion {origin, destination, waypoints, estimated_minutes, congestion_level}

**Agent 4 — Business Value & Cost Agent  ← KEY AGENT (drives the web dashboard)**
  - Continuously computes economic + social impact for the dashboard web page
  - Inputs: travel-time before/after, fuel burn from queue time, PM2.5 delta from idle reduction, hardware + maintenance cost per junction, rollout progress
  - Outputs (for web display):
      • Time saved per commuter/day (min)
      • City-level annual hours saved
      • Fuel cost saved (THB/yr)
      • CO2 / PM2.5 reduction (tons/yr)
      • Cost per junction (THB) vs. 2.5M THB baseline
      • ROI timeline (break-even month)
      • Carbon-credit potential (Thai TCMA methodology)
  - Tech: Python FastAPI service; feeds real-time metrics to the React dashboard

**Agent 5 — Citizen Feedback Classifier**
  - Receives complaints/photos → classifies → routes to department
  - Gemini Flash VLLM (image + text classification)
  - Out: classified_complaint {category, priority, assigned_department, auto_response}

### Communication Pattern
```
[Kafka Stream]
  → [Orchestrator Agent]
       ├── Signal Timing Optimizer  → Control Layer (PLC / Officer App)
       ├── Anomaly Detector (+Gemini)→ Incident Alert (Push + Dashboard)
       ├── Route Guidance Agent      → Citizen React PWA
       ├── Business Value Agent      → City Dashboard Web Page
       └── Feedback Classifier(+Gemini)→ City CRM / Department Routing
```
Async concurrent execution (Celery+Redis or asyncio). Agents are stateless; state lives in MongoDB / PostgreSQL.


## ═══════════════════════════════════════════════════
##  4. WEB DASHBOARD — DESIGN SPEC
## ═══════════════════════════════════════════════════

### Theme
  - Colors: logo palette — deep green (#1B4D3E) panels, gold (#C9A84C) accents, silver (#A8A9AD) text, off-white (#F5F0E8) cards
  - Typography: avoid Inter/Roboto. Use "Sarabun" (Thai body) + "DM Serif Display" or "Cormorant Garamond" (English headlines)
  - Style: premium urban-tech — refined dark panels, gold data callouts, warm financial-terminal feel
  - Motion: counter animations on load, pulsing congestion dots, animated line charts

### Sections
  1. **Hero / Live Map** — real Khon Kaen map (OpenLayers + OSM); intersection markers color-coded green/yellow/red; animated pulse on congestion; zone clusters A/B/C. Top KPI strip: active junctions, avg congestion, Auto vs Manual count, uptime.
  2. **Business Value Dashboard** (Agent 4) — make this the most impactful for judges:
      • Cost comparison card: 2,500,000 → 150,000 THB with animated 94% savings badge
      • Time-savings rolling counter ("X hours saved today")
      • Fuel + emission gauges
      • ROI timeline line chart (cumulative cost vs benefit, break-even point)
      • Rollout progress ring per zone
  3. **Traffic Analytics** — time-of-day heatmap, top-5 congested junctions, peak-hour chart
  4. **Incident Feed** — real-time cards (Agent 2): location, severity, Gemini description, status
  5. **Citizen Engagement** — complaint classification donut, active users, response-time KPI

### Map Implementation
  - OpenLayers + OpenStreetMap tiles bounded to Mueang Khon Kaen district
  - Center approx: lat 16.4419°N, lon 102.8360°E
  - Mark real major intersections: Mittraphap Rd., Sri Chant Rd., Pracha Samosorn Rd., Kaen Nakhon Lake area, near Khon Kaen University, Robinson junction, etc.
  - Marker colors from logo palette: gold = active Smart PLC, green = manual-monitored, gray = planned
  - DO NOT use Google Maps API (cost).


## ═══════════════════════════════════════════════════
##  5. FULL DATA FLOW
## ═══════════════════════════════════════════════════
```
CCTV (RTSP)
  → Jetson Nano/Orin (YOLO26n/YOLO26m + ByteTrack + Re-ID Merge)
  → MQTT → Kafka (timestamped, partitioned by zone)
  → Spark Streaming (30s: count, queue, speed, congestion_score)
  → MongoDB (real-time) + PostgreSQL/PostGIS (GIS + users)
  → Orchestrator Agent
       ├── Signal Timing → Smart PLC / Officer App
       ├── Anomaly (+Gemini Flash) → Incident Dashboard
       ├── Route → Citizen React PWA
       ├── Business Value → City Dashboard Web Page
       └── Feedback (+Gemini Flash) → City CRM
  → Spark Batch (daily) → Time-of-Day Plan → Hadoop archive
  → Power BI / React Dashboard (city management)
```


## ═══════════════════════════════════════════════════
##  6. INNOVATION HIGHLIGHTS (pitch)
## ═══════════════════════════════════════════════════
  1. 95% cost cut: 2.5M → 150,000 THB/junction by reusing existing infrastructure
  2. Hybrid Auto+Manual mode → city-wide rollout actually affordable
  3. Divide-and-conquer Edge AI → low bandwidth, works with intermittent connectivity
  4. Multi-Agent Orchestration → specialized agents, not a monolith
  5. Business Value Agent → quantified ROI live on the dashboard; judges see impact instantly
  6. YOLO26 edge-first + Gemini VLLM cloud → lean edge, smart cloud reasoning
  7. PDPA + ISO 27001 built-in from day one
  8. Open-source, self-hosted → no vendor lock-in; city owns its data


## ═══════════════════════════════════════════════════
##  7. SELF-EVALUATION (rubric)
## ═══════════════════════════════════════════════════
  | Criterion | Max | Score | Justification |
  |---|---|---|---|
  | Feasibility (prototype in 1 day) | 30 | 29 | YOLO26n counting from sample video; timing logic; mock agents; React dashboard |
  | Problem + dataset fit | 25 | 24 | CCTV + 3D scan + complaints + citizen GPS; aligns with BDI datasets |
  | Social impact + scalability | 20 | 19 | citywide path; quantified time/fuel/emission savings; portable to other cities |
  | Creativity | 15 | 14 | multi-agent + VLLM atop proven IoT stack; reuse-first philosophy |
  | Team readiness | 10 | 10 | AI/Data + IoT/Edge + DB + Automation; IoT & DB advisors |
  | **Total** | **100** | **96** | |


## ═══════════════════════════════════════════════════
##  8. PROTOTYPE SCOPE (1-day build)
## ═══════════════════════════════════════════════════
  **Must have:** YOLO26n vehicle counting on sample Khon Kaen traffic video; rule-based timing logic; React dashboard (real Khon Kaen map + live mock metrics + Business Value section); agent architecture diagram.
  **Should have:** mock Kafka+MQTT pipeline; Business Value Agent (Python computing savings from sample data); Gemini Flash demo (traffic image → incident description).
  **Nice to have:** ByteTrack visualization; simulated Modbus PLC toggle; citizen PWA route demo.


## ═══════════════════════════════════════════════════
##  9. CODE-GENERATION INSTRUCTIONS
## ═══════════════════════════════════════════════════
  1. React dashboard: Tailwind CSS; recharts for charts; OpenLayers for map; logo palette via CSS variables; no Inter/Roboto.
  2. Map: real Khon Kaen bounds (lat 16.4419, lon 102.8360); OSM tiles; color-coded real intersection markers.
  3. Business Value Agent: Python FastAPI `/api/business-value` → JSON {time_saved_hours_today, fuel_saved_liters, pm25_reduction_ug, cost_per_junction_thb, traditional_cost_thb, roi_month, junctions_deployed, junctions_planned}.
  4. Orchestrator: Python asyncio main loop; each sub-agent = async function; in-memory queue (Kafka topics in production).
  5. YOLO inference: `from ultralytics import YOLO; model = YOLO('yolo26n.pt')` (or 'yolo26m.pt'); run on sample video; output frame_id, vehicle_count, boxes. Enable tracking mode with ByteTrack.
  6. Gemini VLLM: Google Generative AI Python SDK; model="gemini-1.5-flash"; send base64 image + prompt: "Describe the traffic situation in this intersection image. Identify incidents, vehicle density, and suggest signal-timing adjustment." Parse as natural language.
  7. Logo: "Urban IntelliFlow" icon — deep green (#1B4D3E) rounded square, gold city skyline + traffic-light motif. Use consistently.
  8. Language: Thai UI labels where natural ("แผนที่จราจรขอนแก่น", "สถานะสัญญาณไฟ"); English for technical labels + API schemas.

─────────────────────────────────────────────────────────────────────────────
END OF SUPER PROMPT v2.0
Urban IntelliFlow | BDI Hackathon 2026 | Khon Kaen Smart City
"Smarter Traffic, Better Khon Kaen" | จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน
─────────────────────────────────────────────────────────────────────────────
