import { usePolling, postJSON } from "../api";
import { congestionColor, congestionLabel } from "../theme";

// Operations / Officer view — live per-junction timing + Auto↔Manual (simulated
// Modbus PLC) toggle, plus the multi-agent activity log.
export default function JunctionControl() {
  const { data: junctions, refresh } = usePolling("/api/junctions", 2000, []);
  const { data: agents } = usePolling("/api/agents", 2500, []);

  const toggle = async (j) => {
    await postJSON(`/api/junctions/${j.id}/mode`, {
      mode: j.mode === "auto" ? "manual" : "auto",
    });
    refresh();
  };

  return (
    <div className="ops-grid">
      <div className="card">
        <h2>ศูนย์ควบคุมสัญญาณไฟ <span className="agent-tag">Agent 1 · PLC</span></h2>
        <div className="junction-rows">
          {(junctions || []).map((j) => (
            <div className="junction-row" key={j.id}>
              <div className="jr-id">
                <b>{j.id}</b>
                <span>{j.name}</span>
              </div>
              <div className="jr-bar">
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${Math.round((j.congestion_score || 0) * 100)}%`,
                    background: congestionColor(j.congestion_score || 0),
                  }} />
                </div>
                <span className="jr-cong">{congestionLabel(j.congestion_score || 0)} · {j.vehicle_count} คัน</span>
              </div>
              <div className="jr-timing">
                <span className="green-t">🟢 {j.green_seconds}s</span>
                <span className="red-t">🔴 {j.red_seconds}s</span>
              </div>
              <button
                className={`mode-btn ${j.mode}`}
                onClick={() => toggle(j)}
                title="สลับโหมดควบคุม (Modbus PLC)"
              >
                {j.mode === "auto" ? "Auto / PLC" : "Manual / เจ้าหน้าที่"}
              </button>
            </div>
          ))}
        </div>
        <div className="muted small">
          คลิกปุ่มโหมดเพื่อจำลองการสลับ Smart PLC ↔ เจ้าหน้าที่กดเอง (Modbus RTU)
        </div>
      </div>

      <div className="card dark">
        <h2>กิจกรรม Multi-Agent <span className="agent-tag gold">Orchestrator</span></h2>
        <div className="agent-log">
          {(agents || []).map((a, i) => (
            <div className="agent-line" key={i}>
              <span className="agent-name">{a.agent}</span>
              <span className="agent-sum">{a.summary}</span>
            </div>
          ))}
          {(!agents || agents.length === 0) && <p className="muted">รอข้อมูล…</p>}
        </div>
      </div>
    </div>
  );
}
