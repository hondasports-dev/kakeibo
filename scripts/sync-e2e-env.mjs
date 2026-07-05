#!/usr/bin/env node
/**
 * ローカル E2E 前の .env.local 同期 + Convex E2E_CLEANUP_SECRET 反映。
 *
 * 正本: docs/development-process.md「`.env.local` 同期」
 * CI では e2e.yml が同等の同期を行うため、CI=true のときは no-op。
 */

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(content) {
  const values = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return values;
}

function resolveCanonicalEnvPath() {
  if (process.env.KAKEIBO_E2E_ENV_CANONICAL) {
    return resolve(process.env.KAKEIBO_E2E_ENV_CANONICAL);
  }
  return resolve(repoRoot, "../kakeibo-worktrees/preview/.env.local");
}

function loadLocalEnv() {
  const envPath = resolve(repoRoot, ".env.local");
  if (!existsSync(envPath)) {
    return null;
  }
  return parseEnvFile(readFileSync(envPath, "utf8"));
}

async function verifyCleanupAuth(env) {
  const siteUrl = env.get("VITE_CONVEX_SITE_URL");
  const secret = env.get("E2E_CLEANUP_SECRET");

  if (!siteUrl || !secret) {
    console.warn(
      "[e2e:env-sync] cleanup 検証をスキップ（VITE_CONVEX_SITE_URL / E2E_CLEANUP_SECRET が不足）",
    );
    return;
  }

  const res = await fetch(`${siteUrl}/e2e/cleanup-auth-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-E2E-Cleanup-Secret": secret,
    },
  });

  if (res.ok) {
    console.log("[e2e:env-sync] E2E cleanup 認証 OK");
    return;
  }

  const text = await res.text();
  if (res.status === 401) {
    throw new Error(
      "E2E cleanup 認証失敗 (401)。.env.local の E2E_CLEANUP_SECRET と Convex deployment が不一致です。" +
        " pnpm run e2e:env-sync を再実行するか、正本 preview worktree の .env.local を更新してください。" +
        " エージェントが独自の secret で convex env set しないこと（GitHub DEV_E2E_CLEANUP_SECRET が正本）。",
    );
  }
  throw new Error(`E2E cleanup 検証失敗: ${res.status} ${text}`);
}

function syncConvexSecret(secret) {
  const result = spawnSync("pnpm", ["exec", "convex", "env", "set", "E2E_CLEANUP_SECRET", secret], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new Error(
      "convex env set E2E_CLEANUP_SECRET に失敗しました。" +
        " CONVEX_DEPLOYMENT / ログイン状態を確認してください。" +
        (stderr ? ` (${stderr.trim()})` : ""),
    );
  }
  console.log("[e2e:env-sync] Convex dev に E2E_CLEANUP_SECRET を反映しました");
}

async function main() {
  if (process.env.CI === "true" || process.env.CI === "1") {
    console.log("[e2e:env-sync] CI 環境のためスキップ（e2e.yml が同期担当）");
    return;
  }

  if (process.env.E2E_SKIP_ENV_SYNC === "1") {
    console.log("[e2e:env-sync] E2E_SKIP_ENV_SYNC=1 のためスキップ");
    return;
  }

  const canonicalPath = resolveCanonicalEnvPath();
  const targetPath = resolve(repoRoot, ".env.local");

  if (!existsSync(canonicalPath)) {
    throw new Error(
      `正本 .env.local が見つかりません: ${canonicalPath}\n` +
        "初回のみ: git fetch origin preview && git worktree add ../kakeibo-worktrees/preview preview\n" +
        "preview worktree に .env.local を配置してから再実行してください（docs/development-process.md 参照）。",
    );
  }

  copyFileSync(canonicalPath, targetPath);
  console.log(`[e2e:env-sync] .env.local を同期しました（正本: ${canonicalPath}）`);

  const env = loadLocalEnv();
  if (!env) {
    throw new Error(".env.local の読み込みに失敗しました");
  }

  const secret = env.get("E2E_CLEANUP_SECRET");
  if (!secret) {
    throw new Error(".env.local に E2E_CLEANUP_SECRET がありません");
  }

  syncConvexSecret(secret);
  await verifyCleanupAuth(env);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
