"""
orchestrator.py — Orchestrator Agent (central brain).

Consumes per-junction metrics events (from Kafka in production, or simulated with
--mock), fans each event out to the sub-agents concurrently, routes their outputs
to the control layer + dashboards, and updates the shared live state (state.py)
that the API gateway serves.

Run standalone:
    python orchestrator.py --mock            # simulated traffic, prints decisions

Or embedded: main.py launches `run_forever()` as a background task so a single
`uvicorn main:app` powers a fully live dashboard.
"""
from __future__ import annotations

import argparse
import asyncio
import math
import random
from datetime import datetime, timedelta, timezone

from agents import (
    anomaly_detector,
    business_value,
    route_guidance,
    signal_timing,
)
from state import STATE, JUNCTIONS_SEED, ZONE_OF

JUNCTIONS = [j["id"] for j in JUNCTIONS_SEED]

# Per-junction baseline demand (some junctions are simply busier).
_BASELINE = {"MITR-01": 0.62, "MITR-02": 0.55, "SRIC-01": 0.70, "PRAC-01": 0.48, "LAKE-01": 0.35}

# Seed citizen complaints so the engagement donut isn't empty on first load.
_SEED_COMPLAINTS = [
    ("signal_malfunction", True), ("pothole", True), ("illegal_parking", False),
    ("congestion", True), ("pothole", False), ("flooding", False),
    ("illegal_parking", True), ("congestion", True), ("other", True),
    ("pothole", True), ("congestion", False), ("signal_malfunction", True),
]


async def handle_event(event: dict, verbose: bool = False) -> None:
    """Fan out one metrics event to all relevant agents concurrently."""
    route_guidance.update_congestion(event["junction_id"], event["congestion_score"])

    timing, incident = await asyncio.gather(
        signal_timing.run(event),
        anomaly_detector.run(event),
    )

    # Stamp validity and route to control layer.
    timing["valid_until"] = (
        datetime.now(timezone.utc)
        + timedelta(seconds=timing["green_seconds"] + timing["red_seconds"])
    ).isoformat()

    STATE.update_junction(event, timing)
    mode = STATE.junctions[event["junction_id"]]["mode"]
    STATE.log_agent(
        "signal_timing",
        f"{event['junction_id']} → เขียว {timing['green_seconds']}s "
        f"({'Auto/PLC' if mode == 'auto' else 'Manual/Officer'})",
    )

    if incident:
        STATE.add_incident(incident)
        STATE.log_agent("anomaly_detector",
                        f"⚠ {incident['location']} severity={incident['severity']}")

    if verbose:
        _print_control(timing, mode)
        if incident:
            _print_incident(incident)


def _print_control(timing: dict, mode: str) -> None:
    print(f"[CONTROL/{mode:<6}] {timing['junction_id']}  "
          f"green={timing['green_seconds']}s red={timing['red_seconds']}s  ({timing['reason']})")


def _print_incident(incident: dict) -> None:
    print(f"[INCIDENT] {incident['location']}  severity={incident['severity']}  "
          f"z={incident['z_score']}  :: {incident['gemini_description']}")


def _mock_event(force_spike: bool = False) -> dict:
    """Generate a realistic per-junction metrics window.

    Demand follows a time-of-day rush-hour curve × per-junction baseline, with
    noise and the occasional spike so the anomaly detector has something to catch.
    """
    jid = random.choice(JUNCTIONS)
    base = _BASELINE[jid]

    # Rush-hour curve: peaks around 08:00 and 17:30 (local ~UTC+7).
    hour = (datetime.now(timezone.utc).hour + 7) % 24
    rush = max(
        math.exp(-((hour - 8) ** 2) / 4.0),
        math.exp(-((hour - 17.5) ** 2) / 4.0),
    )
    demand = base * (0.45 + 0.85 * rush) + random.uniform(-0.08, 0.08)
    if force_spike:
        demand += random.uniform(0.35, 0.55)
    demand = max(0.05, min(1.0, demand))

    count = int(demand * 75)
    speed = max(4.0, 42.0 - demand * 34.0 + random.uniform(-3, 3))
    score = round(min(1.0, 0.55 * (count / 70) + 0.45 * (1 - speed / 42)), 3)
    return {
        "node_id": ZONE_OF[jid],
        "camera_id": f"cam-{jid}",
        "junction_id": jid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vehicle_count": count,
        "queue_length_m": round(count * 2.0, 1),
        "avg_speed_kmh": round(speed, 1),
        "congestion_score": score,
        "by_class": {
            "car": int(count * 0.45),
            "motorcycle": int(count * 0.45),  # Khon Kaen is motorcycle-heavy
            "truck": int(count * 0.06),
            "bus": int(count * 0.04),
        },
    }


def _seed_demo() -> None:
    business_value.set_rollout(deployed=len(JUNCTIONS), planned=120)
    for cat, resolved in _SEED_COMPLAINTS:
        STATE.add_complaint(cat, resolved=resolved)
    STATE.seed_demo_history()


async def run_forever(interval: float = 1.5, verbose: bool = False) -> None:
    """Main simulation loop. Embedded by main.py and reused by --mock."""
    _seed_demo()
    if verbose:
        print("Orchestrator running (mock traffic). Ctrl-C to stop.\n")
    while True:
        # ~1 in 18 windows is an anomaly spike.
        await handle_event(_mock_event(force_spike=random.random() < 0.055), verbose=verbose)
        if verbose:
            bv = await business_value.run()
            print(f"[VALUE] saved {bv['time_saved_hours_today']}h today | "
                  f"{bv['savings_pct']}% cheaper/junction | ROI ~{bv['roi_month']} mo\n")
        await asyncio.sleep(interval)


async def kafka_loop() -> None:
    # TODO: consume Kafka topic 'intelliflow.metrics', call handle_event per message.
    raise NotImplementedError("Wire confluent-kafka consumer here for production.")


def main():
    p = argparse.ArgumentParser(description="Urban IntelliFlow Orchestrator Agent")
    p.add_argument("--mock", action="store_true", help="run on simulated traffic")
    p.add_argument("--interval", type=float, default=1.5, help="mock event interval (s)")
    args = p.parse_args()

    try:
        if args.mock:
            asyncio.run(run_forever(args.interval, verbose=True))
        else:
            asyncio.run(kafka_loop())
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
