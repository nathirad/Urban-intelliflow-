"""
Smoke tests for the Urban IntelliFlow API. Run: pytest -q (from backend/).

Uses the FastAPI TestClient with the lifespan active, so the background simulation
runs briefly and populates live state — exercising the agents end-to-end.
"""
import time

from fastapi.testclient import TestClient

import main


def _client():
    return TestClient(main.app)


def test_health():
    with _client() as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


def test_junctions_seeded():
    with _client() as c:
        js = c.get("/api/junctions").json()
        assert len(js) == 5
        ids = {j["id"] for j in js}
        assert {"MITR-01", "SRIC-01", "LAKE-01"} <= ids
        for j in js:
            assert j["mode"] in ("auto", "manual")
            assert "lat" in j and "lon" in j


def test_business_value_contract():
    with _client() as c:
        bv = c.get("/api/business-value").json()
        # Contract from CLAUDE.md / SUPER_PROMPT.
        for k in ("cost_per_junction_thb", "traditional_cost_thb",
                  "junctions_deployed", "junctions_planned", "savings_pct"):
            assert k in bv
        assert bv["cost_per_junction_thb"] == 150_000
        assert bv["traditional_cost_thb"] == 2_500_000
        assert 90 <= bv["savings_pct"] <= 95


def test_summary_and_seeded_demo_data():
    with _client() as c:
        s = c.get("/api/summary").json()
        assert s["junctions_active"] == 5
        assert s["mode_auto"] + s["mode_manual"] == 5
        # seed_demo_history adds representative incidents + a full-day heatmap
        assert len(c.get("/api/incidents").json()) >= 2
        heat = c.get("/api/heatmap").json()
        assert len(heat) == 24
        assert max(h["congestion"] for h in heat) > 0


def test_mode_toggle():
    with _client() as c:
        before = c.get("/api/junctions/SRIC-01").json()["mode"]
        target = "auto" if before == "manual" else "manual"
        r = c.post("/api/junctions/SRIC-01/mode", json={"mode": target})
        assert r.status_code == 200 and r.json()["mode"] == target
        assert c.post("/api/junctions/NOPE/mode", json={"mode": "auto"}).status_code == 404
        assert c.post("/api/junctions/SRIC-01/mode", json={"mode": "x"}).status_code == 400


def test_route_and_complaint():
    with _client() as c:
        route = c.post("/api/route", json={"origin": "MITR-01", "destination": "PRAC-01"}).json()
        assert route["waypoints"][0] == "MITR-01"
        assert route["waypoints"][-1] == "PRAC-01"
        assert route["estimated_minutes"] > 0

        comp = c.post("/api/complaint", json={"text": "มีน้ำท่วม flooding ที่ถนน"}).json()
        assert comp["category"] == "flooding"
        assert comp["priority"] == "high"


def test_auth_flow():
    with _client() as c:
        # seed account login
        r = c.post("/api/auth/login", json={"email": "officer@khonkaen.go.th", "password": "demo1234"})
        assert r.status_code == 200
        body = r.json()
        assert body["token"] and body["user"]["role"] == "officer"
        assert body["user"]["role_label"] == "เจ้าหน้าที่จราจร"

        # token works on /me
        me = c.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
        assert me.status_code == 200 and me.json()["email"] == "officer@khonkaen.go.th"

        # bad password rejected, no token to /me rejected
        assert c.post("/api/auth/login", json={"email": "officer@khonkaen.go.th", "password": "nope"}).status_code == 401
        assert c.get("/api/auth/me").status_code == 401

        # register new + duplicate guard + weak-password guard
        reg = c.post("/api/auth/register", json={"email": "fresh@x.com", "name": "ใหม่", "password": "secret1", "role": "citizen"})
        assert reg.status_code == 200 and reg.json()["user"]["role"] == "citizen"
        assert c.post("/api/auth/register", json={"email": "fresh@x.com", "password": "secret1"}).status_code == 409
        assert c.post("/api/auth/register", json={"email": "bad", "password": "x"}).status_code == 400
