import { useEffect, useState } from "react";
import { useAuth, useTheme } from "../contexts";
import { getJSON } from "../api";
import { IconMoon, IconSun, IconUsers, IconCamera } from "../icons";
import { LineLogo, FacebookLogo, GoogleLogo, ThaiIDLogo, SsoLogo } from "../brandIcons";

type Audience = "citizen" | "officer";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const Spinner = () => <span className="spin" aria-hidden="true" />;

// Which providers each portal offers (with brand marks).
const PROVIDERS: Record<Audience, { id: string; label: string; cls: string; Logo: any }[]> = {
  citizen: [
    { id: "line", label: "เข้าสู่ระบบด้วย LINE", cls: "line", Logo: LineLogo },
    { id: "facebook", label: "เข้าสู่ระบบด้วย Facebook", cls: "facebook", Logo: FacebookLogo },
    { id: "google", label: "เข้าสู่ระบบด้วย Google", cls: "google", Logo: GoogleLogo },
    { id: "thaiid", label: "ยืนยันตัวตนด้วย ThaiID", cls: "thaiid", Logo: ThaiIDLogo },
  ],
  officer: [
    { id: "sso", label: "เข้าสู่ระบบด้วยบัญชีองค์กร (SSO)", cls: "sso", Logo: SsoLogo },
  ],
};

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
  const { login, register, social } = useAuth();
  const { theme, toggle } = useTheme();
  const [audience, setAudience] = useState<Audience>("citizen");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<Record<string, { configured: boolean }>>({});
  const [pending, setPending] = useState<{ id: string; label: string; cls: string; Logo: any } | null>(null);
  const [proc, setProc] = useState("");  // current processing step text

  useEffect(() => {
    getJSON("/api/auth/providers").then(setProviders).catch(() => {});
    if (new URLSearchParams(window.location.search).get("auth_error")) {
      setError("เข้าสู่ระบบผ่าน provider ไม่สำเร็จ");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const oauth = (p: { id: string; label: string; cls: string; Logo: any }) => {
    setError("");
    if (providers[p.id]?.configured) {
      // Real OAuth: full-page redirect to the provider's actual login page.
      window.location.href = `/api/auth/oauth/${p.id}/login?audience=${audience}`;
      return;
    }
    setPending(p); // not configured → show a simulated consent screen
  };

  const consentAllow = async () => {
    if (!pending) return;
    setBusy(true);
    const name = pending.label.match(/LINE|Facebook|Google|ThaiID/)?.[0] || "บัญชี";
    const steps = [`กำลังเชื่อมต่อ ${name}…`, "กำลังยืนยันตัวตน…", "กำลังเตรียมบัญชีและสิทธิ์การเข้าถึง…"];
    try {
      for (const s of steps) { setProc(s); await delay(650); }
      setProc("กำลังเข้าสู่ระบบ…");
      await social(pending.id, audience);
    } catch (err: any) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
      setPending(null);
    } finally {
      setBusy(false);
      setProc("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    setProc(mode === "login" ? "กำลังตรวจสอบข้อมูลเข้าสู่ระบบ…" : "กำลังสร้างบัญชี…");
    const started = Date.now();
    try {
      if (mode === "login") await login(email, password);
      // citizen portal self-registers as citizen; staff registration defaults to officer
      else await register({ email, name, password, role: audience });
    } catch (err: any) {
      // keep a processing feel even on failure
      const left = 700 - (Date.now() - started);
      if (left > 0) await delay(left);
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      const left = 800 - (Date.now() - started);
      if (left > 0) await delay(left);
      setBusy(false);
      setProc("");
    }
  };

  const useDemo = () => {
    setMode("login");
    setEmail(PORTAL[audience].demo);
    setPassword("demo1234");
  };

  const setPortal = (a: Audience) => { setAudience(a); setError(""); };

  if (pending) {
    const P = pending;
    return (
      <div className="oauth-consent">
        <div className={`consent-card ${P.cls}`}>
          <div className="consent-head">
            <span className="consent-logo"><P.Logo size={30} /></span>
            <div className="consent-provider">{P.label.replace(/^.*ด้วย\s*/, "").replace("ยืนยันตัวตนด้วย ", "")}</div>
          </div>
          <div className="consent-body">
            <div className="consent-title">เข้าสู่ระบบ</div>
            <p className="consent-app">
              <b>Urban IntelliFlow</b> ขออนุญาตเข้าถึงข้อมูลโปรไฟล์ของคุณ
              (ชื่อ และอีเมล) เพื่อสร้างบัญชีผู้ใช้
            </p>
            <div className="consent-account">
              <div className="ca-avatar">{(P.label.match(/LINE|Facebook|Google|ThaiID/)?.[0] || "U")[0]}</div>
              <div>
                <b>บัญชี {P.label.match(/LINE|Facebook|Google|ThaiID/)?.[0]}</b>
                <span>เดโม — ตัวอย่างบัญชีผู้ใช้</span>
              </div>
            </div>
            {busy ? (
              <div className="consent-processing"><Spinner /> {proc || "กำลังเข้าสู่ระบบ…"}</div>
            ) : (
              <>
                <button className="btn consent-allow" onClick={consentAllow}>อนุญาตและดำเนินการต่อ</button>
                <button className="consent-cancel" onClick={() => setPending(null)}>ยกเลิก</button>
              </>
            )}
            <div className="consent-note">
              🔒 หน้าจำลอง OAuth (เดโม) — ใน production จะ redirect ไปหน้า login จริงของ
              {" "}{P.label.match(/LINE|Facebook|Google|ThaiID/)?.[0]} ผ่าน Keycloak OIDC
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="auth-card-brand">
            <img src="/logo.png" alt="Urban IntelliFlow"
                 onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith("/logo.svg")) t.src = "/logo.svg"; }} />
            <div className="t">Urban <b>IntelliFlow</b></div>
          </div>
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
              {busy ? <><Spinner /> {proc || "กำลังดำเนินการ…"}</>
                : mode === "login" ? `เข้าสู่ระบบ (${PORTAL[audience].title})` : "สมัครสมาชิก"}
            </button>
          </form>

          <div className="social-divider"><span>หรือ</span></div>
          <div className="social-btns">
            {PROVIDERS[audience].map((p) => (
              <button key={p.id} type="button" className={`social-btn ${p.cls}`}
                      disabled={busy} onClick={() => oauth(p)}>
                <span className="social-logo"><p.Logo size={18} /></span>
                {p.label}
                {providers[p.id] && !providers[p.id].configured && <span className="demo-tag">เดโม</span>}
              </button>
            ))}
          </div>
          {PROVIDERS[audience].some((p) => providers[p.id] && !providers[p.id].configured) && (
            <div className="muted small" style={{ textAlign: "center", marginTop: 8 }}>
              * โหมดเดโม — ยังไม่ได้เชื่อม provider จริง (production เชื่อม LINE/Google/ThaiID/SSO ผ่าน Keycloak OIDC)
            </div>
          )}

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
