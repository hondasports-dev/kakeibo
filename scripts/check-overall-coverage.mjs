import fs from "node:fs";
import path from "node:path";
import { calculateAggregateCoverage } from "./coverage-metrics.mjs";

// The changed-file gate remains intentionally strict. The full-repository gate
// is a non-regression floor captured from origin/preview at c5053c8; raising
// the floor belongs in a separate coverage-improvement change rather than
// making every unrelated PR responsible for the existing backlog.
const OVERALL_BASELINE_THRESHOLDS = {
  statements: 82.52,
  branches: 75.32,
  functions: 81.72,
  lines: 83.27,
};

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

export function checkOverallCoverage({
  coveragePath = path.resolve("coverage/overall/coverage-final.json"),
  thresholds = OVERALL_BASELINE_THRESHOLDS,
} = {}) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  const entries = Object.values(coverage);
  if (entries.length === 0) {
    console.error("✗ Overall production coverage data was not found");
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

  console.log(`Overall production coverage (baseline gate)`);
  console.log(`${marker} ${details}`);
  for (const [metric, threshold] of failedMetrics) {
    console.error(
      `  ${metric} ${formatPercentage(overallCoverage[metric])} is below baseline ${threshold}%`,
    );
  }

  return failedMetrics.length > 0 ? 1 : 0;
}
