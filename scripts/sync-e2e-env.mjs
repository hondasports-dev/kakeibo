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

function listWorktrees() {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new Error(
      "git worktree list の取得に失敗しました。" + (stderr ? ` (${stderr.trim()})` : ""),
    );
  }

  return result.stdout
    .trim()
    .split(/\r?\n\r?\n/)
    .map((block) => {
      let path = null;
      let branch = null;
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
        if (line.startsWith("branch ")) branch = line.slice("branch ".length);
      }
      return path ? { path: resolve(path), branch } : null;
    })
    .filter(Boolean);
}

function resolveCanonicalEnvPath(worktrees) {
  if (process.env.KAKEIBO_E2E_ENV_CANONICAL) {
    return resolve(process.env.KAKEIBO_E2E_ENV_CANONICAL);
  }

  const previewWorktree = worktrees.find(({ branch }) => branch === "refs/heads/preview");
  if (!previewWorktree) {
    throw new Error(
      "preview worktree が見つかりません。\n" +
        "初回のみ、元の clone で `git fetch origin preview && git worktree add ../kakeibo-worktrees/preview preview` を実行してください。\n" +
        "ローカル E2E を未実行のまま先へ進めず、preview worktree を用意してから再実行してください。",
    );
  }

  return resolve(previewWorktree.path, ".env.local");
}

function ensureCanonicalEnv(canonicalPath, worktrees) {
  if (existsSync(canonicalPath)) {
    return;
  }

  if (process.env.KAKEIBO_E2E_ENV_CANONICAL) {
    throw new Error(
      `指定された正本 .env.local が見つかりません: ${canonicalPath}\n` +
        "KAKEIBO_E2E_ENV_CANONICAL のパスを修正し、.env.local を復旧してから再実行してください。",
    );
  }

  const canonicalWorktree = resolve(dirname(canonicalPath));
  const bootstrapWorktree = worktrees.find(({ path }) => {
    const worktreePath = resolve(path);
    return worktreePath !== canonicalWorktree && existsSync(resolve(worktreePath, ".env.local"));
  });

  if (!bootstrapWorktree) {
    throw new Error(
      `preview worktree の正本 .env.local が見つかりません: ${canonicalPath}\n` +
        "別の登録済み worktree にも .env.local がありません。元の clone に .env.local を配置するか、" +
        "preview worktree へ手動でコピーしてから再実行してください。\n" +
        "環境不足を理由に E2E を省略して push / PR へ進めないでください。",
    );
  }

  const bootstrapPath = resolve(bootstrapWorktree.path, ".env.local");
  copyFileSync(bootstrapPath, canonicalPath);
  console.log(`[e2e:env-sync] preview 正本 .env.local を bootstrap しました（元: ${bootstrapPath}）`);
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
    throw new Error(
      ".env.local に VITE_CONVEX_SITE_URL / E2E_CLEANUP_SECRET が不足しています。" +
        " 正本 .env.local を復旧して pnpm run e2e:env-sync を再実行してください。",
    );
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
        " CONVEX_DEPLOYMENT / ログイン状態を確認して再実行してください。" +
        " この失敗を理由に E2E を省略しないでください。" +
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

  const worktrees = listWorktrees();
  const canonicalPath = resolveCanonicalEnvPath(worktrees);
  const targetPath = resolve(repoRoot, ".env.local");

  ensureCanonicalEnv(canonicalPath, worktrees);

  if (resolve(canonicalPath) !== targetPath) {
    copyFileSync(canonicalPath, targetPath);
    console.log(`[e2e:env-sync] .env.local を同期しました（正本: ${canonicalPath}）`);
  } else {
    console.log(`[e2e:env-sync] 現在の .env.local を正本として使用します（${canonicalPath}）`);
  }

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
