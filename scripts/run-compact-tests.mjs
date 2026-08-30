#!/usr/bin/env node

import { closeSync, fsyncSync, mkdtempSync, openSync, writeSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compactLogPrefix = path.join(os.tmpdir(), "suzumemo-compact-tests-");

const paths = {
  dependencyPreflight: path.join(repoRoot, "scripts", "check-test-environment.mjs"),
  e2eEnvSync: path.join(repoRoot, "scripts", "sync-e2e-env.mjs"),
  playwright: path.join(repoRoot, "node_modules", "@playwright", "test", "cli.js"),
  vitest: path.join(repoRoot, "node_modules", "vitest", "vitest.mjs"),
};

function isMode(value) {
  return value === "vitest" || value === "e2e";
}

export function parseArguments(argv) {
  const [mode, ...forwardedArgs] = argv;

  if (mode === "--help" || mode === "-h") {
    return { help: true, mode: null, forwardedArgs: [] };
  }

  if (!isMode(mode)) {
    throw new Error("使い方: node scripts/run-compact-tests.mjs <vitest|e2e> [test options]");
  }

  return { help: false, mode, forwardedArgs };
}

export function isCiEnvironment(env = process.env) {
  return env?.CI === "1" || env?.CI === "true";
}

export function buildCommands(mode, forwardedArgs = [], { compact = true } = {}) {
  if (!isMode(mode)) {
    throw new Error(`未対応のテスト種別です: ${mode}`);
  }

  if (mode === "vitest") {
    return [
      {
        label: "dependency-preflight",
        command: process.execPath,
        args: [paths.dependencyPreflight],
      },
      {
        label: "vitest",
        command: process.execPath,
        args: [
          paths.vitest,
          "run",
          ...forwardedArgs,
          ...(compact ? ["--reporter=minimal"] : []),
          "--maxWorkers=4",
        ],
      },
    ];
  }

  return [
    {
      label: "e2e-env-sync",
      command: process.execPath,
      args: [paths.e2eEnvSync],
    },
    {
      label: "playwright",
      command: process.execPath,
      args: [
        paths.playwright,
        "test",
        ...forwardedArgs,
        ...(compact ? ["--reporter=dot", "--quiet", "--max-failures=1"] : []),
      ],
    },
  ];
}

export function formatSummary({ mode, status, logPath, phase, exitCode, signal }) {
  const fields = [`COMPACT_TEST status=${status}`, `mode=${mode}`, `log=${logPath}`];
  if (phase) fields.push(`phase=${phase}`);
  if (exitCode !== undefined) fields.push(`exit_code=${exitCode}`);
  if (signal) fields.push(`signal=${signal}`);
  return fields.join(" ");
}

function appendLogHeader(logFileDescriptor, label) {
  writeSync(logFileDescriptor, `\n===== ${label} =====\n`);
}

function runCommand(commandSpec, { logFileDescriptor, inheritOutput = false } = {}) {
  if (!inheritOutput) {
    appendLogHeader(logFileDescriptor, commandSpec.label);
  }

  return new Promise((resolve) => {
    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: repoRoot,
      env: process.env,
      stdio: inheritOutput ? "inherit" : ["ignore", logFileDescriptor, logFileDescriptor],
      windowsHide: true,
    });

    child.once("error", (error) => {
      if (inheritOutput) {
        console.error(error.message);
      } else {
        writeSync(logFileDescriptor, `\n[launcher error] ${error.message}\n`);
      }
      resolve({ exitCode: 1, signal: undefined });
    });
    child.once("exit", (exitCode, signal) => {
      resolve({ exitCode: exitCode ?? 1, signal: signal ?? undefined });
    });
  });
}

export async function runCompactTests({ mode, forwardedArgs = [], logPath } = {}) {
  const compact = !isCiEnvironment();
  const commands = buildCommands(mode, forwardedArgs, { compact });

  if (!compact) {
    for (const commandSpec of commands) {
      const result = await runCommand(commandSpec, { inheritOutput: true });
      if (result.exitCode !== 0) return result.exitCode;
    }
    return 0;
  }

  const resolvedLogPath =
    logPath ?? path.join(mkdtempSync(compactLogPrefix), `${mode ?? "unknown"}.log`);
  const logFileDescriptor = openSync(resolvedLogPath, "a");

  for (const commandSpec of commands) {
    const result = await runCommand(commandSpec, logFileDescriptor);
    if (result.exitCode !== 0) {
      fsyncSync(logFileDescriptor);
      closeSync(logFileDescriptor);
      console.log(
        formatSummary({
          mode,
          status: "FAIL",
          logPath: resolvedLogPath,
          phase: commandSpec.label,
          exitCode: result.exitCode,
          signal: result.signal,
        }),
      );
      return result.exitCode;
    }
  }

  fsyncSync(logFileDescriptor);
  closeSync(logFileDescriptor);
  console.log(formatSummary({ mode, status: "PASS", logPath: resolvedLogPath }));
  return 0;
}

function printHelp() {
  console.log("使い方: pnpm --silent run test:agent [vitest options]");
  console.log("        pnpm --silent run e2e:agent [playwright options]");
  console.log("成功時は要約のみを表示し、詳細ログはOSの一時ディレクトリへ保存します。");
  console.log("CI=true/1 ではcompact化せず、既存の標準出力・reporterをそのまま使います。");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath === modulePath) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exitCode = 0;
    } else {
      process.exitCode = await runCompactTests(options);
    }
  } catch (error) {
    console.error(
      `COMPACT_TEST status=FAIL reason=${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
