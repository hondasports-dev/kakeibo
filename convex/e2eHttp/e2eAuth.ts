import { httpAction } from "../_generated/server";

const E2E_ALLOWED_APP_ENVS = new Set(["development", "preview"]);
const MAX_E2E_BODY_BYTES = 32_768;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function isE2eAppEnvironment() {
  return E2E_ALLOWED_APP_ENVS.has(process.env.APP_ENV ?? "");
}

export function getConfiguredE2eUserId() {
  const userId = process.env.E2E_CLERK_USER_ID?.trim().replace(/^['"]+|['"]+$/g, "");
  return userId || null;
}

export function invalidJsonResponse() {
  return jsonResponse({ error: "Invalid JSON body." }, 400);
}

export function requireE2eSecret(req: Request, notEnabledMessage: string): Response | null {
  // APP_ENV未設定・未知値・productionではfail-closedにする。
  if (!isE2eAppEnvironment()) {
    return jsonResponse({ error: "E2E endpoints are disabled in this environment." }, 503);
  }

  const secret = process.env.E2E_CLEANUP_SECRET;
  if (!secret) {
    return jsonResponse({ error: notEnabledMessage }, 503);
  }

  const clientSecret = req.headers.get("X-E2E-Cleanup-Secret");
  if (!clientSecret || !constantTimeStringEqual(clientSecret, secret)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  return null;
}

export function requireE2eUserId(requestedUserId: string | null | undefined): Response | null {
  const configuredUserId = getConfiguredE2eUserId();
  if (!configuredUserId) {
    return jsonResponse({ error: "E2E test user is not configured." }, 503);
  }
  if (requestedUserId !== configuredUserId) {
    return jsonResponse({ error: "Forbidden." }, 403);
  }
  return null;
}

export async function readE2eJsonObject<T extends Record<string, unknown>>(
  req: Request,
): Promise<T | Response> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_E2E_BODY_BYTES) {
    return jsonResponse({ error: "Payload Too Large." }, 413);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    if (req.body) {
      const reader = req.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_E2E_BODY_BYTES) {
          await reader.cancel();
          return jsonResponse({ error: "Payload Too Large." }, 413);
        }
        chunks.push(value);
      }
    }
  } catch {
    return invalidJsonResponse();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);

  try {
    const body: unknown = JSON.parse(text);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return invalidJsonResponse();
    }
    return body as T;
  } catch {
    return invalidJsonResponse();
  }
}

function constantTimeStringEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

export function createE2eAuthCheckResponse(req: Request): Response {
  const authError = requireE2eSecret(
    req,
    "E2E cleanup authentication is not enabled in this environment.",
  );
  if (authError) {
    return authError;
  }
  const userConfigurationError = requireE2eUserId(getConfiguredE2eUserId());
  if (userConfigurationError) {
    return userConfigurationError;
  }
  return jsonResponse({ ok: true }, 200);
}

export const e2eCleanupAuthCheckHandler = httpAction(async (_ctx, req) =>
  createE2eAuthCheckResponse(req),
);
