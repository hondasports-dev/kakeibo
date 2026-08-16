#!/usr/bin/env node
/**
 * CI が人間の LINE_INTEGRATION_MODE=real を mock で上書きしない。
 * unset / 不正値のときだけ mock を入れる。
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODE_NAME = "LINE_INTEGRATION_MODE";
const VALID_MODES = new Set(["mock", "real"]);

export function parseConvexEnvGetResult({ status, stdout }) {
  const value = String(stdout ?? "").trim();

  if (status === 0) {
    if (VALID_MODES.has(value)) {
      return { kind: "found", value };
    }
    if (value.length === 0) {
      return { kind: "missing" };
    }
    return { kind: "invalid" };
  }

  return { kind: "error" };
}

export function decideLineIntegrationMode(current) {
  if (current.kind === "error") {
    return { action: "abort" };
  }
  if (current.kind === "found") {
    return { action: "keep", mode: current.value };
  }
  return { action: "set", mode: "mock" };
}

export function ensureLineIntegrationMode({ runConvexEnv, log = console.log } = {}) {
  if (typeof runConvexEnv !== "function") {
    throw new Error("runConvexEnv is required");
  }

  const current = parseConvexEnvGetResult(runConvexEnv(["env", "get", MODE_NAME]));
  const decision = decideLineIntegrationMode(current);

  if (decision.action === "abort") {
    throw new Error(`Failed to read ${MODE_NAME} from Convex.`);
  }

  if (decision.action === "keep") {
    log(`${MODE_NAME} already set to ${decision.mode}; leaving unchanged.`);
    return decision;
  }

  const setResult = runConvexEnv(["env", "set", MODE_NAME, "mock"]);
  if ((setResult.status ?? 1) !== 0) {
    throw new Error(`Failed to set ${MODE_NAME}=mock.`);
  }

  log(`${MODE_NAME} was unset or invalid; set to mock.`);
  return decision;
}

export function runConvexEnv(args) {
  const result = spawnSync("pnpm", ["exec", "convex", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    shell: process.platform === "win32",
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function main() {
  ensureLineIntegrationMode({ runConvexEnv, log: console.log });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath === modulePath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
