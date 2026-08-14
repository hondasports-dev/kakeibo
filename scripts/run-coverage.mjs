import { spawnSync } from "node:child_process";
import path from "node:path";
import { runTestDependencyPreflight } from "./check-test-environment.mjs";

const rootDirectory = process.cwd();
function runVitest(coverageDirectory) {
  const maxWorkers = process.env.COVERAGE_MAX_WORKERS ?? "4";
  const vitestPath = path.resolve(rootDirectory, "node_modules/vitest/vitest.mjs");
  const args = [
    vitestPath,
    "run",
    "--coverage",
    `--maxWorkers=${maxWorkers}`,
    "--coverage.reportsDirectory",
    coverageDirectory,
  ];

  const result = spawnSync(process.execPath, args, {
    cwd: rootDirectory,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error);
    return 1;
  }
  return result.status ?? 1;
}

const preflightStatus = runTestDependencyPreflight({ coverage: true });
if (preflightStatus !== 0) {
  process.exit(preflightStatus);
}

const coverageDirectory = path.resolve(rootDirectory, "coverage/overall");
console.log(
  "Running the full test suite with coverage; coverage thresholds are informational only.",
);
process.exitCode = runVitest(coverageDirectory);
