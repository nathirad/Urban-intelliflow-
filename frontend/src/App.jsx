import { useState } from "react";
import { usePolling } from "./api.js";
import LiveMap from "./components/LiveMap.jsx";
import BusinessValue from "./components/BusinessValue.jsx";
import TrafficAnalytics from "./components/TrafficAnalytics.jsx";
import IncidentFeed from "./components/IncidentFeed.jsx";
import CitizenEngagement from "./components/CitizenEngagement.jsx";
import JunctionControl from "./components/JunctionControl.jsx";
import RouteDemo from "./components/RouteDemo.jsx";
import CountUp from "./components/CountUp.jsx";

const TABS = [
  ["overview", "ภาพรวมเมือง"],
  ["analytics", "วิเคราะห์ & เหตุการณ์"],
  ["ops", "ศูนย์ควบคุม"],
  ["citizen", "ประชาชน"],
];

// Offline-safe fallbacks so the dashboard still renders if the API is down.
const FALLBACK_SUMMARY = {
  junctions_active: 5, avg_congestion: 0.42, mode_auto: 2, mode_manual: 3,
  active_incidents: 0, uptime_seconds: 0,
};
const FALLBACK_BV = {
  savings_pct: 94, traditional_cost_thb: 2500000, cost_per_junction_thb: 150000,
  time_saved_hours_today: 1200, fuel_saved_liters: 300, fuel_cost_saved_thb: 10500,
  roi_month: 2.4, pm25_reduction_ug: 1600, junctions_deployed: 5, junctions_planned: 120,
};

function Logo() {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" aria-label="Urban IntelliFlow">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#1B4D3E" stroke="#C9A84C" strokeWidth="2.5" />
      <rect x="25" y="12" width="14" height="34" rx="7" fill="#103029" stroke="#C9A84C" strokeWidth="1.5" />
      <circle cx="32" cy="19" r="3.4" fill="#C0463B" />
      <circle cx="32" cy="29" r="3.4" fill="#D8A23A" />
      <circle cx="32" cy="39" r="3.4" fill="#3E8E6F" />
      <path d="M14 52 L50 52" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const { data: summary, error } = usePolling("/api/summary", 2000, FALLBACK_SUMMARY);
  const { data: junctions } = usePolling("/api/junctions", 2000, []);
  const { data: bv } = usePolling("/api/business-value", 5000, FALLBACK_BV);

  const live = !error;
  const uptime = summary?.uptime_seconds || 0;
  const uptimeStr = uptime > 60 ? `${Math.floor(uptime / 60)}m ${uptime % 60}s` : `${uptime}s`;

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo"><Logo /></div>
        <div className="title">
          <h1>Urban IntelliFlow</h1>
          <div className="sub">จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน · Khon Kaen Smart City</div>
        </div>
        <div className={`live-pill ${live ? "on" : "off"}`}>
          <span className="dot" /> {live ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi"><div className="label">แยกที่เฝ้าระวัง</div>
          <div className="value"><CountUp value={summary?.junctions_active} /></div></div>
        <div className="kpi"><div className="label">ความหนาแน่นเฉลี่ย</div>
          <div className="value"><CountUp value={(summary?.avg_congestion || 0) * 100} suffix="%" /></div></div>
        <div className="kpi"><div className="label">Auto / Manual</div>
          <div className="value">{summary?.mode_auto ?? 0} / {summary?.mode_manual ?? 0}</div></div>
        <div className="kpi"><div className="label">เหตุการณ์ที่กำลังเกิด</div>
          <div className="value alert">{summary?.active_incidents ?? 0}</div></div>
        <div className="kpi"><div className="label">Uptime</div>
          <div className="value">{uptimeStr}</div></div>
      </div>

      <nav className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid">
          <div className="card dark">
            <h2>แผนที่จราจรขอนแก่น (เรียลไทม์)</h2>
            <LiveMap junctions={junctions || []} />
          </div>
          <BusinessValue data={bv} />
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid">
          <TrafficAnalytics />
          <IncidentFeed />
        </div>
      )}

      {tab === "ops" && <JunctionControl />}

      {tab === "citizen" && (
        <div className="grid">
          <RouteDemo />
          <CitizenEngagement />
        </div>
      )}

      <footer className="foot">
        Urban IntelliFlow · BDI Young Innovator Hackathon 2026 · YOLO26 · ByteTrack ·
        Gemini Flash · MQTT · Kafka · Spark · FastAPI · React · OpenLayers ·
        PDPA + ISO 27001
      </footer>
    </div>
  );
}
