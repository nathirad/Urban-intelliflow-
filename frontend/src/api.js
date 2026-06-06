// api.js — tiny fetch + polling helpers for the live backend.
// In dev, Vite proxies /api → http://localhost:8000 (see vite.config.js).
import { useEffect, useRef, useState } from "react";

export async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

export async function postJSON(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

/**
 * Poll an endpoint every `ms`. Returns { data, error, refresh }.
 * `fallback` is shown if the backend is unreachable (offline demo safety net).
 */
export function usePolling(path, ms = 3000, fallback = null) {
  const [data, setData] = useState(fallback);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = async () => {
    try {
      setData(await getJSON(path));
      setError(null);
    } catch (e) {
      setError(e);
      if (fallback != null) setData((d) => d ?? fallback);
    }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, ms);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ms]);

  return { data, error, refresh: load };
}
