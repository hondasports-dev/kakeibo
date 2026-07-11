import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 120000,
    // 統合テストは Node 環境で実行し、setup.ts は不要
    setupFiles: [],
  },
});
