"""
state.py — in-process live state store for the demo.

In production the dashboard reads junction status from MongoDB (real-time lake) and
PostgreSQL/PostGIS (GIS + history). For the 1-day prototype we keep a single shared
in-memory store so that ONE process (`uvicorn main:app`) drives a fully live
end-to-end dashboard — no Kafka, no cameras, no databases required.

Both the Orchestrator Agent (orchestrator.py) and the API gateway (main.py) read
and write through this module, so whatever the agents decide is immediately visible
on the dashboard.
"""
from __future__ import annotations

import threading
from collections import defaultdict, deque
from datetime import datetime, timezone

# --- Real Khon Kaen major intersections -------------------------------------
# Coordinates around Mueang Khon Kaen (center ~16.4419, 102.8360). These match the
# frontend marker list. mode: "auto" = Smart PLC, "manual" = officer-operated.
JUNCTIONS_SEED = [
    {"id": "MITR-01", "name": "ถ.มิตรภาพ x ศรีจันทร์",       "lon": 102.8333, "lat": 16.4360, "zone": "A", "mode": "auto"},
    {"id": "MITR-02", "name": "ถ.มิตรภาพ x ประชาสโมสร",     "lon": 102.8295, "lat": 16.4480, "zone": "A", "mode": "auto"},
    {"id": "SRIC-01", "name": "ถ.ศรีจันทร์ x กลางเมือง",     "lon": 102.8360, "lat": 16.4419, "zone": "B", "mode": "manual"},
    {"id": "PRAC-01", "name": "ถ.ประชาสโมสร x หน้า มข.",     "lon": 102.8240, "lat": 16.4730, "zone": "B", "mode": "manual"},
    {"id": "LAKE-01", "name": "บึงแก่นนคร",                   "lon": 102.8470, "lat": 16.4290, "zone": "C", "mode": "manual"},
]

ZONE_OF = {j["id"]: j["zone"] for j in JUNCTIONS_SEED}

# Edge-node connection lifecycle (honest: hardware is rolled out gradually).
# Demo reality: a 2-junction pilot is live, 1 is mid-install, 2 are not deployed yet.
NODE_STAGE = {
    "MITR-01": "online",      # pilot — fully deployed + streaming
    "SRIC-01": "online",      # pilot — fully deployed + streaming
    "MITR-02": "connecting",  # hardware on site, finishing camera handshake
    "PRAC-01": "planned",     # scheduled, hardware not installed yet
    "LAKE-01": "planned",     # scheduled, hardware not installed yet
}
CONNECT_STEPS = [
    "ติดตั้งฮาร์ดแวร์ (Jetson + กล้อง) ที่ตู้ควบคุม",
    "จ่ายไฟ + เชื่อมเครือข่าย (fiber/4G/LoRa)",
    "Jetson ส่ง MQTT heartbeat เข้าศูนย์",
    "จับมือ RTSP กับกล้อง CCTV (ตรวจสตรีม)",
    "YOLO26 ตรวจจับเฟรมแรก (calibrate)",
    "สตรีม metadata → ออนไลน์เต็มรูปแบบ",
]
STAGE_STEPS_DONE = {"online": 6, "connecting": 3, "planned": 0}

INCIDENT_CAP = 30
HISTORY_LEN = 120  # ~last N windows kept per junction for sparkline/analytics


