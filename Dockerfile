# Single-image web deploy: build the React app, then run FastAPI which serves
# both the static frontend and the API on one port. Deploy this image anywhere
# (Render / Railway / Fly.io / a VPS / the city's own server).
#
#   docker build -t urban-intelliflow .
#   docker run -p 8000:8000 urban-intelliflow      # → http://localhost:8000

# ---- Stage 1: build the frontend ----
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + serve the built frontend ----
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /app/frontend/dist frontend/dist

ENV PORT=8000 INTELLIFLOW_SIM=1
EXPOSE 8000
WORKDIR /app/backend
# Hosts like Render/Railway inject $PORT; default 8000 for local docker run.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
