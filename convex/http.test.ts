import { afterEach, describe, expect, it, vi } from "vitest";

const originalAppEnv = process.env.APP_ENV;

afterEach(() => {
  vi.doUnmock("convex/server");
  vi.resetModules();
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
});

async function loadRegisteredPaths(appEnv: string | undefined) {
  if (appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnv;

  const registeredPaths: string[] = [];
  vi.doMock("convex/server", async () => {
    const actual = await vi.importActual<typeof import("convex/server")>("convex/server");
    return {
      ...actual,
      httpRouter: () => ({
        route: (definition: { path: string }) => {
          registeredPaths.push(definition.path);
        },
      }),
    };
  });

  const { default: http } = await import("./http");
  expect(http).toBeDefined();
  return registeredPaths;
}

describe("HTTP router environment boundary", () => {
  it.each([undefined, "production", "preview", "unknown"])(
    "%sではE2Eルートを登録しない",
    async (appEnv) => {
      const paths = await loadRegisteredPaths(appEnv);

      expect(paths).toEqual(["/webhooks/resend", "/webhooks/line"]);
    },
  );

  it("developmentではE2EルートとWebhookルートを登録する", async () => {
    const paths = await loadRegisteredPaths("development");

    expect(paths).toEqual(
      expect.arrayContaining([
        "/e2e/cleanup-auth-check",
        "/e2e/cleanup",
        "/e2e/seed-ai-expense-draft",
        "/e2e/seed-pending-group-invitation",
        "/webhooks/resend",
        "/webhooks/line",
      ]),
    );
    expect(paths).toHaveLength(12);
  });
});
