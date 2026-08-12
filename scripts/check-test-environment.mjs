import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = process.cwd();
const MAX_REPORTED_FAILURES = 20;

function parseOptions(argv) {
  return {
    coverage: argv.includes("--coverage"),
  };
}

function formatPath(filePath) {
  return path.relative(rootDirectory, filePath).replaceAll("\\", "/") || ".";
}

function describeError(error) {
  if (error && typeof error === "object" && "code" in error && error.code) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function assertReadable(filePath, failures) {
  try {
    const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY);
    fs.closeSync(descriptor);
  } catch (error) {
    failures.push({ filePath, reason: describeError(error) });
  }
}

function getDirectoryStats(directoryPath, failures) {
  try {
    const stats = fs.statSync(directoryPath);
    if (!stats.isDirectory()) {
      failures.push({ filePath: directoryPath, reason: "ディレクトリではありません。" });
      return false;
    }
    return stats;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    failures.push({ filePath: directoryPath, reason: describeError(error) });
    return false;
  }
}

function findExistingEntry(entryPath, failures) {
  const candidates = [
    entryPath,
    `${entryPath}.js`,
    `${entryPath}.mjs`,
    `${entryPath}.cjs`,
    `${entryPath}.json`,
    path.join(entryPath, "index.js"),
    path.join(entryPath, "index.mjs"),
    path.join(entryPath, "index.cjs"),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }
      failures.push({ filePath: candidate, reason: describeError(error) });
      return undefined;
    }
  }

  return undefined;
}

function getExportTargets(exportsField) {
  if (typeof exportsField === "string") {
    return [exportsField];
  }
  if (!exportsField || typeof exportsField !== "object") {
    return [];
  }

  return Object.values(exportsField).flatMap((value) => getExportTargets(value));
}

function getPackageEntryPaths(packageDirectory, packageManifest) {
  const entryValues = [
    packageManifest.main,
    packageManifest.module,
    packageManifest.browser,
    ...getExportTargets(packageManifest.exports),
  ].filter((value) => typeof value === "string");
  const uniqueEntries = [...new Set(entryValues)];

  return uniqueEntries
    .filter((entry) => entry.startsWith(".") && !entry.includes("*"))
    .map((entry) => path.resolve(packageDirectory, entry))
    .filter((entryPath) => {
      const relativePath = path.relative(packageDirectory, entryPath);
      return (
        relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
      );
    });
}

function checkPackageDirectory(packageDirectory, failures, state) {
  const packageJsonPath = path.join(packageDirectory, "package.json");
  let packageManifest;
  try {
    packageManifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    failures.push({ filePath: packageJsonPath, reason: describeError(error) });
    return;
  }

  state.checkedPackages += 1;
  const entryPaths = getPackageEntryPaths(packageDirectory, packageManifest);
  for (const entryPath of entryPaths) {
    if (failures.length >= MAX_REPORTED_FAILURES) {
      return;
    }
    const existingEntryPath = findExistingEntry(entryPath, failures);
    if (existingEntryPath) {
      assertReadable(existingEntryPath, failures);
    }
  }
}

function scanPnpmPackages(pnpmStorePath, failures, state) {
  let packageVersions;
  try {
    packageVersions = fs.readdirSync(pnpmStorePath, { withFileTypes: true });
  } catch (error) {
    failures.push({ filePath: pnpmStorePath, reason: describeError(error) });
    return;
  }

  for (const packageVersion of packageVersions) {
    if (
      failures.length >= MAX_REPORTED_FAILURES ||
      packageVersion.name === "node_modules" ||
      !packageVersion.isDirectory()
    ) {
      continue;
    }

    const packageNodeModulesPath = path.join(pnpmStorePath, packageVersion.name, "node_modules");
    let packageEntries;
    try {
      packageEntries = fs.readdirSync(packageNodeModulesPath, { withFileTypes: true });
    } catch (error) {
      failures.push({ filePath: packageNodeModulesPath, reason: describeError(error) });
      continue;
    }

    for (const packageEntry of packageEntries) {
      if (failures.length >= MAX_REPORTED_FAILURES) {
        return;
      }
      if (packageEntry.isSymbolicLink()) {
        continue;
      }

      const packageEntryPath = path.join(packageNodeModulesPath, packageEntry.name);
      if (packageEntry.name.startsWith("@") && packageEntry.isDirectory()) {
        let scopedEntries;
        try {
          scopedEntries = fs.readdirSync(packageEntryPath, { withFileTypes: true });
        } catch (error) {
          failures.push({ filePath: packageEntryPath, reason: describeError(error) });
          continue;
        }
        for (const scopedEntry of scopedEntries) {
          if (failures.length >= MAX_REPORTED_FAILURES) {
            return;
          }
          if (!scopedEntry.isSymbolicLink() && scopedEntry.isDirectory()) {
            checkPackageDirectory(path.join(packageEntryPath, scopedEntry.name), failures, state);
          }
        }
      } else if (packageEntry.isDirectory()) {
        checkPackageDirectory(packageEntryPath, failures, state);
      }
    }
  }
}

function getProbePaths({ coverage }) {
  const paths = [path.resolve(rootDirectory, "node_modules/vitest/vitest.mjs")];
  if (coverage) {
    paths.push(path.resolve(rootDirectory, "node_modules/@vitest/coverage-v8/package.json"));
  }
  return paths;
}

export function runTestDependencyPreflight(options = {}) {
  const failures = [];
  const state = { checkedPackages: 0 };
  const nodeModulesPath = path.resolve(rootDirectory, "node_modules");

  for (const probePath of getProbePaths(options)) {
    assertReadable(probePath, failures);
  }

  const nodeModulesStats = getDirectoryStats(nodeModulesPath, failures);
  const pnpmStorePath = path.join(nodeModulesPath, ".pnpm");
  if (getDirectoryStats(pnpmStorePath, failures)) {
    scanPnpmPackages(pnpmStorePath, failures, state);
  } else if (nodeModulesStats === null) {
    failures.push({
      filePath: nodeModulesPath,
      reason: "node_modulesが存在しません。",
    });
  }

  if (failures.length > 0) {
    console.error("テスト開始前の依存環境チェックに失敗しました。テストは開始していません。");
    for (const failure of failures) {
      console.error(`- ${formatPath(failure.filePath)}: ${failure.reason}`);
    }
    if (failures.length === MAX_REPORTED_FAILURES) {
      console.error(`- その他の読み取りエラーは${MAX_REPORTED_FAILURES}件に制限しています。`);
    }
    console.error(
      "依存環境を修復するには pnpm install --frozen-lockfile を実行してから再実行してください。",
    );
    return 1;
  }

  console.log(
    `Test dependency preflight passed${state.checkedPackages > 0 ? ` (${state.checkedPackages} packages checked)` : ""}.`,
  );
  return 0;
}

const options = parseOptions(process.argv.slice(2));
const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const currentScriptPath = fileURLToPath(import.meta.url);

if (invokedScriptPath === currentScriptPath) {
  process.exitCode = runTestDependencyPreflight(options);
}
