import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workflow = () => readFileSync(".github/workflows/e2e.yml", "utf8");

describe("e2e workflow", () => {
  test("runs pull request smoke tests against the local Vite server", () => {
    const yaml = workflow();

    expect(yaml).toContain("Configure local Vite E2E");
    expect(yaml).toContain("VITE_CONVEX_URL: ${{ secrets.VITE_CONVEX_URL }}");
    expect(yaml).toContain("VITE_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}");
    expect(yaml).toContain("pnpm exec convex env set LINE_INTEGRATION_MODE mock");
    expect(yaml).not.toContain("E2E_BASE_URL: ${{ github.event.deployment_status.target_url }}");
    expect(yaml).not.toContain("PLAYWRIGHT_BYPASS_SECRET:");
  });
});
