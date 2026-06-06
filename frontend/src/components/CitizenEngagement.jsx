import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { usePolling, postJSON } from "../api.js";
import { CHART_COLORS, CATEGORY_LABEL } from "../theme.js";

// Citizen Engagement (Agent 5) — complaint classification donut + report form.
export default function CitizenEngagement() {
  const { data: stats, refresh } = usePolling("/api/citizen/stats", 4000, null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await postJSON("/api/complaint", { text });
      setSent(r);
      setText("");
      refresh();
    } catch {
      setSent({ category: "error", assigned_department: "เชื่อมต่อ backend ไม่ได้" });
    } finally {
      setBusy(false);
    }
  };

  const pie = stats
    ? Object.entries(stats.by_category).map(([k, v]) => ({
        name: CATEGORY_LABEL[k] || k, value: v,
      }))
    : [];

  return (
    <div className="card">
      <h2>การมีส่วนร่วมของประชาชน <span className="agent-tag">Agent 5</span></h2>

      <div className="citizen-kpis">
        <div><b>{stats?.total ?? 0}</b><span>เรื่องร้องเรียน</span></div>
        <div><b>{stats?.resolved ?? 0}</b><span>แก้ไขแล้ว</span></div>
        <div><b>{stats?.pending ?? 0}</b><span>กำลังดำเนินการ</span></div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={42} outerRadius={70} paddingAngle={2}>
            {pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>

      <form className="complaint-form" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="แจ้งปัญหา เช่น ‘สัญญาณไฟเสีย’ ‘น้ำท่วม’ ‘ถนนชำรุด’…"
        />
        <button disabled={busy}>{busy ? "…" : "ส่ง"}</button>
      </form>
      {sent && (
        <div className="complaint-result">
          จัดประเภทเป็น <b>{CATEGORY_LABEL[sent.category] || sent.category}</b> → ส่งต่อ{" "}
          {sent.assigned_department}
        </div>
      )}
      <div className="muted small">PDPA: ข้อมูลตำแหน่ง/ตัวตนต้องได้รับความยินยอม และถูกปกปิดก่อนจัดเก็บ</div>
    </div>
  );
}
