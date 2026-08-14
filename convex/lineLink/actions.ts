"use node";

import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAuthenticatedUserId } from "../users/auth";
import {
  getLineIntegrationMode,
  getLineLinkFeedback,
  lineLinkFeedbackValidator,
  type LineLinkFeedback,
} from "./model";

const REQUEST_TTL_MS = 10 * 60 * 1000;
const LINE_TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";
const LINE_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";
const LINE_ISSUER = "https://access.line.me";
const PROVIDER_TIMEOUT_MS = 10_000;

type LineIdTokenClaims = {
  sub: string;
  nonce: string;
  aud: string | string[];
  iss: string;
  exp: number;
};

type LineProviderInput = {
  code: string;
  codeVerifier: string;
  expectedNonceHash: string;
  channelId: string;
  channelSecret: string;
  redirectUri: string;
};

export type LineProviderClient = {
  exchangeAndVerify(input: LineProviderInput): Promise<{ lineUserId: string; nonceHash: string }>;
};

class LineProviderError extends Error {
  readonly reasonCode: string;

  constructor(reasonCode: string) {
    super(reasonCode);
    this.reasonCode = reasonCode;
  }
}

function randomUrlSafeValue() {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function mockLineUserId(userId: string) {
  return `mock-${sha256(userId)}`;
}

function requireRealConfiguration() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI;
  if (!channelId || !channelSecret || !redirectUri) {
    throw new ConvexError("LINE integration is unavailable");
  }
  return { channelId, channelSecret, redirectUri };
}

export function validateLineIdTokenClaims(
  claims: LineIdTokenClaims,
  expectedNonceHash: string,
  channelId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const validAudienceShape =
    typeof claims?.aud === "string" ||
    (Array.isArray(claims?.aud) && claims.aud.every((audience) => typeof audience === "string"));
  if (
    !claims ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.nonce !== "string" ||
    !validAudienceShape ||
    typeof claims.iss !== "string" ||
    typeof claims.exp !== "number"
  ) {
    throw new LineProviderError("INVALID_CALLBACK");
  }
  if (sha256(claims.nonce) !== expectedNonceHash) throw new LineProviderError("INVALID_NONCE");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(channelId)) throw new LineProviderError("INVALID_AUDIENCE");
  if (claims.iss !== LINE_ISSUER) throw new LineProviderError("INVALID_ISSUER");
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) {
    throw new LineProviderError("INVALID_EXPIRY");
  }
  return { lineUserId: claims.sub, nonceHash: sha256(claims.nonce) };
}

export async function exchangeAndVerifyLineCode(
  input: LineProviderInput,
  fetchImpl: typeof fetch = fetch,
) {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetchImpl(LINE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: input.channelId,
        client_secret: input.channelSecret,
        code_verifier: input.codeVerifier,
      }),
    });
  } catch {
    throw new LineProviderError("PROVIDER_UNAVAILABLE");
  }
  if (!tokenResponse.ok) throw new LineProviderError("INVALID_CALLBACK");
  let tokenBody: { id_token?: unknown };
  try {
    tokenBody = (await tokenResponse.json()) as { id_token?: unknown };
  } catch {
    throw new LineProviderError("INVALID_CALLBACK");
  }
  if (typeof tokenBody.id_token !== "string") throw new LineProviderError("INVALID_CALLBACK");

  let verifyResponse: Response;
  try {
    verifyResponse = await fetchImpl(LINE_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: new URLSearchParams({ id_token: tokenBody.id_token, client_id: input.channelId }),
    });
  } catch {
    throw new LineProviderError("PROVIDER_UNAVAILABLE");
  }
  if (!verifyResponse.ok) throw new LineProviderError("INVALID_CALLBACK");
  let claims: LineIdTokenClaims;
  try {
    claims = (await verifyResponse.json()) as LineIdTokenClaims;
  } catch {
    throw new LineProviderError("INVALID_CALLBACK");
  }
  return validateLineIdTokenClaims(claims, input.expectedNonceHash, input.channelId);
}

