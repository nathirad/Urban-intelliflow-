"""
Agent 2 — Anomaly & Incident Detector.

Rolling z-score on congestion trend per junction. When a spike exceeds the
threshold, optionally calls Gemini 1.5 Flash with a frame to describe the incident
in natural language for the officer dashboard.
"""
from __future__ import annotations

import statistics
from collections import defaultdict, deque

Z_THRESHOLD = 3.0
WINDOW = 10  # number of recent windows kept per junction

_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=WINDOW))


async def run(event: dict) -> dict | None:
    jid = event["junction_id"]
    score = float(event.get("congestion_score", 0.0))
    hist = _history[jid]
    hist.append(score)

    if len(hist) < WINDOW:
        return None  # not enough data yet

    mean = statistics.mean(hist)
    stdev = statistics.pstdev(hist) or 1e-6
    z = (score - mean) / stdev

    if z < Z_THRESHOLD:
        return None  # normal

    description = await _describe_incident(event)
    return {
        "agent": "anomaly_detector",
        "type": "congestion_spike",
        "location": jid,
        "severity": "high" if z > 4 else "moderate",
        "z_score": round(z, 2),
        "gemini_description": description,
        "recommended_action": "dispatch officer / extend green",
    }


async def _describe_incident(event: dict) -> str:
    """Call Gemini 1.5 Flash (VLLM) on a captured frame.

    Prototype: returns a templated string. Wire to the real SDK in production:

        import google.generativeai as genai
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content([
            {"mime_type": "image/jpeg", "data": frame_bytes},
            "Describe the traffic situation in this intersection image. "
            "Identify incidents, vehicle density, and suggest a signal-timing adjustment.",
        ])
        return resp.text
    """
    return (
        f"Unusual congestion at {event['junction_id']}: "
        f"{event.get('vehicle_count', '?')} vehicles, "
        f"queue ~{event.get('queue_length_m', '?')}m. "
        "Possible incident or surge — visual verification recommended."
    )
