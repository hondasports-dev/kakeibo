import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const readPackageJson = () =>
  JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

const readDocument = (path: string) => readFileSync(path, "utf8");

describe("local Convex development workflow", () => {
  test("selects the local deployment before starting the default Convex watcher", () => {
    const { scripts } = readPackageJson();

    expect(scripts["convex:dev"]).toBe("convex deployment select local && convex dev");
  });

  test("requires an explicit command to start the cloud development deployment", () => {
    const { scripts } = readPackageJson();

    expect(scripts["convex:dev:cloud"]).toBe("convex deployment select dev && convex dev");
  });

  test("documents the roles of local, mocked, and cloud Convex environments", () => {
    const readme = readDocument("README.md");
    const environmentVariables = readDocument("docs/environment-variables.md");
    const serviceTooling = readDocument("docs/service-tooling-setup.md");

    expect(readme).toContain("`convex-test`");
    expect(readme).toContain("pnpm run convex:dev:cloud");
    expect(readme).toContain("Webhook");
    expect(environmentVariables).toContain("| Local                  | local deployment");
    expect(serviceTooling).toContain(
      "| local dev  | local `.env.local`                   | Development instance `pk_test_*` | local deployment",
    );
  });
});
