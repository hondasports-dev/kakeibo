import { httpAction } from "../_generated/server";

export function invalidJsonResponse() {
  return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireE2eSecret(req: Request, notEnabledMessage: string): Response | null {
  // Production では E2E HTTP エンドポイントを完全に無効化
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv === "production") {
    return new Response(JSON.stringify({ error: "E2E endpoints are disabled in production." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = process.env.E2E_CLEANUP_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: notEnabledMessage }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientSecret = req.headers.get("X-E2E-Cleanup-Secret");
  if (clientSecret !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

export function createE2eAuthCheckResponse(req: Request): Response {
  const authError = requireE2eSecret(
    req,
    "E2E cleanup authentication is not enabled in this environment.",
  );
  if (authError) {
    return authError;
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const e2eCleanupAuthCheckHandler = httpAction(async (_ctx, req) =>
  createE2eAuthCheckResponse(req),
);
