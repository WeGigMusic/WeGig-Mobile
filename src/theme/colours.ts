// src/theme/colours.ts
export const Colours = {
  // Backgrounds
  background: {
    // Slightly deeper and cleaner than #0B0C0E
    app: "#07080A",

    // More visible than 0.06 so cards pop like your Replit UI
    card: "rgba(255,255,255,0.08)",

    // Strong card for tiles / emphasis
    cardStrong: "rgba(255,255,255,0.12)",
  },

  // Text
  text: {
    primary: "#FFFFFF",

    // Slightly clearer
    secondary: "rgba(255,255,255,0.82)",

    // Slightly dimmer for labels
    muted: "rgba(255,255,255,0.58)",

    danger: "#ff5a6b",
  },

  // UI
  ui: {
    // Borders slightly brighter so cards are more defined
    border: "rgba(255,255,255,0.12)",
    borderStrong: "rgba(255,255,255,0.16)",

    // Dividers should be subtle
    divider: "rgba(255,255,255,0.07)",
  },

  // Brand
  brand: {
    // Slightly more “electric” blue
    primary: "#2F8CFF",
    primary2: "#1A6BFF",
  },
} as const;
