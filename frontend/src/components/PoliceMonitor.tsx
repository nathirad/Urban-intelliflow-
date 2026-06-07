import { usePolling } from "../api";
import { IconCamera } from "../icons";

const fmt = (n: number) => new Intl.NumberFormat("th-TH").format(Math.round(n || 0));

// Police / Ops fleet monitor — connects to the Jetson edge nodes + CCTV per
// junction: live status, FPS, GPU temp, model, and cumulative detections.
export default function PoliceMonitor() {
  const { data } = usePolling("/api/cameras", 2500, { fleet: {}, nodes: [] });
  const fleet = data?.fleet || {};
  const nodes = data?.nodes || [];

  return (
    <div>
      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="kpi"><div className="label">Jetson Nodes ออนไลน์</div>
          <div className="value">{fleet.nodes_online ?? 0}/{fleet.nodes_total ?? 0}</div></div>
        <div className="kpi"><div className="label">กล้อง CCTV ออนไลน์</div>
          <div className="value">{fleet.cameras_online ?? 0}/{fleet.cameras_total ?? 0}</div></div>
        <div className="kpi"><div className="label">ตรวจจับวันนี้ (คัน)</div>
          <div className="value">{fmt(fleet.detections_today)}</div></div>
        <div className="kpi"><div className="label">FPS เฉลี่ย</div>
          <div className="value">{fleet.avg_fps ?? 0}</div></div>
      </div>

      <div className="card">
        <h2><IconCamera size={18} /> สถานะ Edge AI (Jetson) & กล้อง CCTV รายแยก</h2>
        <div className="node-grid">
          {nodes.map((n: any) => (
            <div className="node-card" key={n.junction_id}>
              <div className="node-top">
                <div>
                  <b>{n.junction_id}</b>
                  <span className="node-name">{n.name}</span>
                </div>
                <span className={`node-status ${n.status}`}>● {n.status === "online" ? "ออนไลน์" : "ออฟไลน์"}</span>
              </div>
              <div className="node-meta">
                <span className="chip">{n.jetson}</span>
                <span className="chip gold">{n.model}</span>
              </div>
              <div className="node-stats">
                <div><b>{n.fps}</b><span>FPS</span></div>
                <div><b>{n.gpu_temp_c}°</b><span>GPU</span></div>
                <div><b>{fmt(n.detections_today)}</b><span>ตรวจจับ</span></div>
                <div><b>{n.uptime_pct}%</b><span>uptime</span></div>
              </div>
              <div className="cam-list">
                {n.cameras.map((c: any) => (
                  <div className="cam-row" key={c.id}>
                    <span className={`cam-dot ${c.status}`} />
                    <span className="cam-id">{c.id}</span>
                    <span className="cam-view">{c.view}</span>
                    <span className="cam-res">{c.resolution} · {c.fps}fps</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>
          ภาพดิบไม่ออกจากแยก (PDPA) — ส่งเฉพาะ metadata. RTSP เชื่อมต่อภายในเครือข่ายเทศบาลเท่านั้น
        </div>
      </div>
    </div>
  );
}
