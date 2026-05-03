// Design token values shared between CSS and JS (e.g. ECharts)
// Keep in sync with globals.css

export const colors = {
  surface: "#10120f",
  surfaceElevated: "#171c18",
  primary: "#d8b75d",
  primaryHover: "#f1c15f",
  primaryLight: "#f2c45f",
  primaryBorder: "rgba(216, 183, 93, 0.55)",
  accentGreen: "#2c5f55",
  accentGreenLight: "#6fc0a5",
  text: "#fff9ec",
  textSecondary: "#bdb5a4",
  textMuted: "#81786a",
  border: "rgba(255, 249, 236, 0.1)",

  gold: {
    50: "#fff4d7",
    100: "#f5e4bb",
    200: "#e4c87c",
    300: "#d8b75d",
    400: "#f1c15f",
    500: "#f2c45f",
    600: "#ffe2a0",
    700: "#8a6414",
    800: "#7b5a19",
  },

  green: {
    50: "#dfeee8",
    100: "#b9f1df",
    200: "#80c9b4",
    300: "#6fc0a5",
    400: "#2c5f55",
    500: "#1a342f",
  },

  dark: {
    100: "#fff9ec",
    200: "#d8caa6",
    300: "#bdb5a4",
    400: "#b7afa0",
    500: "#9f9888",
    600: "#81786a",
    700: "#7f796b",
    800: "#746f63",
  },
} as const;
