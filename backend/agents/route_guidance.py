"""
Agent 3 — Route Guidance Agent.

Answers citizen route queries using the real-time congestion map.
Prototype uses a tiny in-memory graph; production runs A*/Dijkstra on the
PostGIS road network (pgrouting) weighted by live congestion_score.
"""
from __future__ import annotations

import heapq

# Minimal demo graph: junction_id -> list of (neighbor, base_minutes)
# TODO: replace with PostGIS road network for Khon Kaen.
_GRAPH: dict[str, list[tuple[str, float]]] = {
    "MITR-01": [("MITR-02", 3), ("SRIC-01", 4)],
    "MITR-02": [("MITR-01", 3), ("PRAC-01", 5)],
    "SRIC-01": [("MITR-01", 4), ("PRAC-01", 2), ("LAKE-01", 4)],
    "PRAC-01": [("MITR-02", 5), ("SRIC-01", 2)],
    "LAKE-01": [("SRIC-01", 4)],
}

# live congestion multiplier per junction (1.0 = free flow), fed by orchestrator
_congestion: dict[str, float] = {}


def update_congestion(junction_id: str, score: float) -> None:
    _congestion[junction_id] = 1.0 + 2.0 * score  # up to 3x slower when fully congested


async def run(query: dict) -> dict:
    """query: {origin, destination}"""
    origin, dest = query["origin"], query["destination"]
    path, minutes = _dijkstra(origin, dest)
    if path is None:
        raise ValueError(f"ไม่พบเส้นทางจาก {origin} ไป {dest}")
    return {
        "agent": "route_guidance",
        "origin": origin,
        "destination": dest,
        "waypoints": path,
        "estimated_minutes": round(minutes, 1),
        "congestion_level": _avg_level(path),
    }


def _dijkstra(start: str, goal: str):
    if start == goal:
        return [start], 0.0
    if start not in _GRAPH and start != goal:
        return None, None
    pq = [(0.0, start, [start])]
    best = {start: 0.0}
    while pq:
        cost, node, path = heapq.heappop(pq)
        if node == goal:
            return path, cost
        for nbr, base in _GRAPH.get(node, []):
            w = base * _congestion.get(nbr, 1.0)
            nc = cost + w
            if nc < best.get(nbr, float("inf")):
                best[nbr] = nc
                heapq.heappush(pq, (nc, nbr, path + [nbr]))
    return None, None


def _avg_level(path: list[str]) -> str:
    if not path:
        return "unknown"
    avg = sum(_congestion.get(p, 1.0) for p in path) / len(path)
    return "low" if avg < 1.5 else "moderate" if avg < 2.3 else "high"
