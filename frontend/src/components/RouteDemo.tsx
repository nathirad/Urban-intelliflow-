import { useState } from "react";
import { postJSON } from "../api";

const JUNCTIONS = [
  ["MITR-01", "ถ.มิตรภาพ x ศรีจันทร์"],
  ["MITR-02", "ถ.มิตรภาพ x ประชาสโมสร"],
  ["SRIC-01", "ถ.ศรีจันทร์ x กลางเมือง"],
  ["PRAC-01", "ถ.ประชาสโมสร x หน้า มข."],
  ["LAKE-01", "บึงแก่นนคร"],
];
const levelLabel = { low: "คล่องตัว", moderate: "ปานกลาง", high: "หนาแน่น" };

// Citizen route guidance demo (Agent 3) — A*/Dijkstra weighted by live congestion.
export default function RouteDemo() {
  const [origin, setOrigin] = useState("MITR-01");
  const [dest, setDest] = useState("PRAC-01");
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setBusy(true);
    setError("");
    try {
      setRes(await postJSON("/api/route", { origin, destination: dest }));
    } catch (e) {
      setRes(null);
      setError(e.message || "ค้นหาเส้นทางไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>แนะนำเส้นทาง (ประชาชน) <span className="agent-tag">Agent 3</span></h2>
      <div className="route-controls">
        <label>
          จาก
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {JUNCTIONS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <label>
          ไป
          <select value={dest} onChange={(e) => setDest(e.target.value)}>
            {JUNCTIONS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </label>
        <button onClick={find} disabled={busy}>{busy ? "…" : "ค้นหาเส้นทาง"}</button>
      </div>

      {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}

      {res && (
        <div className="route-result">
          <div className="route-eta">
            ~{res.estimated_minutes} นาที
            <span className={`route-level lvl-${res.congestion_level}`}>
              {levelLabel[res.congestion_level] || res.congestion_level}
            </span>
          </div>
          <div className="route-path">
            {res.waypoints.map((w, i) => (
              <span key={i}>{w}{i < res.waypoints.length - 1 ? " → " : ""}</span>
            ))}
          </div>
        </div>
      )}
      <div className="muted small">เส้นทางถ่วงน้ำหนักด้วยความหนาแน่นเรียลไทม์ (PostGIS pgRouting ใน production)</div>
    </div>
  );
}
