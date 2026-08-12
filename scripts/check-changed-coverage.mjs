import fs from "node:fs";
import path from "node:path";
import { calculateFileCoverage, findCoverageEntry } from "./coverage-metrics.mjs";

const DEFAULT_THRESHOLDS = {
  statements: 90,
  branches: 85,
  functions: 80,
  lines: 90,
};

function formatPercentage(value) {
  return `${value.toFixed(2)}%`;
}

export function checkChangedCoverage(
  changedFiles,
  {
    coveragePath = path.resolve("coverage/coverage-final.json"),
    rootDirectory = process.cwd(),
    thresholds = DEFAULT_THRESHOLDS,
  } = {},
) {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  let failed = false;

  console.log("Changed production file coverage");
  for (const changedFile of changedFiles) {
    const entry = findCoverageEntry(coverage, rootDirectory, changedFile);
    if (!entry) {
      console.error(`✗ ${changedFile}: coverage data was not found`);
      failed = true;
      continue;
    }

    const fileCoverage = calculateFileCoverage(entry);
    const failedMetrics = Object.entries(thresholds).filter(
      ([metric, threshold]) => fileCoverage[metric] < threshold,
    );
    const marker = failedMetrics.length === 0 ? "✓" : "✗";
    const details = Object.entries(fileCoverage)
      .map(([metric, value]) => `${metric} ${formatPercentage(value)}`)
      .join(", ");
    console.log(`${marker} ${changedFile}: ${details}`);

    if (failedMetrics.length > 0) {
      failed = true;
      for (const [metric, threshold] of failedMetrics) {
        console.error(
          `  ${metric} ${formatPercentage(fileCoverage[metric])} is below ${threshold}%`,
        );
      }
    }
  }

  return failed ? 1 : 0;
}
