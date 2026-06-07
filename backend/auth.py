"""
auth.py — minimal but real authentication for the demo.

In-memory user store with salted PBKDF2 password hashing and opaque bearer tokens.
Good enough for a hackathon demo + judge walkthrough; swap the store for PostgreSQL
and tokens for JWT/refresh in production (the API shape stays the same).

PDPA note: we store only email + display name + role. No password is ever logged
or returned; only the salted hash is kept.
"""
from __future__ import annotations

import hashlib
import os
import secrets
import threading
from datetime import datetime, timezone

ROLES = {"citizen", "officer", "admin"}

# OAuth/OIDC providers. In production these federate through Keycloak; the env var
# holds the client id. If unset, the provider runs in clearly-labelled DEMO mode
# (creates a demo account) so the login flow is usable without real credentials.
OAUTH_PROVIDERS = {
    "line":     {"label": "LINE",            "client_env": "LINE_CHANNEL_ID"},
    "facebook": {"label": "Facebook",        "client_env": "FACEBOOK_APP_ID"},
    "google":   {"label": "Google",          "client_env": "GOOGLE_CLIENT_ID"},
    "thaiid":   {"label": "ThaiID",          "client_env": "THAIID_CLIENT_ID"},
    "sso":      {"label": "บัญชีองค์กร (SSO)", "client_env": "OIDC_SSO_CLIENT_ID"},
}


def provider_configured(provider: str) -> bool:
    p = OAUTH_PROVIDERS.get(provider)
    return bool(p and os.getenv(p["client_env"]))

# Role label (Thai) for the UI.
ROLE_LABEL = {
    "citizen": "ประชาชน",
    "officer": "เจ้าหน้าที่จราจร",
    "admin": "ผู้ดูแลระบบ",
}


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, _ = stored.split("$", 1)
        return secrets.compare_digest(_hash_password(password, bytes.fromhex(salt_hex)), stored)
    except Exception:
        return False


class AuthStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.users: dict[str, dict] = {}      # email -> user record
        self.tokens: dict[str, str] = {}      # token -> email
        # Seed demo accounts so judges can log in instantly (shown on the login page).
        self._seed("admin@khonkaen.go.th", "เทศบาลนครขอนแก่น", "admin", "demo1234")
        self._seed("officer@khonkaen.go.th", "จนท. สมชาย", "officer", "demo1234")
        self._seed("citizen@khonkaen.go.th", "คุณมานี", "citizen", "demo1234")

    def _seed(self, email: str, name: str, role: str, password: str) -> None:
        self.users[email] = {
            "email": email, "name": name, "role": role,
            "password": _hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    def register(self, email: str, name: str, password: str, role: str) -> dict:
        email = email.strip().lower()
        if role not in ROLES:
            role = "citizen"
        with self._lock:
            if email in self.users:
                raise ValueError("อีเมลนี้ถูกใช้งานแล้ว")
            self.users[email] = {
                "email": email, "name": name or email.split("@")[0], "role": role,
                "password": _hash_password(password),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            return self._issue_token(email)

    def login(self, email: str, password: str) -> dict:
        email = email.strip().lower()
        with self._lock:
            u = self.users.get(email)
            if not u or not _verify_password(password, u["password"]):
                raise ValueError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
            return self._issue_token(email)

    def social_login(self, provider: str, audience: str) -> dict:
        """Sign in via an OAuth provider (LINE/Google/ThaiID/SSO).

        Real OIDC runs through Keycloak when the provider is configured (env var
        set). Otherwise this is DEMO mode: it provisions a deterministic demo
        account for the provider so the flow works, and flags demo=True so the UI
        can be honest that no real identity was verified."""
        if provider not in OAUTH_PROVIDERS:
            raise ValueError("ไม่รู้จัก provider นี้")
        # SSO is for staff; social providers default to citizens.
        role = "officer" if provider == "sso" else (audience if audience in ROLES else "citizen")
        if role == "admin":
            role = "officer"
        label = OAUTH_PROVIDERS[provider]["label"]
        email = f"{provider}.{role}@demo.intelliflow"
        with self._lock:
            if email not in self.users:
                role_th = ROLE_LABEL.get(role, role)
                self.users[email] = {
                    "email": email, "name": f"ผู้ใช้ {label} ({role_th})", "role": role,
                    "password": _hash_password(secrets.token_hex(8)),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            out = self._issue_token(email)
        out["provider"] = provider
        out["demo"] = not provider_configured(provider)
        return out

    def oidc_login(self, email: str, name: str, role: str) -> dict:
        """Create/login a user from a verified OAuth profile (real provider flow)."""
        role = role if role in ROLES else "citizen"
        if role == "admin":
            role = "officer"
        email = email.strip().lower()
        with self._lock:
            if email not in self.users:
                self.users[email] = {
                    "email": email, "name": name or email.split("@")[0], "role": role,
                    "password": _hash_password(secrets.token_hex(8)),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            return self._issue_token(email)

    def _issue_token(self, email: str) -> dict:
        token = secrets.token_urlsafe(24)
        self.tokens[token] = email
        return {"token": token, "user": self.public_user(email)}

    def public_user(self, email: str) -> dict:
        u = self.users[email]
        return {"email": u["email"], "name": u["name"],
                "role": u["role"], "role_label": ROLE_LABEL.get(u["role"], u["role"])}

    def user_for_token(self, token: str | None) -> dict | None:
        if not token:
            return None
        with self._lock:
            email = self.tokens.get(token)
            return self.public_user(email) if email else None

    def logout(self, token: str | None) -> None:
        with self._lock:
            self.tokens.pop(token, None)


STORE = AuthStore()
