// theme.js — Urban IntelliFlow design tokens (from the logo).
// Use these everywhere. Never Inter/Roboto, never purple-on-white AI slop.

export const theme = {
  green: "#1B4D3E",      // primary deep forest green
  greenDark: "#103029",
  gold: "#C9A84C",       // accent
  goldSoft: "#E0C878",
  silver: "#A8A9AD",     // muted text
  cream: "#F5F0E8",      // warm off-white background / cards
  ink: "#12231C",        // near-black green for text on cream
  red: "#C0463B",        // congested
  amber: "#D8A23A",      // moderate
  flow: "#3E8E6F",       // flowing (lighter green)
  fontHead: "'DM Serif Display', Georgia, serif",
  fontBody: "'Sarabun', system-ui, sans-serif",
};

export const congestionColor = (score) =>
  score >= 0.66 ? theme.red : score >= 0.33 ? theme.amber : theme.flow;

export const congestionLabel = (score) =>
  score >= 0.66 ? "หนาแน่น" : score >= 0.33 ? "ปานกลาง" : "คล่องตัว";

// Palette for charts/donuts — logo-derived, never purple AI-slop.
export const CHART_COLORS = [
  "#1B4D3E", "#C9A84C", "#3E8E6F", "#D8A23A", "#A8A9AD", "#C0463B",
];

// Thai labels for citizen-complaint categories (Agent 5).
export const CATEGORY_LABEL = {
  pothole: "ถนนชำรุด",
  signal_malfunction: "สัญญาณไฟเสีย",
  illegal_parking: "จอดผิดกฎ",
  flooding: "น้ำท่วม",
  congestion: "รถติด",
  other: "อื่น ๆ",
};
