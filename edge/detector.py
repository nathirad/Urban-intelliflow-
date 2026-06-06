"""
detector.py — Edge vehicle counting for one junction node.

Runs on NVIDIA Jetson Nano (YOLO26n) or Jetson Orin (YOLO26m).
Pulls an RTSP/video stream, runs YOLO26 detection + ByteTrack tracking,
computes per-window metrics, and hands them to publisher.py for MQTT upload.

Edge stays lean: only detection + tracking + Re-ID dedup happen here.
No raw video leaves the node — only lightweight metadata.

Usage:
    python detector.py --source rtsp://cam-001/stream --model yolo26n.pt --node A --junction MITR-01
    python detector.py --source sample_traffic.mp4 --model yolo26n.pt --show   # local demo
"""
from __future__ import annotations

import argparse
import time
from collections import defaultdict
from datetime import datetime, timezone

# YOLO26 — swap weights only: yolo26n.pt (Nano) <-> yolo26m.pt (Orin)
from ultralytics import YOLO

# COCO classes we treat as "vehicles"
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# How often we emit a metrics window (seconds). Matches Spark Streaming window.
WINDOW_SECONDS = 30


def congestion_score(vehicle_count: int, avg_speed_kmh: float) -> float:
    """Simple 0..1 congestion heuristic. Tune against real Khon Kaen data later.

    More vehicles + lower speed → higher score.
    """
    count_factor = min(vehicle_count / 60.0, 1.0)          # saturate at 60 vehicles
    speed_factor = 1.0 - min(avg_speed_kmh / 40.0, 1.0)    # 40 km/h = free flow
    return round(0.5 * count_factor + 0.5 * speed_factor, 3)


def run(source: str, model_path: str, node: str, junction: str,
        camera_id: str, show: bool, on_window):
    model = YOLO(model_path)

    # ByteTrack tracking mode → continuous IDs across frames.
    # Re-ID Merge (dedup across overlapping cameras in the same node) is applied
    # downstream when multiple cameras feed one node — see TODO below.
    results = model.track(
        source=source,
        stream=True,
        tracker="bytetrack.yaml",
        classes=list(VEHICLE_CLASSES.keys()),
        verbose=False,
        show=show,
    )

    window_start = time.time()
    seen_ids: set[int] = set()
    class_counts: dict[str, int] = defaultdict(int)
    # NOTE: avg_speed from a single fixed camera needs homography calibration.
    # For the prototype we leave a placeholder; calibrate per-junction later.
    avg_speed_kmh = 18.0  # TODO: estimate from track displacement + camera calibration

    for r in results:
        if r.boxes is not None and r.boxes.id is not None:
            ids = r.boxes.id.int().tolist()
            classes = r.boxes.cls.int().tolist()
            for tid, cls in zip(ids, classes):
                if tid not in seen_ids:
                    seen_ids.add(tid)
                    class_counts[VEHICLE_CLASSES.get(cls, "other")] += 1

        if time.time() - window_start >= WINDOW_SECONDS:
            vehicle_count = len(seen_ids)
            payload = {
                "node_id": node,
                "camera_id": camera_id,
                "junction_id": junction,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "vehicle_count": vehicle_count,
                "queue_length_m": round(vehicle_count * 2.0, 1),  # TODO: derive from lane geometry
                "avg_speed_kmh": avg_speed_kmh,
                "congestion_score": congestion_score(vehicle_count, avg_speed_kmh),
                "by_class": dict(class_counts),
            }
            on_window(payload)

            # reset window
            window_start = time.time()
            seen_ids.clear()
            class_counts.clear()


def main():
    p = argparse.ArgumentParser(description="Urban IntelliFlow edge detector (YOLO26)")
    p.add_argument("--source", required=True, help="RTSP URL or video file path")
    p.add_argument("--model", default="yolo26n.pt", help="yolo26n.pt (Nano) or yolo26m.pt (Orin)")
    p.add_argument("--node", default="A", help="zone node id (A/B/C ...)")
    p.add_argument("--junction", default="MITR-01", help="junction id")
    p.add_argument("--camera", default="cam-001", help="camera id")
    p.add_argument("--show", action="store_true", help="display annotated frames (demo)")
    p.add_argument("--mqtt", action="store_true", help="publish via MQTT (else print)")
    args = p.parse_args()

    if args.mqtt:
        from publisher import MqttPublisher
        pub = MqttPublisher()
        sink = pub.publish
    else:
        import json
        sink = lambda payload: print(json.dumps(payload, ensure_ascii=False))

    run(args.source, args.model, args.node, args.junction, args.camera, args.show, sink)


if __name__ == "__main__":
    main()
