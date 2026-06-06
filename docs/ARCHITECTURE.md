# Architecture — Urban IntelliFlow

## Layered system (top-to-bottom data flow)

### Layer 1 — Data Sources
- CCTV video stream (RTSP) — existing cameras on poles
- 3D city scan / GIS (point cloud → spatial DB)
- Citizen app + GPS (route/location, opt-in)
- Complaints (call center / app)
- IoT add-ons / sensors / PLC (only where needed)

### Layer 2 — Edge & Node Segmentation (divide-and-conquer by zone)
- Junction nodes grouped into zones A / B / C
- Edge AI compute: **YOLO26n/m** detection + **ByteTrack** tracking + **Re-ID Merge** dedup
- Local queue & density estimation
- Each node pre-aggregates and publishes metadata only (low bandwidth)

### Layer 3 — Ingestion & Streaming
- **MQTT** (Mosquitto): node → cloud telemetry
- **Kafka**: distributed queue, timestamp ordering, durability, fan-out to Spark
- One Kafka partition per zone

### Layer 4 — Storage
- **MongoDB** (NoSQL Data Lake): camera events, metadata, re-ID records
- **MinIO** (S3-compatible): raw video, 3D point cloud, logs
- **PostgreSQL + PostGIS**: GIS map, road network, intersection geometry, user data
- Optional Data Warehouse / Lakehouse: historical KPIs, OD matrix, ML feature store

### Layer 5 — Processing (ELT/ETL)
- **Spark Streaming** (real-time): 30s micro-batch → vehicle_count, avg_speed, queue_length, congestion_score
- **Spark / Hadoop Batch** (daily): historical analysis → Time-of-Day Plan
- **Cross-check Engine**: supply (cameras) × demand (citizen GPS + complaints)

### Layer 6 — Orchestration & Agents  ← see AGENTS.md
- Orchestrator Agent coordinates 5 specialized sub-agents

### Layer 7 — Services & Applications
- Node.js / FastAPI API Gateway (REST/GraphQL)
- React PWA (citizen + officer, role-based)
- City Map (OpenLayers + OSM Khon Kaen)
- Power BI dashboard (management)

### Layer 8 — Control & Actuation
- Smart PLC (auto mode, priority junctions)
- Officer notification panel (manual mode, budget junctions)
- Route guidance / citizen alerts

### Cross-cutting — Governance
- Self-hosted open-source infra (Docker + K8s)
- Monitoring: Prometheus + Grafana + Loki
- PDPA compliance + ISO 27001 (encryption, RBAC, audit log)
- Cost-efficient phased upgrade strategy

## End-to-end data flow

```
CCTV (RTSP)
  → Jetson Nano/Orin (YOLO26n/m + ByteTrack + Re-ID Merge)
  → MQTT → Kafka (timestamped, zone-partitioned)
  → Spark Streaming (30s metrics)
  → MongoDB (real-time) + PostgreSQL/PostGIS (GIS + users)
  → Orchestrator Agent
       ├── Signal Timing      → Smart PLC / Officer App
       ├── Anomaly (+Gemini)  → Incident Dashboard
       ├── Route Guidance     → Citizen PWA
       ├── Business Value     → City Dashboard
       └── Feedback (+Gemini) → City CRM
  → Spark Batch (daily) → Time-of-Day Plan → Hadoop archive
  → Power BI / React Dashboard
```

## Why these choices

- **YOLO26**: edge-first, NMS-free end-to-end inference, DFL removed for easy export,
  ProgLoss + STAL for small-object accuracy (critical for motorcycle-heavy Khon Kaen),
  ~43% faster CPU inference. Same interface as YOLOv8/YOLO11 (easy migration).
- **Divide-and-conquer edge**: cuts bandwidth, tolerates intermittent connectivity.
- **MongoDB for the lake**: scales for high-volume unstructured IoT data; PostgreSQL is
  fixed-schema and reserved for GIS + user data.
- **Open-source + self-host**: no vendor lock-in; city owns its data; ongoing cost is
  mostly electricity + maintenance.
