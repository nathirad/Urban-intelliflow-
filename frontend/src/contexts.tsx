import { createContext, useContext, useEffect, useState } from "react";
import { postJSON, getJSON, TOKEN_KEY } from "./api";

/* ---------------- Theme (light / dark) ---------------- */
const ThemeCtx = createContext(null);
const THEME_KEY = "uif_theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content", theme === "dark" ? "#0b1c17" : "#f3eee4");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------------- Auth ---------------- */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Capture a token returned by a real OAuth callback redirect (?token=...).
    const params = new URLSearchParams(window.location.search);
    const cbToken = params.get("token");
    if (cbToken) {
      localStorage.setItem(TOKEN_KEY, cbToken);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) { setReady(true); return; }
    getJSON("/api/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const finish = (res) => {
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  };

  const login = (email, password) =>
    postJSON("/api/auth/login", { email, password }).then(finish);

  const register = (payload) =>
    postJSON("/api/auth/register", payload).then(finish);

  const social = (provider: string, audience: string) =>
    postJSON(`/api/auth/social/${provider}`, { audience }).then((r: any) => { finish(r); return r; });

  const logout = () => {
    postJSON("/api/auth/logout", {}).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, social, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => useContext(AuthCtx);