const lineProviderClient: LineProviderClient = { exchangeAndVerify: exchangeAndVerifyLineCode };

export async function startLineLinkHandler(ctx: ActionCtx): Promise<{ authorizationUrl: string }> {
  const userId = await requireAuthenticatedUserId(ctx);
  let mode: "mock" | "real";
  try {
    mode = getLineIntegrationMode();
  } catch {
    throw new ConvexError("LINE integration is unavailable");
  }
  const realConfiguration = mode === "real" ? requireRealConfiguration() : undefined;

  await ctx.runMutation(internal.lineLink.internal.expireRequests, { now: Date.now(), limit: 50 });
  const state = randomUrlSafeValue();
  const nonce = randomUrlSafeValue();
  const codeVerifier = randomUrlSafeValue();
  const codeChallenge = sha256(codeVerifier);
  const requestId = await ctx.runMutation(internal.lineLink.internal.createRequest, {
    userId,
    stateHash: sha256(state),
    nonceHash: sha256(nonce),
    codeVerifier,
    expiresAt: Date.now() + REQUEST_TTL_MS,
  });
  await ctx.scheduler.runAfter(REQUEST_TTL_MS + 1_000, internal.lineLink.internal.expireRequest, {
    requestId,
  });

  if (mode === "mock") {
    return {
      authorizationUrl: `/settings/line/callback?state=${encodeURIComponent(state)}&code=mock`,
    };
  }
  if (!realConfiguration) throw new ConvexError("LINE integration is unavailable");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: realConfiguration.channelId,
    redirect_uri: realConfiguration.redirectUri,
    scope: "openid",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { authorizationUrl: `https://access.line.me/oauth2/v2.1/authorize?${params}` };
}

export const start = action({
  args: {},
  returns: v.object({ authorizationUrl: v.string() }),
  handler: startLineLinkHandler,
});

export async function completeLineLinkHandler(
  ctx: ActionCtx,
  args: { state: string; code: string },
  provider: LineProviderClient = lineProviderClient,
): Promise<LineLinkFeedback> {
  const userId = await requireAuthenticatedUserId(ctx);
  if (!args.state || !args.code || args.state.length > 512 || args.code.length > 2048) {
    return getLineLinkFeedback("INVALID_CALLBACK");
  }

  const claim = await ctx.runMutation(internal.lineLink.internal.claimRequest, {
    stateHash: sha256(args.state),
    userId,
  });
  if (!claim.ok) return getLineLinkFeedback(claim.reason);

  try {
    const mode = getLineIntegrationMode();
    let identity: { lineUserId: string; nonceHash: string };
    if (mode === "mock") {
      if (args.code !== "mock") throw new LineProviderError("INVALID_CALLBACK");
      identity = { lineUserId: mockLineUserId(userId), nonceHash: claim.nonceHash };
    } else {
      identity = await provider.exchangeAndVerify({
        code: args.code,
        codeVerifier: claim.codeVerifier,
        expectedNonceHash: claim.nonceHash,
        ...requireRealConfiguration(),
      });
    }
    const result = await ctx.runMutation(internal.lineLink.internal.finalizeRequest, {
      requestId: claim.requestId,
      userId,
      lineUserId: identity.lineUserId,
      nonceHash: identity.nonceHash,
    });
    return getLineLinkFeedback(result.ok ? "SUCCESS" : result.reason);
  } catch (error) {
    const reasonCode = error instanceof LineProviderError ? error.reasonCode : "FAILED";
    await ctx.runMutation(internal.lineLink.internal.recordFailedRequest, {
      requestId: claim.requestId,
      userId,
      reasonCode,
    });
    return getLineLinkFeedback(reasonCode);
  }
}

export const complete = action({
  args: { state: v.string(), code: v.string() },
  returns: lineLinkFeedbackValidator,
  handler: completeLineLinkHandler,
});
