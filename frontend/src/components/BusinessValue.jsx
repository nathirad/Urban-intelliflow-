import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { theme } from "../theme.js";
import CountUp from "./CountUp.jsx";

const fmt = (n) => new Intl.NumberFormat("th-TH").format(Math.round(n || 0));

// Build a cumulative cost-vs-benefit curve so judges can see the break-even point.
function roiSeries(data) {
  const deployCost = (data.junctions_deployed || 1) * (data.cost_per_junction_thb || 150000);
  const monthlySaving = (data.fuel_cost_saved_thb || 0) * 30; // daily → monthly
  const months = Math.max(12, Math.ceil((data.roi_month || 6) * 1.8));
  const pts = [];
  for (let m = 0; m <= months; m++) {
    pts.push({ month: m, benefit: Math.round(monthlySaving * m), cost: deployCost });
  }
  return pts;
}

// Rollout progress ring (deployed / planned).
function Ring({ deployed, planned }) {
  const pct = planned ? deployed / planned : 0;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <div className="ring-wrap">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(27,77,62,0.15)" strokeWidth="8" />
        <circle
          cx="42" cy="42" r={R} fill="none" stroke={theme.gold} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="38" textAnchor="middle" className="ring-num">{deployed}</text>
        <text x="42" y="54" textAnchor="middle" className="ring-den">/{planned}</text>
      </svg>
      <div className="ring-label">แยกที่ติดตั้ง<br />(Rollout)</div>
    </div>
  );
}

// Business Value section (Agent 4 output). The first thing judges should see.
export default function BusinessValue({ data }) {
  if (!data) return <div className="card"><h2>Business Value</h2><p>กำลังโหลด…</p></div>;

  const series = roiSeries(data);

  return (
    <div className="card">
      <h2>มูลค่าทางเศรษฐกิจ & ต้นทุน <span className="agent-tag">Agent 4</span></h2>

      <div className="bv-head">
        <div className="savings-badge">
          ประหยัด <CountUp value={data.savings_pct} decimals={0} suffix="%" />
        </div>
        <Ring deployed={data.junctions_deployed} planned={data.junctions_planned} />
      </div>

      <div className="cost-row">
        <span>ระบบ Adaptive เดิม / แยก</span>
        <span className="old">{fmt(data.traditional_cost_thb)} ฿</span>
      </div>
      <div className="cost-row">
        <span>Urban IntelliFlow / แยก</span>
        <span className="new">{fmt(data.cost_per_junction_thb)} ฿</span>
      </div>

      <div className="metric-pair">
        <div className="metric">
          <div className="n"><CountUp value={data.time_saved_hours_today} /></div>
          <div className="l">ชม. ที่ประหยัดวันนี้ (ทั้งเมือง)</div>
        </div>
        <div className="metric">
          <div className="n"><CountUp value={data.fuel_saved_liters} /> ล.</div>
          <div className="l">น้ำมันที่ประหยัด/วัน</div>
        </div>
        <div className="metric">
          <div className="n"><CountUp value={data.fuel_cost_saved_thb} /> ฿</div>
          <div className="l">มูลค่าน้ำมันที่ประหยัด/วัน</div>
        </div>
        <div className="metric">
          <div className="n">{data.roi_month ?? "—"} <small>เดือน</small></div>
          <div className="l">ระยะเวลาคืนทุน (ROI)</div>
        </div>
      </div>

      <div className="chart-title">เส้นทางคืนทุน (Cumulative benefit vs. cost)</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={series} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,35,28,0.08)" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(m) => `${m}ด.`} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v) => `${fmt(v)} ฿`} labelFormatter={(m) => `เดือนที่ ${m}`} />
          <ReferenceLine y={series[0]?.cost} stroke={theme.silver} strokeDasharray="4 4"
            label={{ value: "ต้นทุนติดตั้ง", fontSize: 10, fill: theme.gold }} />
          <Line type="monotone" dataKey="benefit" stroke={theme.flow} strokeWidth={2.5} dot={false} name="ผลตอบแทนสะสม" />
        </LineChart>
      </ResponsiveContainer>

      <div className="bv-foot">
        ลด PM2.5 ~{fmt(data.pm25_reduction_ug)} µg/วัน · เทียบเท่าลดคาร์บอนเพื่อขาย Carbon Credit (TCMA)
      </div>
    </div>
  );
}
