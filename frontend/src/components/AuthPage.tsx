import { useState } from "react";
import { useAuth, useTheme } from "../contexts";
import { IconMoon, IconSun, IconUsers, IconCamera } from "../icons";

type Audience = "citizen" | "officer";

const PORTAL: Record<Audience, { title: string; lead: string; demo: string; Icon: any }> = {
  citizen: {
    title: "ประชาชน",
    lead: "ดูจราจรเรียลไทม์ แนะนำเส้นทาง และแจ้งปัญหา",
    demo: "citizen@khonkaen.go.th",
    Icon: IconUsers,
  },
  officer: {
    title: "เจ้าหน้าที่ · ตำรวจจราจร",
    lead: "ศูนย์ควบคุมสัญญาณไฟ กล้อง CCTV/Edge AI และวิเคราะห์",
    demo: "officer@khonkaen.go.th",
    Icon: IconCamera,
  },
};

export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [audience, setAudience] = useState<Audience>("citizen");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      // citizen portal self-registers as citizen; staff registration defaults to officer
      else await register({ email, name, password, role: audience });
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setMode("login");
    setEmail(PORTAL[audience].demo);
    setPassword("demo1234");
  };

  const setPortal = (a: Audience) => { setAudience(a); setError(""); };

  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <div className="hero-logo">
          <img src="/logo.png" alt="Urban IntelliFlow"
               onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith("/logo.svg")) t.src = "/logo.svg"; }} />
          <div className="t">Urban <b>IntelliFlow</b></div>
        </div>
        <div className="hero-mid">
          <h2>จราจรอัจฉริยะ<br />เมืองน่าอยู่ ขอนแก่น</h2>
          <p>
            เปลี่ยนสัญญาณไฟจราจรเดิมให้เป็นระบบอัจฉริยะด้วย IoT + Edge AI
            ต้นทุนต่อแยกลดลง ~94% — ปรับเวลาไฟตามปริมาณรถจริงแบบเรียลไทม์
            ด้วยสถาปัตยกรรม Multi-Agent
          </p>
          <div className="hero-stats">
            <div><b>94%</b><span>ลดต้นทุน/แยก</span></div>
            <div><b>150K฿</b><span>ต่อแยก (จาก 2.5M฿)</span></div>
            <div><b>5+</b><span>Edge-AI Agents</span></div>
          </div>
        </div>
        <div className="hero-foot">BDI Young Innovator Hackathon 2026 · Smart City · ขอนแก่น</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="top">
            <h3>{mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h3>
            <button className="icon-btn" onClick={toggle} title="สลับธีม" aria-label="toggle theme">
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
          </div>

          {/* Portal selector: which app you are signing into */}
          <div className="portal-tabs">
            {(Object.keys(PORTAL) as Audience[]).map((a) => {
              const P = PORTAL[a];
              return (
                <button key={a} type="button"
                        className={`portal-tab ${audience === a ? "active" : ""}`}
                        onClick={() => setPortal(a)}>
                  <P.Icon size={18} /> {P.title}
                </button>
              );
            })}
          </div>
          <div className="lead">{PORTAL[audience].lead}</div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="field">
                <label>ชื่อที่แสดง</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                       placeholder={audience === "officer" ? "เช่น จนท. สมชาย" : "เช่น คุณมานี"} />
              </div>
            )}
            <div className="field">
              <label>อีเมล</label>
              <input type="email" value={email} required
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder={audience === "officer" ? "you@khonkaen.go.th" : "you@email.com"} />
            </div>
            <div className="field">
              <label>รหัสผ่าน</label>
              <input type="password" value={password} required minLength={6}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="อย่างน้อย 6 ตัวอักษร" />
            </div>
            {mode === "register" && audience === "officer" && (
              <div className="muted small" style={{ marginBottom: 12 }}>
                * บัญชีเจ้าหน้าที่ในระบบจริงต้องได้รับอนุมัติจากเทศบาล/หน่วยงานต้นสังกัดก่อนใช้งาน
              </div>
            )}
            <button className="btn" disabled={busy}>
              {busy ? "กำลังดำเนินการ…"
                : mode === "login" ? `เข้าสู่ระบบ (${PORTAL[audience].title})` : "สมัครสมาชิก"}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? (
              <>ยังไม่มีบัญชี? <a onClick={() => { setMode("register"); setError(""); }}>สมัครสมาชิก</a></>
            ) : (
              <>มีบัญชีอยู่แล้ว? <a onClick={() => { setMode("login"); setError(""); }}>เข้าสู่ระบบ</a></>
            )}
          </div>

          <div className="demo-creds">
            🔑 บัญชีทดลอง ({PORTAL[audience].title}): <b>{PORTAL[audience].demo}</b> / <b>demo1234</b>{" "}
            <button type="button" onClick={useDemo}>กรอกให้อัตโนมัติ</button>
          </div>
        </div>
      </section>
    </div>
  );
}
