import { afterEach, describe, expect, it } from "vitest";
import { createE2eAuthCheckResponse } from "./e2eAuth";

const originalSecret = process.env.E2E_CLEANUP_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.E2E_CLEANUP_SECRET;
  } else {
    process.env.E2E_CLEANUP_SECRET = originalSecret;
  }
});

function request(secret?: string) {
  return new Request("https://example.test/e2e/cleanup-auth-check", {
    method: "POST",
    headers: secret ? { "X-E2E-Cleanup-Secret": secret } : undefined,
  });
}

describe("createE2eAuthCheckResponse", () => {
  it("正しいsecretならデータ操作なしで200を返す", async () => {
    process.env.E2E_CLEANUP_SECRET = "test-secret";

    const response = createE2eAuthCheckResponse(request("test-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("secretが不一致なら401を返す", () => {
    process.env.E2E_CLEANUP_SECRET = "test-secret";

    expect(createE2eAuthCheckResponse(request("wrong-secret")).status).toBe(401);
  });

  it("環境側のsecretが未設定なら503を返す", () => {
    delete process.env.E2E_CLEANUP_SECRET;

    expect(createE2eAuthCheckResponse(request()).status).toBe(503);
  });
});
