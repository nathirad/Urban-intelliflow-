"""
Agent 4 — Business Value & Cost Agent.   ← drives the web dashboard

Continuously computes economic + social impact metrics. These numbers are what the
hackathon judges see first, so keep the assumptions explicit and tunable.

All baseline constants are editable here. Replace with measured values once the
prototype runs against real before/after data.
"""
from __future__ import annotations

# ---- Tunable assumptions (document every number for the pitch) ----------------
TRADITIONAL_COST_THB = 2_500_000      # full adaptive system per junction (proposal)
OUR_COST_THB = 150_000                # IntelliFlow per junction (reuse existing infra)

AVG_COMMUTERS_PER_JUNCTION_DAY = 8_000
TIME_SAVED_MIN_PER_COMMUTER = 2.0     # conservative wait reduction at optimized junction
# Only a fraction of saved wait time translates to measurable idle-fuel savings
FUEL_SAVING_FRACTION = 0.25           # discount factor (not all saved time was idling)
FUEL_BURN_L_PER_IDLE_HOUR = 0.9       # idling fuel burn (small car, AC on)
FUEL_PRICE_THB_PER_L = 35.0
PM25_UG_PER_IDLE_HOUR = 1.2           # crude proxy; calibrate with sensor data
MAINTENANCE_THB_PER_JUNCTION_MONTH = 1_500


class BusinessValueState:
    """Holds rollout progress; updated by the orchestrator as nodes report in."""
    def __init__(self):
        self.junctions_deployed = 5      # demo: 5-junction pilot zone
        self.junctions_planned = 120     # Khon Kaen major junctions (estimate)
        self.cumulative_time_saved_hours = 0.0


_state = BusinessValueState()


def set_rollout(deployed: int, planned: int) -> None:
    _state.junctions_deployed = deployed
    _state.junctions_planned = planned


def add_time_saved(hours: float) -> None:
    _state.cumulative_time_saved_hours += hours


def snapshot() -> dict:
    deployed = _state.junctions_deployed

    # Daily aggregate across deployed junctions
    commuters = deployed * AVG_COMMUTERS_PER_JUNCTION_DAY
    time_saved_hours_today = commuters * TIME_SAVED_MIN_PER_COMMUTER / 60.0

    fuel_saved_liters = time_saved_hours_today * FUEL_BURN_L_PER_IDLE_HOUR * FUEL_SAVING_FRACTION
    fuel_cost_saved_thb = fuel_saved_liters * FUEL_PRICE_THB_PER_L
    pm25_reduction_ug = time_saved_hours_today * PM25_UG_PER_IDLE_HOUR

    # ROI: months until cumulative fuel savings exceed deployment + maintenance cost
    deploy_cost = deployed * OUR_COST_THB
    monthly_saving = fuel_cost_saved_thb * 30
    monthly_net = monthly_saving - deployed * MAINTENANCE_THB_PER_JUNCTION_MONTH
    roi_month = round(deploy_cost / monthly_net, 1) if monthly_net > 0 else None

    return {
        "time_saved_hours_today": round(time_saved_hours_today, 1),
        "fuel_saved_liters": round(fuel_saved_liters, 1),
        "fuel_cost_saved_thb": round(fuel_cost_saved_thb, 0),
        "pm25_reduction_ug": round(pm25_reduction_ug, 2),
        "cost_per_junction_thb": OUR_COST_THB,
        "traditional_cost_thb": TRADITIONAL_COST_THB,
        "savings_pct": round(100 * (1 - OUR_COST_THB / TRADITIONAL_COST_THB), 1),
        "roi_month": roi_month,
        "junctions_deployed": deployed,
        "junctions_planned": _state.junctions_planned,
    }


async def run(event: dict | None = None) -> dict:
    return {"agent": "business_value", **snapshot()}
