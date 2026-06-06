# Multi-Agent Orchestration — Urban IntelliFlow

An AI Agent Orchestration Layer sits between the data pipeline and the
decision/actuation layer. A central **Orchestrator Agent** coordinates five
specialized sub-agents. Agents are stateless; all state persists in MongoDB / PostgreSQL.

## Orchestrator Agent (`backend/orchestrator.py`)
- **Input**: Kafka events (`congestion_score`, `queue_length`, `timestamp` per node)
- **Job**: fan out each event to the sub-agents concurrently, collect outputs, route them
- **Output**: timing plans → Control Layer; insights/alerts → Dashboards
- **Tech**: Python asyncio loop (LangGraph optional in production). `--mock` flag feeds
  simulated events so the system runs without live cameras.

## Sub-agents (`backend/agents/`)

### 1. Signal Timing Optimizer (`signal_timing.py`)
- Computes optimal green/red duration per junction from current queue + Time-of-Day Plan
- Rule-based priority queue + ML regression (trained on Spark batch output)
- **Out**: `timing_plan {junction_id, green_seconds, red_seconds, valid_until}`

### 2. Anomaly & Incident Detector (`anomaly_detector.py`)
- Rolling 5-min z-score on congestion trends; flags spikes/accidents/road works
- When z > 3σ → calls **Gemini 1.5 Flash** with a frame for visual verification
- **Out**: `incident_alert {type, location, severity, gemini_description, recommended_action}`

### 3. Route Guidance Agent (`route_guidance.py`)
- Answers citizen route queries on the real-time congestion map
- A* / Dijkstra on the PostGIS road graph, weighted by `congestion_score`
- **Out**: `route_suggestion {origin, destination, waypoints, estimated_minutes, congestion_level}`

### 4. Business Value & Cost Agent (`business_value.py`)  ← drives the web dashboard
- Continuously computes economic + social impact for the dashboard
- **Inputs**: travel-time before/after, fuel burn from queue time, PM2.5 delta from idle
  reduction, hardware + maintenance cost per junction, rollout progress
- **Out** (`GET /api/business-value`):
  ```json
  { "time_saved_hours_today": 0, "fuel_saved_liters": 0, "pm25_reduction_ug": 0,
    "cost_per_junction_thb": 150000, "traditional_cost_thb": 2500000,
    "roi_month": 0, "junctions_deployed": 0, "junctions_planned": 0 }
  ```

### 5. Citizen Feedback Classifier (`feedback_classifier.py`)
- Receives complaints/photos → classifies (pothole / signal malfunction / illegal parking
  / flooding) → routes to the right department
- **Gemini 1.5 Flash** (image + text classification)
- **Out**: `classified_complaint {category, priority, assigned_department, auto_response}`

## Communication pattern

```
[Kafka Stream]
  → [Orchestrator Agent]  (asyncio: all agents run concurrently)
       ├── Signal Timing Optimizer   → Control Layer (PLC / Officer App)
       ├── Anomaly Detector (+Gemini) → Incident Alert (Push + Dashboard)
       ├── Route Guidance Agent       → Citizen PWA API
       ├── Business Value Agent       → City Dashboard Web Page
       └── Feedback Classifier(+Gemini)→ City CRM / Department Routing
```

## Adding a new agent
1. Create `backend/agents/<name>.py` exposing `async def run(event) -> dict`.
2. Import and register it in `orchestrator.py`'s agent list.
3. Document it here.
4. If it serves the frontend, add an endpoint in `main.py`.
