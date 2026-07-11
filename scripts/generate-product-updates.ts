import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { productUpdateDrafts } from "../src/content/product-updates.ts";
import {
  mergeProductUpdates,
  ProductUpdate,
  ProductUpdateValidationError,
  validateAppVersion,
  validateProductionProductUpdates,
} from "../src/lib/productUpdates.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const PUBLISHED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ProductUpdateValidationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseRepoSlug(): { owner: string; repo: string } {
  const full = process.env.GITHUB_REPOSITORY ?? "hondasports/kakeibo";
  const [owner, repo] = full.split("/");
  if (!owner || !repo) {
    throw new ProductUpdateValidationError(`Invalid GITHUB_REPOSITORY: ${full}`);
  }
  return { owner, repo };
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "suzumemo-release-script",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ProductUpdateValidationError(
      `GitHub API request failed: ${response.status} ${response.statusText} for ${url}\n${body}`,
    );
  }

  return response.json() as Promise<T>;
}

async function downloadAssetText(assetId: number, token: string): Promise<string> {
  const { owner, repo } = parseRepoSlug();
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "suzumemo-release-script",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ProductUpdateValidationError(
      `GitHub asset download failed: ${response.status} ${response.statusText} for ${url}\n${body}`,
    );
  }

  return response.text();
}

type GitHubRelease = {
  tag_name: string;
  assets: Array<{ id: number; name: string }>;
};

async function loadPastUpdates({
  appVersion,
  token,
}: {
  appVersion: string;
  token: string;
}): Promise<ProductUpdate[]> {
  const { owner, repo } = parseRepoSlug();
  const releases = await fetchJson<GitHubRelease[]>(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
    token,
  );

  const pastUpdates: ProductUpdate[] = [];
  const seenIds = new Map<string, string>();

  for (const release of releases) {
    if (!release.tag_name.startsWith("app-v")) {
      continue;
    }

    const releaseVersion = release.tag_name.slice("app-v".length);
    if (releaseVersion === appVersion) {
      continue;
    }

    validateAppVersion(releaseVersion);

    const asset = release.assets.find((a) => a.name === "product-updates.json");
    if (!asset) {
      throw new ProductUpdateValidationError(
        `Release ${release.tag_name} does not have a product-updates.json asset`,
      );
    }

    const text = await downloadAssetText(asset.id, token);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ProductUpdateValidationError(
        `Release ${release.tag_name} product-updates.json is not valid JSON`,
      );
    }

    validateProductionProductUpdates(payload);

    if (payload.version !== releaseVersion) {
      throw new ProductUpdateValidationError(
        `Release ${release.tag_name} version does not match asset version ${payload.version}`,
      );
    }

    for (const update of payload.updates) {
      const previousVersion = seenIds.get(update.id);
      if (previousVersion) {
        throw new ProductUpdateValidationError(
          `ProductUpdate id ${update.id} is duplicated across releases (${previousVersion} and ${update.version})`,
        );
      }
      seenIds.set(update.id, update.version);
      pastUpdates.push(update);
    }
  }

  return pastUpdates;
}

function writeJsonFile(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function main(): Promise<void> {
  const appVersion = getRequiredEnv("APP_VERSION");
  const publishedAt = getRequiredEnv("PUBLISHED_AT");
  const token = getRequiredEnv("GITHUB_TOKEN");

  validateAppVersion(appVersion);

  if (!PUBLISHED_AT_PATTERN.test(publishedAt)) {
    throw new ProductUpdateValidationError(`Invalid PUBLISHED_AT: ${publishedAt}`);
  }

  const pastUpdates = await loadPastUpdates({ appVersion, token });
  const { allUpdates, currentUpdates } = mergeProductUpdates({
    pastUpdates,
    drafts: productUpdateDrafts,
    appVersion,
    publishedAt,
  });

  const generatedPath = resolve(repoRoot, "src/generated/product-updates.json");
  writeJsonFile(generatedPath, allUpdates);

  const currentReleasePath = resolve(repoRoot, ".tmp/product-updates.current-release.json");
  writeJsonFile(currentReleasePath, {
    version: appVersion,
    publishedAt,
    updates: currentUpdates,
  });

  console.log(`Generated ${generatedPath}`);
  console.log(`Generated ${currentReleasePath}`);
  console.log(`Total updates: ${allUpdates.length}`);
  console.log(`Current release updates: ${currentUpdates.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
