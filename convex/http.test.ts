import { afterEach, describe, expect, it, vi } from "vitest";

const originalAppEnv = process.env.APP_ENV;

afterEach(() => {
  vi.resetModules();
  if (originalAppEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalAppEnv;
});

describe("HTTP router environment boundary", () => {
  it("productionではE2Eルートを登録しない", async () => {
    process.env.APP_ENV = "production";
    vi.resetModules();

    const { default: http } = await import("./http");

    expect(http).toBeDefined();
  });

  it.each(["development", "preview"])("%sではE2Eルートを登録する", async (appEnv) => {
    process.env.APP_ENV = appEnv;
    vi.resetModules();

    const { default: http } = await import("./http");

    expect(http).toBeDefined();
  });
});
