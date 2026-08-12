import fs from "node:fs";
import path from "node:path";
import { calculateAggregateCoverage, findCoverageEntry } from "./coverage-metrics.mjs";

const OVERALL_THRESHOLDS = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90,
};

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

export function checkOverallCoverage(
  changedFiles,
  {
    coveragePath = path.resolve("coverage/coverage-final.json"),
    rootDirectory = process.cwd(),
    thresholds = OVERALL_THRESHOLDS,
  } = {},
) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  const entries = [];
  let failed = false;

  for (const changedFile of changedFiles) {
    const entry = findCoverageEntry(coverage, rootDirectory, changedFile);
    if (!entry) {
      console.error(`✗ ${changedFile}: coverage data was not found`);
      failed = true;
      continue;
    }
    entries.push(entry);
  }

  if (failed) {
    return 1;
  }

  const overallCoverage = calculateAggregateCoverage(entries);
  const failedMetrics = Object.entries(thresholds).filter(
    ([metric, threshold]) => overallCoverage[metric] < threshold,
  );
  const marker = failedMetrics.length === 0 ? "✓" : "✗";
  const details = Object.entries(overallCoverage)
    .map(([metric, value]) => `${metric} ${formatPercentage(value)}`)
    .join(", ");

  console.log(`Overall changed production coverage`);
  console.log(`${marker} ${details}`);
  for (const [metric, threshold] of failedMetrics) {
    console.error(
      `  ${metric} ${formatPercentage(overallCoverage[metric])} is below ${threshold}%`,
    );
  }

  return failedMetrics.length > 0 ? 1 : 0;
}
