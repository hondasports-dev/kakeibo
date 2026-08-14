import { afterEach, describe, expect, it } from "vitest";
import { createE2eAuthCheckResponse, readE2eJsonObject, requireE2eUserId } from "./e2eAuth";

const originalEnvironment = {
  appEnv: process.env.APP_ENV,
  secret: process.env.E2E_CLEANUP_SECRET,
  userId: process.env.E2E_CLERK_USER_ID,
};

afterEach(() => {
  if (originalEnvironment.appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = originalEnvironment.appEnv;
  if (originalEnvironment.secret === undefined) delete process.env.E2E_CLEANUP_SECRET;
  else process.env.E2E_CLEANUP_SECRET = originalEnvironment.secret;
  if (originalEnvironment.userId === undefined) delete process.env.E2E_CLERK_USER_ID;
  else process.env.E2E_CLERK_USER_ID = originalEnvironment.userId;
});

function configureE2eEnvironment() {
  process.env.APP_ENV = "development";
  process.env.E2E_CLEANUP_SECRET = "test-secret";
  process.env.E2E_CLERK_USER_ID = "clerk|user_e2e";
}

function request(secret?: string, body?: string) {
  return new Request("https://example.test/e2e/cleanup-auth-check", {
    method: "POST",
    headers: secret ? { "X-E2E-Cleanup-Secret": secret } : undefined,
    body,
  });
}

describe("createE2eAuthCheckResponse", () => {
  it("正しいsecretとE2E環境設定ならデータ操作なしで200を返す", async () => {
    configureE2eEnvironment();

    const response = createE2eAuthCheckResponse(request("test-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("secretが不一致なら401を返す", () => {
    configureE2eEnvironment();

    expect(createE2eAuthCheckResponse(request("wrong-secret")).status).toBe(401);
  });

  it("環境側のsecretが未設定なら503を返す", () => {
    process.env.APP_ENV = "development";
    process.env.E2E_CLERK_USER_ID = "clerk|user_e2e";
    delete process.env.E2E_CLEANUP_SECRET;

    expect(createE2eAuthCheckResponse(request()).status).toBe(503);
  });

  it("productionや未定義のAPP_ENVではsecretがあっても503を返す", () => {
    process.env.E2E_CLEANUP_SECRET = "test-secret";
    process.env.E2E_CLERK_USER_ID = "clerk|user_e2e";

    for (const appEnv of [undefined, "preview", "production", "unknown"]) {
      if (appEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = appEnv;
      expect(createE2eAuthCheckResponse(request("test-secret")).status).toBe(503);
    }
  });

  it("E2Eテストユーザーが未設定なら503を返す", () => {
    process.env.APP_ENV = "development";
    process.env.E2E_CLEANUP_SECRET = "test-secret";
    delete process.env.E2E_CLERK_USER_ID;

    expect(createE2eAuthCheckResponse(request("test-secret")).status).toBe(503);
  });
});

describe("requireE2eUserId", () => {
  it("設定済みユーザー以外を403で拒否する", () => {
    process.env.E2E_CLERK_USER_ID = "clerk|user_e2e";

    const forbidden = requireE2eUserId("clerk|other");
    expect(forbidden).not.toBeNull();
    expect(forbidden?.status).toBe(403);
    expect(requireE2eUserId("clerk|user_e2e")).toBeNull();
  });
});

describe("readE2eJsonObject", () => {
  it("JSON配列や壊れたJSONを拒否する", async () => {
    const arrayResult = await readE2eJsonObject(
      new Request("https://example.test", {
        method: "POST",
        body: "[]",
      }),
    );
    const invalidResult = await readE2eJsonObject(
      new Request("https://example.test", {
        method: "POST",
        body: "{",
      }),
    );

    expect(arrayResult).toBeInstanceOf(Response);
    expect((arrayResult as Response).status).toBe(400);
    expect(invalidResult).toBeInstanceOf(Response);
    expect((invalidResult as Response).status).toBe(400);
  });

  it("本文サイズが上限を超えたら413を返す", async () => {
    const result = await readE2eJsonObject(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(33_000) }),
      }),
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
  });
});
