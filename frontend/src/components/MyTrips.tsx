import { usePolling } from "../api";
import { IconRoute } from "../icons";

const levelLabel: Record<string, string> = { low: "คล่องตัว", moderate: "ปานกลาง", high: "หนาแน่น" };
const timeAgo = (iso: string) => {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.round(s / 86400)} วันที่แล้ว`;
};

// User trip history (PDPA-consented). Populated when the user searches routes.
export default function MyTrips() {
  const { data } = usePolling("/api/trips", 4000, { trips: [] });
  const trips = data?.trips || [];

  return (
    <div className="card">
      <h2><IconRoute size={18} /> ประวัติการเดินทางของฉัน</h2>
      {trips.length === 0 && <p className="muted">ยังไม่มีประวัติ — ลองค้นหาเส้นทางในแท็บนี้ดูครับ</p>}
      <div className="trip-list">
        {trips.map((t: any) => (
          <div className="trip-row" key={t.id}>
            <div className="trip-path">{t.origin} → {t.destination}</div>
            <div className="trip-meta">
              <span className={`route-level lvl-${t.congestion_level}`}>{levelLabel[t.congestion_level] || t.congestion_level}</span>
              <span>~{t.minutes} นาที</span>
              <span className="muted">{timeAgo(t.at)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 10 }}>
        🔒 PDPA: เก็บประวัติเมื่อได้รับความยินยอม ผูกกับบัญชีแบบไม่ระบุพิกัดบ้าน และลบได้ทุกเมื่อ
      </div>
    </div>
  );
}
