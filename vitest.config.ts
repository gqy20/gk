import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["web/src/**/*.test.{ts,tsx}"],
    css: false,
    deps: {
      inline: ["react", "react-dom", "@testing-library/react"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./web/src"),
    },
  },
});
