import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workflow = () => readFileSync(".github/workflows/production-release.yml", "utf8");

describe("production-release workflow", () => {
  test("requires manual dispatch for an approved source ref", () => {
    const yaml = workflow();

    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("source_ref:");
    expect(yaml).toContain("preview_confirmed:");
    expect(yaml).toContain("db_schema_change_check:");
    expect(yaml).toContain("main|release/*");
    expect(yaml).toContain("vars.VITE_CLERK_PUBLISHABLE_KEY");
  });

  test("guards production deployment with the GitHub production environment", () => {
    const yaml = workflow();

    expect(yaml).toContain("environment: production");
    expect(yaml).toContain("concurrency:");
    expect(yaml).toContain("group: production-release");
    expect(yaml).toContain("cancel-in-progress: false");
  });

  test("deploys Convex production before Vercel production and records smoke results", () => {
    const yaml = workflow();
    const convexIndex = yaml.indexOf("Deploy Convex Production");
    const vercelIndex = yaml.indexOf("Deploy Vercel Production");
    const smokeIndex = yaml.indexOf("PROD smoke checklist");
    const summaryIndex = yaml.indexOf("Write release summary");

    expect(convexIndex).toBeGreaterThan(-1);
    expect(vercelIndex).toBeGreaterThan(convexIndex);
    expect(smokeIndex).toBeGreaterThan(vercelIndex);
    expect(summaryIndex).toBeGreaterThan(smokeIndex);
  });
});
