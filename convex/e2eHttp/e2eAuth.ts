export function invalidJsonResponse() {
  return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireE2eSecret(req: Request, notEnabledMessage: string): Response | null {
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
