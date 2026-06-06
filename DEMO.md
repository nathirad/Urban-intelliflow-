# 🎬 Urban IntelliFlow — Demo Guide / คู่มือสาธิต

> BDI Young Innovator Hackathon 2026 · Smart City Track
> **"Smarter Traffic, Better Khon Kaen — จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน"**

This guide gets you from a fresh clone to a **fully live dashboard demo in ~2 minutes**,
and gives you a tab-by-tab script + talking points for the pitch.

---

## 0. TL;DR — fastest path

```bash
git clone https://github.com/nathirad/Urban-intelliflow-.git
cd Urban-intelliflow-
./start-demo.sh          # starts backend (8000) + frontend (5173)
```

Open **http://localhost:5173** → the dashboard is already **LIVE** (green pulse, top-right).
No cameras, no Kafka, no database needed — `main.py` runs the Orchestrator Agent's
traffic simulation as a background task, so every number on screen is produced by the
real agents. Stop everything with `Ctrl-C`.

---

## 1. What the judges are looking at

A single FastAPI process (`backend/main.py`) boots the **Orchestrator Agent**, which
every ~1.5 s generates a realistic per-junction traffic window (rush-hour curve ×
per-junction baseline + noise + occasional spikes) and fans it out to 5 specialised
sub-agents. Their decisions land in a shared live-state store that the dashboard polls.

```
Sim traffic ──▶ Orchestrator Agent ─┬─ Agent 1 Signal Timing  → /api/junctions  (green/red)
 (stand-in for                      ├─ Agent 2 Anomaly+Gemini → /api/incidents
  Kafka/Spark)                      ├─ Agent 3 Route Guidance → /api/route
                                    ├─ Agent 4 Business Value → /api/business-value
                                    └─ Agent 5 Feedback Class. → /api/citizen/stats
```

In production the only thing that changes is the **front of the pipe**: cameras
(RTSP) → Jetson (YOLO26 + ByteTrack) → MQTT → Kafka → Spark replaces the simulator.
The agents and the dashboard are unchanged. That's the demo's core message.

---

## 2. Demo script — tab by tab (≈4 minutes)

### 🟢 Tab 1 — ภาพรวมเมือง (Overview)  *(the hook)*
**Show:** the real Khon Kaen map with 5 live intersection markers + the Business Value card.

**Say:**
> "นี่คือ 5 แยกหลักในเมืองขอนแก่นจริง ๆ — มิตรภาพ, ศรีจันทร์, หน้า มข., บึงแก่นนคร.
> จุดสีเขียว/เหลือง/แดง คือความหนาแน่นเรียลไทม์. วงแหวนสีทอง = ควบคุมด้วย Smart PLC,
> วงแหวนเขียว = เจ้าหน้าที่กดเอง."

- **Point at the Business Value card** — this is the number that wins:
  **2,500,000 ฿ → 150,000 ฿ per junction = ประหยัด 94%.**
- Counters animate; the **ROI break-even chart** shows payback in ~2–5 months.
- Rollout ring: **5 / 120** major junctions.

> "เราไม่ทุบของเดิม เราเสียบกล่อง IoT + AI ข้างตู้ไฟเดิม ต้นทุนเลยถูกลง 94%
> ทำให้ขยายได้ทั้งเมืองจริง ไม่ใช่แค่ 2–3 แยกโชว์."

### 📊 Tab 2 — วิเคราะห์ & เหตุการณ์ (Analytics & Incidents)
**Show:** time-of-day congestion curve (double rush-hour hump), Top-5 congested
junctions (live), and the **real-time incident feed**.

**Say:**
> "Spark สรุปความหนาแน่นรายชั่วโมง เห็น 2 พีค เช้า–เย็นชัดเจน.
> ฝั่งขวาเป็นเหตุการณ์ที่ Agent 2 จับได้ด้วย z-score แล้วส่งภาพให้ **Gemini**
> บรรยายเป็นภาษาคน — เช่น 'รถเสียจอดเลนซ้าย ถ.มิตรภาพ' พร้อมคำแนะนำให้เจ้าหน้าที่."

### 🚦 Tab 3 — ศูนย์ควบคุม (Operations) *(the interactive moment)*
**Show:** per-junction live green/red timing + congestion bars + the **mode toggle**.

**Do:** click a **Manual / เจ้าหน้าที่** button to flip it to **Auto / PLC** (or back).
Watch the multi-agent activity log on the right update within ~2 s.

**Say:**
> "นี่คือหัวใจของความเป็นไปได้: แยกสำคัญใช้ **Auto** สั่ง Smart PLC อัตโนมัติ,
> ส่วนแยกงบจำกัดใช้ **Manual** — แอปบอกเจ้าหน้าที่ว่าควรเปิดไฟเขียวกี่วินาที
> แล้วกดเอง. ไม่ต้องอัปเกรดฮาร์ดแวร์ → ครอบคลุมทั้งเมืองได้ในงบเท่าเดิม."

### 👥 Tab 4 — ประชาชน (Citizen)
**Show:** route guidance + complaint classification donut.

