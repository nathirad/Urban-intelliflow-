import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider, ThemeProvider } from "./contexts";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
