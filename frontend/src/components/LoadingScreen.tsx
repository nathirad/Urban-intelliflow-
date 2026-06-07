import Avatar from "./Avatar";

/** Branded full-screen loading splash (initial load + post-login transition). */
export default function LoadingScreen({
  title = "กำลังโหลด…", user,
}: { title?: string; user?: { name?: string; role?: string; role_label?: string; avatarUrl?: string } }) {
  return (
    <div className="splash">
      <div className="splash-inner">
        <img className="splash-logo" src="/logo.png" alt="Urban IntelliFlow"
             onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.src.endsWith("/logo.svg")) t.src = "/logo.svg"; }} />
        <div className="splash-title">Urban <b>IntelliFlow</b></div>

        {user && (
          <div className="splash-user">
            <Avatar name={user.name} role={user.role} avatarUrl={user.avatarUrl} size={48} />
            <div className="splash-welcome">
              <span>ยินดีต้อนรับ</span>
              <b>{user.name}</b>
              <small>{user.role_label}</small>
            </div>
          </div>
        )}

        <div className="splash-loader"><span className="spin" /> {title}</div>
      </div>
    </div>
  );
}
