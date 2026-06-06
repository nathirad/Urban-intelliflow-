#!/usr/bin/env bash
# start-demo.sh — bring up the full Urban IntelliFlow demo (backend + frontend).
# One command → a fully live dashboard. Ctrl-C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "🚦 Urban IntelliFlow — starting demo…"

# --- Backend (FastAPI + Orchestrator sim) ---------------------------------
cd "$BACKEND"
if [ ! -d .venv ]; then
  echo "→ creating backend virtualenv + installing deps (first run only)…"
  python3 -m venv .venv
  ./.venv/bin/pip install -q --disable-pip-version-check -r requirements.txt
fi
echo "→ backend  : http://localhost:8000  (docs at /docs)"
./.venv/bin/uvicorn main:app --port 8000 &
BACKEND_PID=$!

# --- Frontend (React PWA dashboard) ---------------------------------------
cd "$FRONTEND"
if [ ! -d node_modules ]; then
  echo "→ installing frontend deps (first run only)…"
  npm install --silent
fi
echo "→ dashboard: http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "🛑 stopping…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM

echo ""
echo "✅ Demo is up. Open http://localhost:5173  (Ctrl-C to stop)"
wait
