import { useState } from "react";
import { useAuth, useTheme } from "../contexts.jsx";
import { IconMoon, IconSun } from "../icons.jsx";

const ROLES = [
  ["citizen", "ประชาชน"],
  ["officer", "เจ้าหน้าที่"],
  ["admin", "ผู้ดูแล"],
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("citizen");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register({ email, name, password, role });
    } catch (err) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setMode("login");
    setEmail("officer@khonkaen.go.th");
    setPassword("demo1234");
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-hero">
        <div className="hero-logo">
          <img src="/logo.svg" alt="Urban IntelliFlow" />
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
            <button className="icon-btn" onClick={toggle} title="สลับธีม"
                    aria-label="toggle theme">
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
          </div>
          <div className="lead">
            {mode === "login"
              ? "ยินดีต้อนรับกลับสู่ศูนย์ควบคุมจราจรขอนแก่น"
              : "สร้างบัญชีเพื่อเข้าถึงแดชบอร์ดและบริการประชาชน"}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="field">
                <label>ชื่อที่แสดง</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="เช่น คุณมานี / จนท. สมชาย" />
              </div>
            )}
            <div className="field">
              <label>อีเมล</label>
              <input type="email" value={email} required
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="you@khonkaen.go.th" />
            </div>
            <div className="field">
              <label>รหัสผ่าน</label>
              <input type="password" value={password} required minLength={6}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="อย่างน้อย 6 ตัวอักษร" />
            </div>
            {mode === "register" && (
              <div className="field">
                <label>บทบาท</label>
                <div className="role-row">
                  {ROLES.map(([k, label]) => (
                    <div key={k}
                         className={`role-chip ${role === k ? "active" : ""}`}
                         onClick={() => setRole(k)}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn" disabled={busy}>
              {busy ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
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
            🔑 บัญชีทดลอง: <b>officer@khonkaen.go.th</b> / <b>demo1234</b>{" "}
            <button type="button" onClick={useDemo}>กรอกให้อัตโนมัติ</button>
          </div>
        </div>
      </section>
    </div>
  );
}
