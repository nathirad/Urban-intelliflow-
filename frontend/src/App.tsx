import { useState } from "react";
import { usePolling } from "./api";
import { useAuth, useTheme } from "./contexts";
import AuthPage from "./components/AuthPage";
import LiveMap from "./components/LiveMap";
import BusinessValue from "./components/BusinessValue";
import TrafficAnalytics from "./components/TrafficAnalytics";
import IncidentFeed from "./components/IncidentFeed";
import CitizenEngagement from "./components/CitizenEngagement";
import JunctionControl from "./components/JunctionControl";
import RouteDemo from "./components/RouteDemo";
import CountUp from "./components/CountUp";
import AssistantChat from "./components/AssistantChat";
import {
  IconMap, IconChart, IconControl, IconUsers, IconSun, IconMoon, IconLogout, IconBell,
} from "./icons";

const NAV = [
  { key: "overview", label: "ภาพรวมเมือง", title: "ภาพรวมเมือง · City Overview", Icon: IconMap, roles: ["citizen", "officer", "admin"] },
  { key: "analytics", label: "วิเคราะห์ & เหตุการณ์", title: "วิเคราะห์การจราจร & เหตุการณ์", Icon: IconChart, roles: ["officer", "admin"] },
  { key: "ops", label: "ศูนย์ควบคุม", title: "ศูนย์ควบคุมสัญญาณไฟ", Icon: IconControl, roles: ["officer", "admin"] },
  { key: "citizen", label: "บริการประชาชน", title: "บริการประชาชน", Icon: IconUsers, roles: ["citizen", "officer", "admin"] },
];

const FALLBACK_SUMMARY = {
  junctions_active: 5, avg_congestion: 0.42, mode_auto: 2, mode_manual: 3,
  active_incidents: 0, uptime_seconds: 0,
};
const FALLBACK_BV = {
  savings_pct: 94, traditional_cost_thb: 2500000, cost_per_junction_thb: 150000,
  time_saved_hours_today: 1200, fuel_saved_liters: 300, fuel_cost_saved_thb: 10500,
  roi_month: 2.4, pm25_reduction_ug: 1600, junctions_deployed: 5, junctions_planned: 120,
};

function Sidebar({ nav, active, setActive, role }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.png" alt="Urban IntelliFlow"
             onError={(e) => { if (!e.currentTarget.src.endsWith("/logo.svg")) e.currentTarget.src = "/logo.svg"; }} />
        <div>
          <div className="name">Urban <b>IntelliFlow</b></div>
          <div className="tag">Khon Kaen Smart Traffic</div>
        </div>
      </div>
      {nav.map(({ key, label, Icon }) => (
        <button key={key} className={`nav-item ${active === key ? "active" : ""}`}
                onClick={() => setActive(key)}>
          <Icon className="ic" /> {label}
        </button>
      ))}
      <div className="spacer" />
      <div className="side-foot">
        BDI Hackathon 2026<br />จราจรอัจฉริยะ เมืองน่าอยู่ ขอนแก่นยั่งยืน
      </div>
    </aside>
  );
}

function Header({ title, live, summary, user, logout }) {
  const { theme, toggle } = useTheme();
  const uptime = summary?.uptime_seconds || 0;
  const initials = (user?.name || "?").trim().charAt(0).toUpperCase();
  return (
    <header className="header">
      <div className="page-title">
        <h1>{title}</h1>
        <div className="sub">เทศบาลนครขอนแก่น · {live ? `online · ${uptime}s` : "offline"}</div>
      </div>
      <div className={`live-pill ${live ? "on" : "off"}`}>
        <span className="dot" /> {live ? "LIVE" : "OFFLINE"}
      </div>
      <button className="icon-btn" title="การแจ้งเตือน" aria-label="notifications"><IconBell /></button>
      <button className="icon-btn" onClick={toggle} title="สลับธีม Light/Dark" aria-label="toggle theme">
        {theme === "dark" ? <IconSun /> : <IconMoon />}
      </button>
      <div className="user-menu">
        <div className="avatar">{initials}</div>
        <div className="who">
          <b>{user?.name}</b>
          <span>{user?.role_label}</span>
        </div>
        <button className="logout-btn" onClick={logout} title="ออกจากระบบ"><IconLogout size={16} /></button>
      </div>
    </header>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const [active, setActive] = useState(nav[0].key);
  const activeNav = nav.find((n) => n.key === active) || nav[0];

  const { data: summary, error } = usePolling("/api/summary", 2000, FALLBACK_SUMMARY);
  const { data: junctions } = usePolling("/api/junctions", 2000, []);
  const { data: bv } = usePolling("/api/business-value", 5000, FALLBACK_BV);
  const live = !error;

  return (
    <div className="shell">
      <Sidebar nav={nav} active={active} setActive={setActive} role={user.role} />
      <div className="main">
        <Header title={activeNav.title} live={live} summary={summary} user={user} logout={logout} />
        <div className="content">
          <div className="kpi-strip">
            <div className="kpi"><div className="label">แยกที่เฝ้าระวัง</div>
              <div className="value"><CountUp value={summary?.junctions_active} /></div></div>
            <div className="kpi"><div className="label">ความหนาแน่นเฉลี่ย</div>
              <div className="value"><CountUp value={(summary?.avg_congestion || 0) * 100} suffix="%" /></div></div>
            <div className="kpi"><div className="label">Auto / Manual</div>
              <div className="value">{summary?.mode_auto ?? 0} / {summary?.mode_manual ?? 0}</div></div>
            <div className="kpi"><div className="label">เหตุการณ์ที่กำลังเกิด</div>
              <div className="value alert">{summary?.active_incidents ?? 0}</div></div>
            <div className="kpi"><div className="label">ติดตั้งแล้ว</div>
              <div className="value">{bv?.junctions_deployed ?? 0}<small style={{ fontSize: 16 }}>/{bv?.junctions_planned ?? 0}</small></div></div>
          </div>

          {active === "overview" && (
            <div className="grid">
              <div className="card">
                <h2>แผนที่จราจรขอนแก่น (เรียลไทม์)</h2>
                <LiveMap junctions={junctions || []} />
              </div>
              <BusinessValue data={bv} />
            </div>
          )}
          {active === "analytics" && (
            <div className="grid"><TrafficAnalytics /><IncidentFeed /></div>
          )}
          {active === "ops" && <JunctionControl />}
          {active === "citizen" && (
            <div className="grid"><RouteDemo /><CitizenEngagement /></div>
          )}

          <footer className="foot">
            Urban IntelliFlow · YOLO26 · ByteTrack · Gemini Flash · MQTT · Kafka · Spark ·
            FastAPI · React · OpenLayers · PDPA + ISO 27001
          </footer>
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--text-muted)" }}>กำลังโหลด…</div>;
  }
  return user ? <Dashboard /> : <AuthPage />;
}