class _LiveState:
    """Thread/async-safe-ish snapshot store. Single writer (the sim loop), many
    readers (API handlers). A simple lock keeps reads coherent."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.started_at = datetime.now(timezone.utc)
        self.tick = 0

        # Per-junction current status, keyed by junction_id
        self.junctions: dict[str, dict] = {}
        for j in JUNCTIONS_SEED:
            self.junctions[j["id"]] = {
                **j,
                "vehicle_count": 0,
                "queue_length_m": 0.0,
                "avg_speed_kmh": 0.0,
                "congestion_score": 0.0,
                "green_seconds": 30,
                "red_seconds": 30,
                "valid_until": None,
                "updated_at": None,
            }

        self.history: dict[str, deque] = defaultdict(lambda: deque(maxlen=HISTORY_LEN))
        # Time-of-day heatmap: hour(0-23) -> running avg congestion
        self.hourly: dict[int, list] = {h: [0.0, 0] for h in range(24)}
        self.incidents: deque = deque(maxlen=INCIDENT_CAP)
        self.agent_log: deque = deque(maxlen=20)

        # Citizen engagement counters (Agent 5)
        self.complaints: dict[str, int] = defaultdict(int)
        self.complaints_total = 0
        self.complaints_resolved = 0

        # Edge nodes (Jetson + cameras) per junction — for the police/ops monitor.
        # Honest provisioning lifecycle: NOT all hardware is deployed yet. Stage is
        # one of: "online" (live), "connecting" (handshaking), "planned" (no hardware).
        self.nodes: dict[str, dict] = {}
        for j in JUNCTIONS_SEED:
            orin = j["zone"] == "A"
            stage = NODE_STAGE.get(j["id"], "planned")
            done = STAGE_STEPS_DONE[stage]
            cam_status = {"online": "online", "connecting": "linking", "planned": "offline"}[stage]
            self.nodes[j["id"]] = {
                "node_id": j["zone"], "junction_id": j["id"], "name": j["name"],
                "jetson": "Jetson Orin" if orin else "Jetson Nano",
                "model": "yolo26m" if orin else "yolo26n",
                "stage": stage, "status": stage,
                # A real Jetson/CCTV is only registered for the live pilot nodes.
                "device_registered": stage == "online",
                "fps": 0.0, "gpu_temp_c": 0.0, "detections_today": 0,
                "uptime_pct": round(99.0 + 0.9 * (hash(j["id"]) % 10) / 10, 2) if stage == "online" else 0.0,
                "last_heartbeat": datetime.now(timezone.utc).isoformat() if stage != "planned" else None,
                "steps": [{"label": s, "done": i < done} for i, s in enumerate(CONNECT_STEPS)],
                "cameras": [
                    {"id": f"cam-{j['id']}-1", "view": "ขาเข้าหลัก", "status": cam_status, "resolution": "4MP", "fps": 25 if stage == "online" else 0},
                    {"id": f"cam-{j['id']}-2", "view": "ขาออก/คนข้าม", "status": cam_status, "resolution": "4MP", "fps": 25 if stage == "online" else 0},
                ],
            }

        # User trip history (PDPA: per-user, consented, anonymized id) + comments
        self.trips: dict[str, list] = defaultdict(list)
        self.comments: deque = deque(maxlen=40)

    # -- writers (called by the sim / orchestrator) --------------------------
    def update_junction(self, event: dict, timing: dict) -> None:
        with self._lock:
            self.tick += 1
            j = self.junctions[event["junction_id"]]
            j["vehicle_count"] = event["vehicle_count"]
            j["queue_length_m"] = event["queue_length_m"]
            j["avg_speed_kmh"] = event["avg_speed_kmh"]
            j["congestion_score"] = event["congestion_score"]
            j["green_seconds"] = timing["green_seconds"]
            j["red_seconds"] = timing["red_seconds"]
            j["valid_until"] = timing.get("valid_until")
            j["updated_at"] = event["timestamp"]

            self.history[event["junction_id"]].append(
                {"t": event["timestamp"], "score": event["congestion_score"],
                 "count": event["vehicle_count"]}
            )
            hour = datetime.now(timezone.utc).hour
            acc = self.hourly[hour]
            acc[0] += event["congestion_score"]
            acc[1] += 1

            # Edge node telemetry — only counts for junctions whose hardware is LIVE.
            # "connecting"/"planned" nodes report no detections (honest provisioning).
            node = self.nodes.get(event["junction_id"])
            if node and node["stage"] == "online":
                node["detections_today"] += event["vehicle_count"]
                load = event["congestion_score"]
                node["fps"] = round(30 - 8 * load + (self.tick % 3) * 0.3, 1)
                node["gpu_temp_c"] = round(46 + 16 * load + (self.tick % 5) * 0.4, 1)
                node["last_heartbeat"] = event["timestamp"]

    def add_incident(self, incident: dict) -> None:
        with self._lock:
            incident = {**incident, "id": f"INC-{self.tick}",
                        "detected_at": datetime.now(timezone.utc).isoformat(),
                        "status": "active"}
            self.incidents.appendleft(incident)

    def log_agent(self, agent: str, summary: str) -> None:
        with self._lock:
            self.agent_log.appendleft(
                {"agent": agent, "summary": summary,
                 "at": datetime.now(timezone.utc).isoformat()})

    def set_mode(self, junction_id: str, mode: str) -> dict | None:
        with self._lock:
            j = self.junctions.get(junction_id)
            if not j:
                return None
            j["mode"] = mode
            return dict(j)

    def add_complaint(self, category: str, resolved: bool = False) -> None:
        with self._lock:
            self.complaints[category] += 1
            self.complaints_total += 1
            if resolved:
                self.complaints_resolved += 1

    def seed_demo_history(self) -> None:
        """Pre-fill the time-of-day heatmap with a typical Khon Kaen weekday curve
        and a couple of representative incidents, so the dashboard looks alive the
        instant a judge opens it (before the live sim has run a full cycle)."""
        import math
        with self._lock:
            if any(acc[1] for acc in self.hourly.values()):
                return  # already has data
            for h in range(24):
                rush = max(math.exp(-((h - 8) ** 2) / 4.0),
                           math.exp(-((h - 17.5) ** 2) / 4.0))
                base = 0.18 + 0.62 * rush
                self.hourly[h] = [base * 4, 4]  # avg = base, weight 4

        self.add_incident({
            "type": "congestion_spike", "location": "SRIC-01", "severity": "moderate",
            "z_score": 3.4,
            "gemini_description": "ตรวจพบความหนาแน่นผิดปกติที่แยกศรีจันทร์ x กลางเมือง: "
            "รถสะสม ~92 ม. คาดว่ามีกิจกรรมช่วงเย็น — แนะนำขยายไฟเขียวฝั่งหลัก",
            "recommended_action": "ขยายไฟเขียว / แจ้งเจ้าหน้าที่",
        })
        self.add_incident({
            "type": "stalled_vehicle", "location": "MITR-01", "severity": "high",
            "z_score": 4.2,
            "gemini_description": "พบยานพาหนะหยุดนิ่งในเลนซ้าย ถ.มิตรภาพ x ศรีจันทร์ "
            "เป็นเวลานาน — อาจเป็นรถเสีย แนะนำส่งเจ้าหน้าที่ตรวจสอบ",
            "recommended_action": "ส่งเจ้าหน้าที่ตรวจสอบจุดเกิดเหตุ",
        })

    # -- readers (called by API handlers) ------------------------------------
    def junctions_list(self) -> list[dict]:
        with self._lock:
            return [dict(j) for j in self.junctions.values()]

    def junction(self, jid: str) -> dict | None:
        with self._lock:
            j = self.junctions.get(jid)
            if not j:
                return None
            return {**dict(j), "history": list(self.history[jid])}

    def incidents_list(self) -> list[dict]:
        with self._lock:
            return list(self.incidents)

    def heatmap(self) -> list[dict]:
        with self._lock:
            return [{"hour": h, "congestion": round(acc[0] / acc[1], 3) if acc[1] else 0.0}
                    for h, acc in self.hourly.items()]

    def top_congested(self, n: int = 5) -> list[dict]:
        with self._lock:
            ranked = sorted(self.junctions.values(),
                            key=lambda j: j["congestion_score"], reverse=True)
            return [{"id": j["id"], "name": j["name"],
                     "congestion_score": j["congestion_score"],
                     "vehicle_count": j["vehicle_count"]} for j in ranked[:n]]

    def summary(self) -> dict:
        with self._lock:
            js = list(self.junctions.values())
            n = len(js) or 1
            avg = sum(j["congestion_score"] for j in js) / n
            auto = sum(1 for j in js if j["mode"] == "auto")
            uptime_s = (datetime.now(timezone.utc) - self.started_at).total_seconds()
            return {
                "junctions_active": len(js),
                "avg_congestion": round(avg, 3),
                "mode_auto": auto,
                "mode_manual": len(js) - auto,
                "active_incidents": sum(1 for i in self.incidents if i["status"] == "active"),
                "uptime_seconds": int(uptime_s),
                "tick": self.tick,
            }

    def citizen_stats(self) -> dict:
        with self._lock:
            return {
                "total": self.complaints_total,
                "resolved": self.complaints_resolved,
                "pending": self.complaints_total - self.complaints_resolved,
                "by_category": dict(self.complaints),
            }

    def agent_activity(self) -> list[dict]:
        with self._lock:
            return list(self.agent_log)

    # -- Edge nodes / cameras (police & ops monitor) -------------------------
    def nodes_list(self) -> list[dict]:
        with self._lock:
            return [dict(n) for n in self.nodes.values()]

    def fleet_summary(self) -> dict:
        with self._lock:
            nodes = list(self.nodes.values())
            cams = [c for n in nodes for c in n["cameras"]]
            online = [n for n in nodes if n["stage"] == "online"]
            return {
                "nodes_total": len(nodes),
                "nodes_online": len(online),
                "nodes_connecting": sum(1 for n in nodes if n["stage"] == "connecting"),
                "nodes_planned": sum(1 for n in nodes if n["stage"] == "planned"),
                "cameras_total": len(cams),
                "cameras_online": sum(1 for c in cams if c["status"] == "online"),
                "detections_today": sum(n["detections_today"] for n in nodes),
                "avg_fps": round(sum(n["fps"] for n in online) / (len(online) or 1), 1),
            }

    def connect_node(self, jid: str) -> dict | None:
        """Attempt the real Jetson↔CCTV handshake.

        Honest behaviour: if no real device is registered at this junction (i.e.
        the hardware hasn't actually been installed yet), the connection is
        REJECTED — we never fake a success. Returns a result dict:
            {ok, rejected?, message, node?}
        Returns None only if the junction id is unknown.
        """
        with self._lock:
            n = self.nodes.get(jid)
            if not n:
                return None
            if n["stage"] == "online":
                return {"ok": True, "message": "แยกนี้ออนไลน์อยู่แล้ว", "node": dict(n)}
            if not n.get("device_registered"):
                # No physical Jetson/camera paired to the backend → cannot connect.
                return {
                    "ok": False, "rejected": True,
                    "message": ("❌ เชื่อมต่อไม่สำเร็จ: ยังไม่พบ Jetson Nano/กล้องจริงที่แยกนี้ "
                                "(ยังไม่ได้ติดตั้ง/ลงทะเบียนอุปกรณ์หน้างาน). "
                                "ระบบยังไม่ได้ทำการเชื่อมต่อจริง — ต้องนำ Jetson ไปติดตั้งและจับคู่ก่อน"),
                    "node": dict(n),
                }
            # Real device present → finalize the handshake.
            n["stage"] = n["status"] = "online"
            n["uptime_pct"] = 99.0
            n["last_heartbeat"] = datetime.now(timezone.utc).isoformat()
            for s in n["steps"]:
                s["done"] = True
            for c in n["cameras"]:
                c["status"] = "online"
                c["fps"] = 25
            return {"ok": True, "message": "เชื่อมต่อ Jetson + กล้องสำเร็จ → ออนไลน์", "node": dict(n)}

    # -- User trips (PDPA: consented, anonymized) + comments -----------------
    def add_trip(self, email: str, trip: dict) -> None:
        with self._lock:
            trip = {**trip, "id": f"TRIP-{self.tick}-{len(self.trips[email])}",
                    "at": datetime.now(timezone.utc).isoformat()}
            self.trips[email].insert(0, trip)
            self.trips[email] = self.trips[email][:25]

    def trips_for(self, email: str) -> list[dict]:
        with self._lock:
            return list(self.trips.get(email, []))

    def add_comment(self, user: str, text: str) -> dict:
        with self._lock:
            c = {"id": f"CMT-{self.tick}", "user": user, "text": text,
                 "at": datetime.now(timezone.utc).isoformat()}
            self.comments.appendleft(c)
            return c

    def comments_list(self) -> list[dict]:
        with self._lock:
            return list(self.comments)


# Single shared instance.
STATE = _LiveState()
