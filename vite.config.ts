import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@mui/") || id.includes("node_modules/@emotion/")) {
            return "mui-vendor";
          }
          if (id.includes("node_modules/@clerk/")) {
            return "clerk-vendor";
          }
          if (id.includes("node_modules/convex/")) {
            return "convex-vendor";
          }
        },
      },
    },
  },
  server: {
    watch: {
      ignored: ["**/.agents/**"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // e2e/ は Playwright で実行するため Vitest から除外
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
