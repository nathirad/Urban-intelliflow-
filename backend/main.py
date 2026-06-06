"""
main.py — FastAPI API Gateway for Urban IntelliFlow.

Serves the dashboard + citizen/officer apps. On startup it launches the
Orchestrator Agent's simulation loop as a background task, so a SINGLE command

    uvicorn main:app --reload --port 8000

powers a fully live end-to-end demo — real agent decisions, live junction state,
incidents, and business-value metrics — without needing cameras, Kafka, or a DB.

In production the read endpoints are backed by MongoDB (real-time lake) and
PostgreSQL/PostGIS (GIS + history), and the loop consumes Kafka instead.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import orchestrator
from agents import business_value, feedback_classifier, route_guidance
from state import STATE

# Disable the background sim with INTELLIFLOW_SIM=0 (e.g. when wiring real Kafka).
RUN_SIM = os.getenv("INTELLIFLOW_SIM", "1") != "0"
SIM_INTERVAL = float(os.getenv("INTELLIFLOW_SIM_INTERVAL", "1.5"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if RUN_SIM:
        task = asyncio.create_task(orchestrator.run_forever(SIM_INTERVAL, verbose=False))
    yield
    if task:
        task.cancel()


app = FastAPI(title="Urban IntelliFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict to dashboard origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health / overview ------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": "urban-intelliflow", "version": app.version}


@app.get("/api/summary")
def get_summary():
    """Top KPI strip: active junctions, avg congestion, auto/manual, incidents, uptime."""
    return STATE.summary()


# --- Junctions (live map + control) ----------------------------------------
@app.get("/api/junctions")
def get_junctions():
    """Live status of every junction — drives the map markers and control panel."""
    return STATE.junctions_list()


@app.get("/api/junctions/{jid}")
def get_junction(jid: str):
    j = STATE.junction(jid)
    if not j:
        raise HTTPException(404, f"unknown junction {jid}")
    return j


class ModeChange(BaseModel):
    mode: str  # "auto" (Smart PLC) | "manual" (officer)


@app.post("/api/junctions/{jid}/mode")
def set_mode(jid: str, body: ModeChange):
    """Simulated Modbus/PLC toggle: hand a junction to Smart PLC (auto) or to a
    traffic officer (manual). The budget-coverage innovation."""
    if body.mode not in ("auto", "manual"):
        raise HTTPException(400, "mode must be 'auto' or 'manual'")
    j = STATE.set_mode(jid, body.mode)
    if not j:
        raise HTTPException(404, f"unknown junction {jid}")
    STATE.log_agent("control_layer",
                    f"{jid} → {'Smart PLC (Auto)' if body.mode == 'auto' else 'Officer (Manual)'}")
    return j


# --- Incidents (Agent 2) ----------------------------------------------------
@app.get("/api/incidents")
def get_incidents():
    return STATE.incidents_list()


# --- Analytics (Spark batch surrogate) -------------------------------------
@app.get("/api/heatmap")
def get_heatmap():
    """Time-of-day congestion (24h). Spark batch output in production."""
    return STATE.heatmap()


@app.get("/api/analytics/top")
def get_top_congested(n: int = 5):
    return STATE.top_congested(n)


@app.get("/api/agents")
def get_agents():
    """Recent multi-agent activity log — shows the orchestration is live."""
    return STATE.agent_activity()


# --- Business Value (Agent 4 — the judge-facing numbers) -------------------
@app.get("/api/business-value")
async def get_business_value():
    return await business_value.run()


# --- Route guidance (Agent 3) ----------------------------------------------
class RouteQuery(BaseModel):
    origin: str
    destination: str


@app.post("/api/route")
async def get_route(q: RouteQuery):
    return await route_guidance.run(q.model_dump())


# --- Citizen feedback (Agent 5) --------------------------------------------
class Complaint(BaseModel):
    text: str | None = None
    image_b64: str | None = None  # PDPA: do not log raw images; process then discard


@app.post("/api/complaint")
async def submit_complaint(c: Complaint):
    result = await feedback_classifier.run(c.model_dump())
    STATE.add_complaint(result["category"], resolved=False)
    return result


@app.get("/api/citizen/stats")
def get_citizen_stats():
    """Complaint classification donut + response KPIs."""
    return STATE.citizen_stats()
