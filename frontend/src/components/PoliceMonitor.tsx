import { usePolling, postJSON } from "../api";
import { IconCamera } from "../icons";

const fmt = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n || 0));

const STAGE_LABEL: Record<string, string> = {
  online: "ออนไลน์", connecting: "กำลังเชื่อมต่อ", planned: "ยังไม่ติดตั้ง",
};
const camLabel: Record<string, string> = { online: "เชื่อมแล้ว", linking: "กำลังจับมือ", offline: "ยังไม่เชื่อม" };
const hb = (iso: string | null) => {
  if (!iso) return "ยังไม่มีสัญญาณ";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? `heartbeat ${Math.round(s)} วิที่แล้ว` : `heartbeat ${Math.round(s / 60)} นาทีที่แล้ว`;
};

// Police / Ops fleet monitor — honest Jetson↔CCTV connection lifecycle + stats.
export default function PoliceMonitor() {
  const { data, refresh } = usePolling("/api/cameras", 2500, { fleet: {}, nodes: [] });
  const fleet = data?.fleet || {};
  const nodes = data?.nodes || [];

  const connect = async (jid: string) => {
    try { await postJSON(`/api/cameras/${jid}/connect`, {}); refresh(); } catch { /* noop */ }
  };

  return (
    <div>
      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        <div className="kpi"><div className="label">Jetson ออนไลน์</div>
          <div className="value">{fleet.nodes_online ?? 0}/{fleet.nodes_total ?? 0}</div></div>
        <div className="kpi"><div className="label">กำลังเชื่อมต่อ</div>
          <div className="value alert">{fleet.nodes_connecting ?? 0}</div></div>
        <div className="kpi"><div className="label">ยังไม่ติดตั้ง</div>
          <div className="value">{fleet.nodes_planned ?? 0}</div></div>
        <div className="kpi"><div className="label">กล้อง CCTV ออนไลน์</div>
          <div className="value">{fleet.cameras_online ?? 0}/{fleet.cameras_total ?? 0}</div></div>
        <div className="kpi"><div className="label">ตรวจจับวันนี้ (คัน)</div>
          <div className="value">{fmt(fleet.detections_today)}</div></div>
      </div>

      <div className="card">
        <h2><IconCamera size={18} /> สถานะการเชื่อมต่อ Jetson ↔ กล้อง CCTV รายแยก</h2>
        <div className="node-grid">
          {nodes.map((n: any) => (
            <div className={`node-card stage-${n.stage}`} key={n.junction_id}>
              <div className="node-top">
                <div>
                  <b>{n.junction_id}</b>
                  <span className="node-name">{n.name}</span>
                </div>
                <span className={`node-status ${n.stage}`}>● {STAGE_LABEL[n.stage]}</span>
              </div>
              <div className="node-meta">
                <span className="chip">{n.jetson}</span>
                <span className="chip gold">{n.model}</span>
                <span className="chip">{hb(n.last_heartbeat)}</span>
              </div>

              {n.stage === "online" ? (
                <div className="node-stats">
                  <div><b>{n.fps}</b><span>FPS</span></div>
                  <div><b>{n.gpu_temp_c}°</b><span>GPU</span></div>
                  <div><b>{fmt(n.detections_today)}</b><span>ตรวจจับ</span></div>
                  <div><b>{n.uptime_pct}%</b><span>uptime</span></div>
                </div>
              ) : (
                <ol className="connect-steps">
                  {n.steps.map((s: any, i: number) => (
                    <li key={i} className={s.done ? "done" : "todo"}>
                      <span className="step-tick">{s.done ? "✓" : "○"}</span> {s.label}
                    </li>
                  ))}
                </ol>
              )}

              <div className="cam-list">
                {n.cameras.map((c: any) => (
                  <div className="cam-row" key={c.id}>
                    <span className={`cam-dot ${c.status}`} />
                    <span className="cam-id">{c.id}</span>
                    <span className="cam-view">{c.view}</span>
                    <span className="cam-res">{camLabel[c.status] || c.status}</span>
                  </div>
                ))}
              </div>

              {n.stage !== "online" && (
                <button className="btn gold connect-btn" onClick={() => connect(n.junction_id)}>
                  {n.stage === "connecting" ? "เชื่อมต่อให้เสร็จ (ทดสอบ)" : "เริ่มเชื่อมต่อ Jetson + กล้อง"}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>
          การเปิดเผยตามจริง: ปัจจุบันมี {fleet.nodes_online ?? 0} แยกนำร่องที่ออนไลน์, ส่วนที่เหลือกำลังติดตั้ง/รอติดตั้ง ·
          ภาพดิบไม่ออกจากแยก (PDPA) RTSP อยู่ในวงเครือข่ายเทศบาลเท่านั้น
        </div>
      </div>
    </div>
  );
}
