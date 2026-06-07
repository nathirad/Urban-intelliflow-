import { usePolling } from "../api";

const sevClass = { high: "sev-high", moderate: "sev-mod", low: "sev-low" };
const timeAgo = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  return `${Math.round(s / 3600)} ชม.ที่แล้ว`;
};

// Real-time incident feed (Agent 2 + Gemini narration).
export default function IncidentFeed() {
  const { data: incidents } = usePolling("/api/incidents", 3000, []);
  const list = incidents || [];

  return (
    <div className="card dark">
      <h2>เหตุการณ์เรียลไทม์ <span className="agent-tag gold">Agent 2 · Gemini</span></h2>
      {list.length === 0 && <p className="muted">ยังไม่พบเหตุผิดปกติ — การจราจรอยู่ในเกณฑ์ปกติ ✓</p>}
      <div className="incident-list">
        {list.map((i) => (
          <div key={i.id} className={`incident ${sevClass[i.severity] || "sev-low"}`}>
            <div className="incident-top">
              <span className="incident-loc">📍 {i.location}</span>
              <span className="incident-sev">{i.severity?.toUpperCase()} · z={i.z_score}</span>
            </div>
            <div className="incident-desc">{i.gemini_description}</div>
            <div className="incident-foot">
              <span>{i.recommended_action}</span>
              <span className="muted">{timeAgo(i.detected_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
