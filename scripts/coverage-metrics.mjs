import path from "node:path";

export function findCoverageEntry(coverage, rootDirectory, relativePath) {
  const absolutePath = path.resolve(rootDirectory, relativePath);
  const directEntry = coverage[absolutePath];
  if (directEntry) {
    return directEntry;
  }

  const normalizedAbsolutePath = path.normalize(absolutePath);
  return Object.entries(coverage).find(
    ([filePath]) => path.normalize(filePath) === normalizedAbsolutePath,
  )?.[1];
}

function calculatePercentage(values) {
  if (values.length === 0) {
    return 100;
  }

  const covered = values.filter((value) => value > 0).length;
  return (covered / values.length) * 100;
}

function getLineCoverageValues(entry) {
  const lineCounts = new Map();
  for (const [statementId, statement] of Object.entries(entry.statementMap ?? {})) {
    const line = statement.start.line;
    const count = entry.s[statementId] ?? 0;
    lineCounts.set(line, Math.max(lineCounts.get(line) ?? 0, count));
  }
  return [...lineCounts.values()];
}

export function calculateFileCoverage(entry) {
  return calculateAggregateCoverage([entry]);
}

export function calculateAggregateCoverage(entries) {
  return {
    statements: calculatePercentage(entries.flatMap((entry) => Object.values(entry.s))),
    branches: calculatePercentage(entries.flatMap((entry) => Object.values(entry.b).flat())),
    functions: calculatePercentage(entries.flatMap((entry) => Object.values(entry.f))),
    lines: calculatePercentage(entries.flatMap(getLineCoverageValues)),
  };
}
