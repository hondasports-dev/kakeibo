import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { checkChangedCoverage } from "./check-changed-coverage.mjs";
import { checkOverallCoverage } from "./check-overall-coverage.mjs";
import { runTestDependencyPreflight } from "./check-test-environment.mjs";

const rootDirectory = process.cwd();
const DEFAULT_BASE_REF = "origin/preview";
const SOURCE_FILE_PATTERN = /^(convex|lib|src)\/.+\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE_PATTERN = /\.test\.(?:[cm]?[jt]sx?)$/;

function normalizePath(filePath) {
  return filePath.trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: rootDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git差分を取得できませんでした: ${message}`);
  }
}

function isChangedProductionFile(filePath) {
  if (!SOURCE_FILE_PATTERN.test(filePath) || TEST_FILE_PATTERN.test(filePath)) {
    return false;
  }
  if (filePath.includes("/_generated/") || filePath.startsWith("src/test/")) {
    return false;
  }
  return fs.existsSync(path.resolve(rootDirectory, filePath));
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base") {
      options.base = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--base=")) {
      options.base = argument.slice("--base=".length);
    } else if (argument === "--files") {
      options.files = argv[index + 1]?.split(/[;,\r\n]+/).map(normalizePath);
      index += 1;
    } else if (argument.startsWith("--files=")) {
      options.files = argument
        .slice("--files=".length)
        .split(/[;,\r\n]+/)
        .map(normalizePath);
    }
  }
  return options;
}

function getChangedFiles(options) {
  const hasExplicitCliFiles = Object.hasOwn(options, "files");
  const hasExplicitEnvironmentFiles = process.env.COVERAGE_FILES !== undefined;
  if (hasExplicitCliFiles || hasExplicitEnvironmentFiles) {
    const explicitFiles = hasExplicitCliFiles
      ? (options.files ?? [])
      : process.env.COVERAGE_FILES.split(/[;,\r\n]+/).map(normalizePath);
    const normalizedFiles = [...new Set(explicitFiles)].filter(Boolean);
    const invalidFiles = normalizedFiles.filter((filePath) => !isChangedProductionFile(filePath));

    if (normalizedFiles.length === 0) {
      throw new Error("明示的なカバレッジ対象ファイルが空です。");
    }
    if (invalidFiles.length > 0) {
      throw new Error(
        `カバレッジ対象にできないファイルが指定されています: ${invalidFiles.join(", ")}`,
      );
    }

    return normalizedFiles;
  }

  const base =
    options.base ??
    process.env.COVERAGE_BASE ??
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : DEFAULT_BASE_REF);
  const baseFiles = base
    ? runGit(["diff", "--name-only", "--diff-filter=ACMRT", `${base}...HEAD`])
    : [];
  const workingFiles = [
    ...runGit(["diff", "--name-only", "--diff-filter=ACMRT"]),
    ...runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMRT"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ];
  const changedFiles = [...baseFiles, ...workingFiles];

  return [...new Set(changedFiles)].filter(isChangedProductionFile);
}

function runVitest(changedFiles, collectCoverage) {
  const maxWorkers = process.env.COVERAGE_MAX_WORKERS ?? "6";
  const vitestPath = path.resolve(rootDirectory, "node_modules/vitest/vitest.mjs");
  const args = [
    vitestPath,
    "run",
    ...(collectCoverage ? ["--coverage"] : []),
    `--maxWorkers=${maxWorkers}`,
  ];
  for (const changedFile of changedFiles) {
    args.push("--coverage.include", changedFile);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: rootDirectory,
    env: collectCoverage ? { ...process.env, VITEST_COVERAGE_COLLECTION_ONLY: "1" } : process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  return result.status ?? 1;
}

const options = parseOptions(process.argv.slice(2));
const preflightStatus = runTestDependencyPreflight({ coverage: true });
if (preflightStatus !== 0) {
  process.exit(preflightStatus);
}

let changedFiles;
try {
  changedFiles = getChangedFiles(options);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (changedFiles.length === 0) {
  console.log("変更された本番コードがないため、テストのみ実行します。");
  process.exit(runVitest([], false));
}

console.log(`Coverage scope (${changedFiles.length} files):`);
for (const changedFile of changedFiles) {
  console.log(`- ${changedFile}`);
}

const vitestStatus = runVitest(changedFiles, true);
if (vitestStatus !== 0) {
  process.exit(vitestStatus);
}

const changedCoverageStatus = checkChangedCoverage(changedFiles, { rootDirectory });
const overallCoverageStatus = checkOverallCoverage(changedFiles, { rootDirectory });
process.exitCode = Math.max(changedCoverageStatus, overallCoverageStatus);