**Do:** pick **จาก / ไป** and press **ค้นหาเส้นทาง** → ETA + path weighted by live
congestion (Agent 3, Dijkstra). Type *"สัญญาณไฟเสีย"* in the complaint box, press **ส่ง** →
Agent 5 classifies it and routes it to the right department; the donut updates.

**Say:**
> "ประชาชนได้เส้นทางที่ถ่วงน้ำหนักด้วยรถติดจริง, และแจ้งปัญหาได้ —
> Gemini จัดประเภทอัตโนมัติ (ไฟเสีย/ถนนชำรุด/น้ำท่วม) แล้วส่งเข้าหน่วยงานที่ถูกต้อง."

---

## 3. One-liner pitch

> **Urban IntelliFlow turns Khon Kaen's *existing* traffic lights into adaptive smart
> signals for ~150,000 ฿ a junction instead of 2.5–3M ฿ — a 94% cut — by adding a CCTV +
> Jetson Edge-AI box (YOLO26) beside each cabinet, coordinated by a multi-agent cloud
> brain, with a hybrid Auto-PLC / Manual-officer mode that makes city-wide rollout
> actually affordable.**

---

## 4. Anticipated judge Q&A

| Question | Answer |
|---|---|
| *Is the AI real or mocked?* | Detection is **YOLO26 + ByteTrack** (`edge/detector.py`, runs on a sample video). For the dashboard demo we simulate the *metrics stream* (what Spark would emit) so it runs offline; the agents acting on it are the real code. |
| *Why 150k not 2.5M?* | We reuse the existing pole, cabinet, wiring and signal head. We only add a camera, a Jetson, and a Modbus relay — not a whole new controller + civil works. |
| *Motorcycles?* | Khon Kaen is motorcycle-heavy; YOLO26's STAL small-object improvements target exactly this. `by_class` tracks motorcycles separately. |
| *Why Gemini in the cloud, not at the edge?* | Edge stays lean (detection only, low power, low bandwidth — metadata only). Language reasoning (incident narration, complaint classification) is cheap to do cloud-side. |
| *Privacy / PDPA?* | Raw video never leaves the junction — only counts/metadata over MQTT. Citizen location/identity needs consent and is anonymised before storage. ISO 27001: encryption, RBAC, audit. |
| *Vendor lock-in?* | Fully open-source, self-hosted. OpenLayers + OSM (not Google Maps), MongoDB/PostgreSQL, Kafka/Spark. The city owns its data. |
| *Does Manual mode actually scale?* | That's the point — most junctions need **zero hardware upgrade**. An officer follows the in-app recommendation. Smart PLC is reserved for high-priority junctions. |

---

## 5. Running the pieces individually

```bash
# Backend only (live API + simulation)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
#   http://localhost:8000/docs            ← interactive API (Swagger)
#   http://localhost:8000/api/business-value

# Orchestrator in the terminal (watch agent decisions scroll by)
python orchestrator.py --mock

# Frontend only
cd frontend && npm install && npm run dev    # http://localhost:5173

# Edge detector on a sample traffic video (needs ultralytics + a .mp4)
cd edge && pip install -r requirements.txt
python detector.py --source sample_traffic.mp4 --model yolo26n.pt --show
```

### Useful API calls for a live terminal demo
```bash
curl -s localhost:8000/api/summary            | jq
curl -s localhost:8000/api/junctions          | jq '.[].id'
curl -s localhost:8000/api/incidents          | jq '.[0]'
curl -s localhost:8000/api/business-value     | jq
curl -s -X POST localhost:8000/api/junctions/SRIC-01/mode -H 'Content-Type: application/json' -d '{"mode":"auto"}'
curl -s -X POST localhost:8000/api/route       -H 'Content-Type: application/json' -d '{"origin":"MITR-01","destination":"PRAC-01"}' | jq
```

---

## 6. Demo configuration knobs (env vars)

| Var | Default | Effect |
|---|---|---|
| `INTELLIFLOW_SIM` | `1` | `0` disables the background simulation (use when wiring real Kafka). |
| `INTELLIFLOW_SIM_INTERVAL` | `1.5` | Seconds between simulated traffic windows. Lower = livelier demo. |
| `GEMINI_API_KEY` | *(unset)* | Set to enable real Gemini incident narration / complaint classification. Without it, the code uses well-labelled templated fallbacks (see `agents/anomaly_detector.py`, `agents/feedback_classifier.py`). |

---

## 7. Troubleshooting

- **Dashboard shows `OFFLINE` (grey pill):** the backend isn't reachable. Start it on
  port 8000; the Vite dev server proxies `/api` → `:8000`. The UI still renders with
  safe fallback numbers so a demo never crashes.
- **Map is blank for a second on first load:** OpenLayers refreshes its canvas size
  after layout settles (handled in `LiveMap.jsx`); give it a moment or resize the window.
- **`yolo26n.pt` download:** Ultralytics fetches weights on first run; needs network
  once. Not required for the dashboard demo.
- **Ports busy:** change `--port` for uvicorn and the `proxy` target in
  `frontend/vite.config.js` to match.

---

Built with reuse-first engineering for Khon Kaen Municipality.
จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน 🚦
