// Design token values shared between CSS and JS (e.g. ECharts).
// Keep these values in sync with globals.css.

export const colors = {
  surface: "#0d1110",
  surfaceElevated: "#141918",
  surfaceSubtle: "#19201d",
  primary: "#2f7d6d",
  primaryHover: "#256b5e",
  primaryBorder: "rgba(47, 125, 109, 0.48)",
  accent: "#c89b3c",
  accentHover: "#d4ad4f",
  text: "#f3f6f2",
  textSecondary: "#b7c2ba",
  textMuted: "#77827a",
  border: "rgba(233, 238, 232, 0.12)",

  brand: {
    50: "#e8f5f1",
    100: "#cce8df",
    200: "#92cbbb",
    300: "#58ad98",
    400: "#328a77",
    500: "#2f7d6d",
    600: "#256b5e",
    700: "#1f574d",
    800: "#183f38",
  },

  accentScale: {
    50: "#fbf3df",
    100: "#f3e3bd",
    200: "#e2c77e",
    300: "#d4ad4f",
    400: "#c89b3c",
    500: "#a97924",
    600: "#865d17",
    700: "#684713",
    800: "#4d3510",
  },

  dangerScale: {
    50: "#fbebe8",
    100: "#f5d2ca",
    200: "#e99b8d",
    300: "#de7c68",
    400: "#d86a55",
    500: "#c94a3a",
    600: "#a7372d",
  },

  neutral: {
    0: "#ffffff",
    50: "#f7f8f5",
    100: "#eef1ec",
    200: "#dde3dc",
    300: "#c7d0c8",
    400: "#9ca79f",
    500: "#77827a",
    600: "#5c6861",
    700: "#3f4a44",
    800: "#242d29",
    900: "#161b18",
    950: "#0d1110",
  },

  chart: {
    school985: "#d86a55",
    school211: "#c89b3c",
    schoolDoubleFirst: "#58ad98",
    schoolNormal: "#8a938d",
    schoolMuted: "rgba(119, 130, 122, 0.2)",
    mapLow: "#202927",
    mapLowMid: "#2e4640",
    mapMid: "#49675d",
    mapHighMid: "#8e8b54",
    mapHigh: "#d1b150",
  },
} as const;
