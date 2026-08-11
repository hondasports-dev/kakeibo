import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "./signature";

async function createSignature(rawBody: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "HMAC" },
    key,
    new TextEncoder().encode(rawBody),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

describe("verifyLineSignature", () => {
  it("JSON parse前のraw bodyに対するHMAC-SHA256を検証する", async () => {
    const rawBody = '{"events":[{"type":"follow"}]}';
    const signature = await createSignature(rawBody, "channel-secret");

    await expect(verifyLineSignature(rawBody, signature, "channel-secret")).resolves.toBe(true);
    await expect(verifyLineSignature(`${rawBody} `, signature, "channel-secret")).resolves.toBe(
      false,
    );
    await expect(verifyLineSignature(rawBody, signature, "wrong-secret")).resolves.toBe(false);
  });

  it("署名欠落・不正base64・長さ不正を拒否する", async () => {
    await expect(verifyLineSignature("{}", "", "secret")).resolves.toBe(false);
    await expect(verifyLineSignature("{}", "not-base64", "secret")).resolves.toBe(false);
    await expect(verifyLineSignature("{}", "AAAA", "secret")).resolves.toBe(false);
  });
});
