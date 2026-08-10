import type { UserIdentity } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeLineLinkHandler,
  exchangeAndVerifyLineCode,
  startLineLinkHandler,
  validateLineIdTokenClaims,
  type LineProviderClient,
} from "./actions";
import { sha256 } from "./actions";

function createActionCtx(
  identity: UserIdentity | null,
  mutations = vi.fn(),
  scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) },
) {
  return {
    auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
    runMutation: mutations,
    scheduler,
  } as unknown as ActionCtx;
}

const authenticatedIdentity: UserIdentity = {
  tokenIdentifier: "https://issuer.example|user-a",
  subject: "user-a",
  issuer: "https://issuer.example",
};

function setEnvironment(values: Record<string, string | undefined>) {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe("LINE OAuth action", () => {
  beforeEach(() => {
    delete process.env.LINE_INTEGRATION_MODE;
    delete process.env.LINE_LOGIN_CHANNEL_ID;
    delete process.env.LINE_LOGIN_CHANNEL_SECRET;
    delete process.env.LINE_LOGIN_REDIRECT_URI;
    process.env.APP_ENV = "development";
  });

  it("未認証の開始・callbackを拒否する", async () => {
    const ctx = createActionCtx(null);
    await expect(startLineLinkHandler(ctx)).rejects.toThrow("Not authenticated");
    await expect(completeLineLinkHandler(ctx, { state: "state", code: "mock" })).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("real設定不足時はrequestを作る前に開始を拒否する", async () => {
    const restore = setEnvironment({ LINE_INTEGRATION_MODE: "real" });
    const mutations = vi.fn();
    try {
      await expect(
        startLineLinkHandler(createActionCtx(authenticatedIdentity, mutations)),
      ).rejects.toThrow("LINE integration is unavailable");
      expect(mutations).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("mock開始は短命requestを作成し、期限後削除をscheduleする", async () => {
    const restore = setEnvironment({ LINE_INTEGRATION_MODE: "mock" });
    const mutations = vi
      .fn()
      .mockResolvedValueOnce({ expiredCount: 0 })
      .mockResolvedValueOnce("request-id");
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };
    try {
      await expect(
        startLineLinkHandler(createActionCtx(authenticatedIdentity, mutations, scheduler)),
      ).resolves.toMatchObject({
        authorizationUrl: expect.stringMatching(/^\/settings\/line\/callback\?/),
      });
      expect(mutations).toHaveBeenCalledTimes(2);
      expect(scheduler.runAfter).toHaveBeenCalledWith(10 * 60 * 1000 + 1_000, expect.anything(), {
        requestId: "request-id",
      });
    } finally {
      restore();
    }
  });

  it("real開始はstate・nonce・PKCEをrequestと認可URLへ一貫して保存する", async () => {
    const restore = setEnvironment({
      LINE_INTEGRATION_MODE: "real",
      LINE_LOGIN_CHANNEL_ID: "channel-id",
      LINE_LOGIN_CHANNEL_SECRET: "private-secret",
      LINE_LOGIN_REDIRECT_URI: "https://example.test/settings/line/callback",
    });
    const mutations = vi
      .fn()
      .mockResolvedValueOnce({ expiredCount: 0 })
      .mockResolvedValueOnce("request-id");
    try {
      const { authorizationUrl } = await startLineLinkHandler(
        createActionCtx(authenticatedIdentity, mutations),
      );
      const requestArgs = mutations.mock.calls[1]?.[1] as {
        stateHash: string;
        nonceHash: string;
        codeVerifier: string;
      };
      const authorization = new URL(authorizationUrl);
      const state = authorization.searchParams.get("state");
      const nonce = authorization.searchParams.get("nonce");

      expect(authorization.searchParams.get("scope")).toBe("openid");
      expect(state).toBeTruthy();
      expect(nonce).toBeTruthy();
      expect(sha256(state ?? "")).toBe(requestArgs.stateHash);
      expect(sha256(nonce ?? "")).toBe(requestArgs.nonceHash);
      expect(authorization.searchParams.get("code_challenge")).toBe(
        sha256(requestArgs.codeVerifier),
      );
      expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    } finally {
      restore();
    }
  });

  it("公式token endpointとverify endpointを通してPKCEとclaimsを検証する", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", id_token: "id-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "line-user-private",
            nonce: "nonce",
            aud: "channel-id",
            iss: "https://access.line.me",
            exp: 4_000_000_000,
          }),
          { status: 200 },
        ),
      );

    await expect(
      exchangeAndVerifyLineCode(
        {
          code: "authorization-code",
          codeVerifier: "private-verifier",
          expectedNonceHash: sha256("nonce"),
          channelId: "channel-id",
          channelSecret: "private-secret",
          redirectUri: "https://example.test/settings/line/callback",
        },
        fetchImpl,
      ),
    ).resolves.toEqual({ lineUserId: "line-user-private", nonceHash: sha256("nonce") });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.line.me/oauth2/v2.1/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.line.me/oauth2/v2.1/verify",
      expect.objectContaining({ method: "POST" }),
    );
    const tokenRequest = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const verifyRequest = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    const tokenBody = tokenRequest.body as URLSearchParams;
    const verifyBody = verifyRequest.body as URLSearchParams;
    expect(tokenBody.get("code")).toBe("authorization-code");
    expect(tokenBody.get("code_verifier")).toBe("private-verifier");
    expect(tokenBody.get("client_id")).toBe("channel-id");
    expect(tokenBody.get("redirect_uri")).toBe("https://example.test/settings/line/callback");
    expect(verifyBody.get("id_token")).toBe("id-token");
    expect(verifyBody.get("client_id")).toBe("channel-id");
  });

  it.each([
    ["token endpointのHTTPエラー", [new Response("bad", { status: 400 })]],
    [
      "token responseにid_tokenがない",
      [new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 })],
    ],
    [
      "verify endpointのHTTPエラー",
      [
        new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 }),
        new Response("bad", { status: 400 }),
      ],
    ],
  ])("%s場合はcallbackを拒否する", async (_label, responses) => {
    const fetchImpl = vi.fn();
    for (const response of responses) fetchImpl.mockResolvedValueOnce(response);

    await expect(
      exchangeAndVerifyLineCode(
        {
          code: "authorization-code",
          codeVerifier: "private-verifier",
          expectedNonceHash: sha256("nonce"),
          channelId: "channel-id",
          channelSecret: "private-secret",
          redirectUri: "https://example.test/settings/line/callback",
        },
        fetchImpl,
      ),
    ).rejects.toThrow();
  });

  it("real provider失敗は公開failedコードに変換し、requestをscrubする内部mutationを呼ぶ", async () => {
    const restore = setEnvironment({
      LINE_INTEGRATION_MODE: "real",
      LINE_LOGIN_CHANNEL_ID: "channel-id",
      LINE_LOGIN_CHANNEL_SECRET: "private-secret",
      LINE_LOGIN_REDIRECT_URI: "https://example.test/settings/line/callback",
    });
    const mutations = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        requestId: "request-id",
        nonceHash: sha256("nonce"),
        codeVerifier: "private-verifier",
      })
      .mockResolvedValueOnce(null);
    const provider: LineProviderClient = {
      exchangeAndVerify: vi.fn().mockRejectedValue(new Error("network unavailable")),
    };
    try {
      await expect(
        completeLineLinkHandler(
          createActionCtx(authenticatedIdentity, mutations),
          { state: "state", code: "code" },
          provider,
        ),
      ).resolves.toEqual({ result: "failure", code: "failed" });
      expect(provider.exchangeAndVerify).toHaveBeenCalledWith(
        expect.objectContaining({ codeVerifier: "private-verifier" }),
      );
      expect(mutations).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  });

  it("不正なID token claimsではlinkを作らず、requestの秘密情報をscrubする", async () => {
    const restore = setEnvironment({
      LINE_INTEGRATION_MODE: "real",
      LINE_LOGIN_CHANNEL_ID: "channel-id",
      LINE_LOGIN_CHANNEL_SECRET: "private-secret",
      LINE_LOGIN_REDIRECT_URI: "https://example.test/settings/line/callback",
    });
    const mutations = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        requestId: "request-id",
        nonceHash: sha256("nonce"),
        codeVerifier: "private-verifier",
      })
      .mockResolvedValueOnce(null);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id_token: "id-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: "line-user-private",
            nonce: "wrong",
            aud: "channel-id",
            iss: "https://access.line.me",
            exp: 4_000_000_000,
          }),
          { status: 200 },
        ),
      );
    const provider: LineProviderClient = {
      exchangeAndVerify: (input) => exchangeAndVerifyLineCode(input, fetchImpl),
    };

    try {
      await expect(
        completeLineLinkHandler(
          createActionCtx(authenticatedIdentity, mutations),
          { state: "state", code: "code" },
          provider,
        ),
      ).resolves.toEqual({ result: "failure", code: "invalid" });
      expect(mutations).toHaveBeenCalledTimes(2);
      const failedRequestArgs = mutations.mock.calls[1]?.[1] as { reasonCode?: string } | undefined;
      expect(failedRequestArgs?.reasonCode).toBe("INVALID_NONCE");
    } finally {
      restore();
    }
  });

  it("nonce・audience・issuer・expiryが不正なID token claimsを拒否する", () => {
    const base = {
      sub: "line-user-private",
      nonce: "nonce",
      aud: "channel-id",
      iss: "https://access.line.me",
      exp: 4_000_000_000,
    };
    expect(validateLineIdTokenClaims(base, sha256("nonce"), "channel-id")).toMatchObject({
      lineUserId: "line-user-private",
    });
    expect(() =>
      validateLineIdTokenClaims({ ...base, nonce: "wrong" }, sha256("nonce"), "channel-id"),
    ).toThrow();
    expect(() =>
      validateLineIdTokenClaims({ ...base, aud: "other" }, sha256("nonce"), "channel-id"),
    ).toThrow();
    expect(() =>
      validateLineIdTokenClaims(
        { ...base, iss: "https://other.example" },
        sha256("nonce"),
        "channel-id",
      ),
    ).toThrow();
    expect(() =>
      validateLineIdTokenClaims({ ...base, exp: 1 }, sha256("nonce"), "channel-id"),
    ).toThrow();
    expect(() =>
      validateLineIdTokenClaims(
        { ...base, nonce: undefined } as unknown as Parameters<typeof validateLineIdTokenClaims>[0],
        sha256("nonce"),
        "channel-id",
      ),
    ).toThrow();
  });
});
