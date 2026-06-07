"""
oauth.py — real OAuth2 / OIDC authorization-code flow for LINE / Facebook / Google.

This is the *production* path. When a provider's client id + secret are set in the
environment, clicking the social button performs a genuine redirect to the provider's
login page, exchanges the code for a token, fetches the user's profile, and signs the
user in. When credentials are NOT set, the API reports the provider as "demo" and the
frontend shows a simulated consent screen instead (see AuthPage).

Register the app + redirect URI with each provider, then set the env vars:
  LINE:     LINE_CHANNEL_ID / LINE_CHANNEL_SECRET
  Facebook: FACEBOOK_APP_ID / FACEBOOK_APP_SECRET
  Google:   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  Base URLs: BACKEND_URL (default http://localhost:8000), FRONTEND_URL (http://localhost:5173)
Redirect URI to register = {BACKEND_URL}/api/auth/oauth/{provider}/callback
"""
from __future__ import annotations

import os
import secrets
import time
from urllib.parse import urlencode

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Per-provider OIDC/OAuth endpoints + how to read the profile.
PROVIDER_CFG = {
    "google": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "userinfo": "https://openidconnect.googleapis.com/v1/userinfo",
        "scope": "openid email profile",
        "id_env": "GOOGLE_CLIENT_ID", "secret_env": "GOOGLE_CLIENT_SECRET",
        "email_key": "email", "name_key": "name",
    },
    "line": {
        "authorize": "https://access.line.me/oauth2/v2.1/authorize",
        "token": "https://api.line.me/oauth2/v2.1/token",
        "userinfo": "https://api.line.me/v2/profile",
        "scope": "profile openid email",
        "id_env": "LINE_CHANNEL_ID", "secret_env": "LINE_CHANNEL_SECRET",
        "email_key": None, "name_key": "displayName",
    },
    "facebook": {
        "authorize": "https://www.facebook.com/v19.0/dialog/oauth",
        "token": "https://graph.facebook.com/v19.0/oauth/access_token",
        "userinfo": "https://graph.facebook.com/me?fields=id,name,email",
        "scope": "email public_profile",
        "id_env": "FACEBOOK_APP_ID", "secret_env": "FACEBOOK_APP_SECRET",
        "email_key": "email", "name_key": "name",
    },
}

# Short-lived state store: state -> {provider, audience, ts}
_STATES: dict[str, dict] = {}
_STATE_TTL = 600


def is_configured(provider: str) -> bool:
    cfg = PROVIDER_CFG.get(provider)
    if not cfg:
        return False
    return bool(os.getenv(cfg["id_env"]) and os.getenv(cfg["secret_env"]))


def _redirect_uri(provider: str) -> str:
    return f"{BACKEND_URL}/api/auth/oauth/{provider}/callback"


def authorize_url(provider: str, audience: str) -> str:
    cfg = PROVIDER_CFG[provider]
    state = secrets.token_urlsafe(16)
    _STATES[state] = {"provider": provider, "audience": audience, "ts": time.time()}
    # prune old states
    for s, v in list(_STATES.items()):
        if time.time() - v["ts"] > _STATE_TTL:
            _STATES.pop(s, None)
    params = {
        "client_id": os.getenv(cfg["id_env"]),
        "redirect_uri": _redirect_uri(provider),
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
    }
    return f"{cfg['authorize']}?{urlencode(params)}"


async def exchange_and_profile(provider: str, code: str, state: str) -> dict:
    """Validate state, swap code→token, fetch profile. Returns {email, name}."""
    st = _STATES.pop(state, None)
    if not st or st["provider"] != provider:
        raise ValueError("invalid or expired state")
    cfg = PROVIDER_CFG[provider]
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _redirect_uri(provider),
        "client_id": os.getenv(cfg["id_env"]),
        "client_secret": os.getenv(cfg["secret_env"]),
    }
    async with httpx.AsyncClient(timeout=15) as client:
        tok = await client.post(cfg["token"], data=data,
                                headers={"Accept": "application/json"})
        tok.raise_for_status()
        access_token = tok.json()["access_token"]
        ui = await client.get(cfg["userinfo"],
                              headers={"Authorization": f"Bearer {access_token}"})
        ui.raise_for_status()
        profile = ui.json()

    name = profile.get(cfg["name_key"]) or "ผู้ใช้"
    email = profile.get(cfg["email_key"]) if cfg["email_key"] else None
    if not email:  # LINE may not return email; synthesize a stable id
        uid = profile.get("userID") or profile.get("sub") or profile.get("id") or secrets.token_hex(6)
        email = f"{provider}_{uid}@{provider}.oidc"
    return {"email": email, "name": name, "audience": st["audience"]}
