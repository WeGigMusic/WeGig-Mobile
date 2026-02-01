// src/theme/colours.ts
export const Colours = {
  // Backgrounds
  background: {
    app: "#0B0C0E",
    card: "rgba(255,255,255,0.06)",
    cardStrong: "rgba(255,255,255,0.09)",
  },

  // Text
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255,255,255,0.78)",
    muted: "rgba(255,255,255,0.55)",
    danger: "#ff5a6b",
  },

  // UI
  ui: {
    border: "rgba(255,255,255,0.10)",
    borderStrong: "rgba(255,255,255,0.14)",
    divider: "rgba(255,255,255,0.08)",
  },

  // Brand
  brand: {
    primary: "#2D8CFF",
    primary2: "#1B6DFF",
  },
} as const;
