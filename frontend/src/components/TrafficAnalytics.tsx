import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { usePolling } from "../api";
import { congestionColor, theme } from "../theme";

// Traffic Analytics — time-of-day congestion + top-5 congested junctions.
// Heatmap/peak data is the Spark-batch surrogate (state.py); top-5 is live.
export default function TrafficAnalytics() {
  const { data: heat } = usePolling("/api/heatmap", 8000, []);
  const { data: top } = usePolling("/api/analytics/top", 4000, []);

  const heatData = (heat || []).map((h) => ({
    hour: `${String(h.hour).padStart(2, "0")}:00`,
    congestion: Math.round((h.congestion || 0) * 100),
  }));
  const topData = (top || []).map((t) => ({
    name: t.id, full: t.name, value: Math.round((t.congestion_score || 0) * 100),
  }));

  return (
    <div className="card">
      <h2>วิเคราะห์การจราจร <span className="agent-tag">Spark</span></h2>

      <div className="chart-title">ความหนาแน่นตามช่วงเวลา (Time-of-Day, UTC)</div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={heatData} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.gold} stopOpacity={0.85} />
              <stop offset="100%" stopColor={theme.green} stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,35,28,0.08)" />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
          <Tooltip formatter={(v) => `${v}%`} />
          <Area type="monotone" dataKey="congestion" stroke={theme.flow} strokeWidth={2} fill="url(#cg)" />
        </AreaChart>
      </ResponsiveContainer>

      <div className="chart-title">แยกที่หนาแน่นสูงสุด (Top-5, real-time)</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={topData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={56} />
          <Tooltip formatter={(v, _n, p) => [`${v}%`, p.payload.full]} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {topData.map((d, i) => (
              <Cell key={i} fill={congestionColor(d.value / 100)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
