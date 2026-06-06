"""
Agent 1 — Signal Timing Optimizer.

Computes green/red phase durations for a junction from the current queue and the
daily Time-of-Day Plan. Rule-based for the prototype; swap in the ML regression
(trained on Spark batch output) later.
"""
from __future__ import annotations

MIN_GREEN = 15      # seconds
MAX_GREEN = 90
BASE_GREEN = 30
CYCLE = 120         # total cycle length budget


async def run(event: dict) -> dict:
    """event: one per-junction metrics window (see CLAUDE.md data contract)."""
    score = float(event.get("congestion_score", 0.0))
    queue = float(event.get("queue_length_m", 0.0))

    # More congestion → longer green, bounded.
    green = int(BASE_GREEN + score * (MAX_GREEN - BASE_GREEN))
    green = max(MIN_GREEN, min(green, MAX_GREEN))
    red = max(MIN_GREEN, CYCLE - green)

    return {
        "agent": "signal_timing",
        "junction_id": event["junction_id"],
        "green_seconds": green,
        "red_seconds": red,
        "valid_until": None,  # orchestrator stamps this
        "reason": f"congestion={score}, queue={queue}m",
    }
