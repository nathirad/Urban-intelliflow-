import { useState } from "react";

/**
 * User avatar. Shows an image if one exists, else falls back to the initial.
 * Drop avatar images at `frontend/public/avatars/{role}.png`
 * (citizen.png / officer.png / admin.png) and they appear automatically.
 * A per-user `avatarUrl` (e.g. from LINE/Google profile) takes priority.
 */
export default function Avatar({
  name, role, avatarUrl, size = 38,
}: { name?: string; role?: string; avatarUrl?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = (name || "?").trim().charAt(0).toUpperCase();
  const src = avatarUrl || `/avatars/${role || "citizen"}.png`;

  if (broken || !src) {
    return (
      <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {initials}
      </div>
    );
  }
  return (
    <img className="avatar avatar-img" style={{ width: size, height: size }}
         src={src} alt={name || "avatar"} onError={() => setBroken(true)} />
  );
}
