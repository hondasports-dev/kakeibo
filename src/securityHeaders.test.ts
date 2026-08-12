import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  headers?: Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
};

const vercelConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
) as VercelConfig;
const securityHeaders = new Map(
  vercelConfig.headers?.flatMap((entry) =>
    entry.headers.map((header) => [header.key, header.value]),
  ) ?? [],
);

describe("Vercel security headers", () => {
  it("全パスにブラウザ防御ヘッダーを適用する", () => {
    expect(vercelConfig.headers?.map((entry) => entry.source)).toContain("/(.*)");
    expect(securityHeaders.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(securityHeaders.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(securityHeaders.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(securityHeaders.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(securityHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(securityHeaders.get("X-Frame-Options")).toBe("DENY");
    expect(securityHeaders.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(securityHeaders.get("Permissions-Policy")).toContain("camera=()");
  });
});
