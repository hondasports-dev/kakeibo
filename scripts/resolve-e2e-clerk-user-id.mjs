import { appendFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;
const email = process.env.E2E_CLERK_USER_EMAIL?.trim();
const githubEnvPath = process.env.GITHUB_ENV;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!clerkSecretKey || !clerkPublishableKey || !email || !githubEnvPath) {
  fail("E2E Clerk user resolution requires Clerk keys, the test email, and GITHUB_ENV.");
}

function getIssuerFromPublishableKey(publishableKey) {
  const match = /^pk_(?:test|live)_([A-Za-z0-9_-]+)$/.exec(publishableKey);
  if (!match) {
    throw new Error("invalid Clerk publishable key format");
  }

  const encodedDomain = match[1].replace(/-/g, "+").replace(/_/g, "/");
  const paddedDomain = encodedDomain.padEnd(Math.ceil(encodedDomain.length / 4) * 4, "=");
  const domain = Buffer.from(paddedDomain, "base64")
    .toString("utf8")
    .replace(/\0/g, "")
    .replace(/\$$/, "");

  if (!/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(domain)) {
    throw new Error("Clerk publishable key does not contain a development instance domain");
  }

  return `https://${domain}`;
}

let issuer;
try {
  issuer = getIssuerFromPublishableKey(clerkPublishableKey);
} catch (error) {
  fail(error instanceof Error ? error.message : "failed to resolve Clerk issuer");
}

let users;
try {
  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  users = (await clerk.users.getUserList({ emailAddress: [email], limit: 2 })).data;
} catch {
  fail("Clerk Backend API user lookup failed");
}

users = Array.isArray(users) ? users : [];
if (
  users.length !== 1 ||
  typeof users[0]?.id !== "string" ||
  !/^user_[A-Za-z0-9_]+$/.test(users[0].id)
) {
  fail("the E2E email must resolve to exactly one Clerk user");
}

const tokenIdentifier = `${issuer}|${users[0].id}`;
appendFileSync(githubEnvPath, `E2E_CLERK_USER_ID=${tokenIdentifier}\n`, { encoding: "utf8" });
