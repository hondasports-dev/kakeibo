export type ProductUpdateDraft = {
  id: string;
  title: string;
  summary: string;
  items?: string[];
};

export type ProductUpdate = ProductUpdateDraft & {
  version: string;
  publishedAt: string;
};

export type ProductionProductUpdates = {
  version: string;
  publishedAt: string;
  updates: ProductUpdate[];
};

export class ProductUpdateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductUpdateValidationError";
  }
}

export type ValidateAppVersionOptions = {
  allowLocal?: boolean;
};

const APP_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}-\d+$/;
const PUBLISHED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateAppVersion(
  version: string,
  { allowLocal = false }: ValidateAppVersionOptions = {},
): string {
  if (allowLocal && version === "local") {
    return version;
  }

  if (!APP_VERSION_PATTERN.test(version)) {
    throw new ProductUpdateValidationError(`Invalid app version: ${version}`);
  }

  return version;
}

export function parseVersion(version: string): {
  year: number;
  month: number;
  day: number;
  runNumber: number;
} {
  validateAppVersion(version);
  const [datePart, runNumberPart] = version.split("-");
  const [year, month, day] = datePart.split(".").map(Number);
  return { year, month, day, runNumber: Number(runNumberPart) };
}

function versionDateTimestamp(version: string): number {
  const { year, month, day } = parseVersion(version);
  return new Date(year, month - 1, day).getTime();
}

export function compareVersionStrings(a: string, b: string): number {
  const aTimestamp = versionDateTimestamp(a);
  const bTimestamp = versionDateTimestamp(b);
  if (aTimestamp !== bTimestamp) {
    return bTimestamp - aTimestamp;
  }

  const { runNumber: aRun } = parseVersion(a);
  const { runNumber: bRun } = parseVersion(b);
  return bRun - aRun;
}

export function sortProductUpdates<T extends { version: string }>(updates: T[]): T[] {
  return [...updates].sort((a, b) => compareVersionStrings(a.version, b.version));
}

export function validateProductUpdateDraft(
  draft: ProductUpdateDraft,
  existingIds?: Set<string>,
): void {
  if (!draft.id || draft.id.trim() === "") {
    throw new ProductUpdateValidationError("ProductUpdate id is required");
  }

  if (existingIds?.has(draft.id)) {
    throw new ProductUpdateValidationError(`ProductUpdate id is duplicated: ${draft.id}`);
  }

  if (!draft.title || draft.title.trim() === "") {
    throw new ProductUpdateValidationError("ProductUpdate title is required");
  }

  if (!draft.summary || draft.summary.trim() === "") {
    throw new ProductUpdateValidationError("ProductUpdate summary is required");
  }

  if (draft.items) {
    if (draft.items.length === 0) {
      throw new ProductUpdateValidationError("ProductUpdate items must not be empty when provided");
    }

    for (const item of draft.items) {
      if (!item || item.trim() === "") {
        throw new ProductUpdateValidationError("ProductUpdate item must not be empty");
      }
    }
  }
}

export function validateProductUpdate(update: ProductUpdate): void {
  validateProductUpdateDraft(update);
  validateAppVersion(update.version);

  if (!PUBLISHED_AT_PATTERN.test(update.publishedAt)) {
    throw new ProductUpdateValidationError(`Invalid publishedAt: ${update.publishedAt}`);
  }
}

export function mergeGeneratedAndManualDrafts({
  generated,
  manual,
}: {
  generated: ProductUpdateDraft[];
  manual: ProductUpdateDraft[];
}): ProductUpdateDraft[] {
  const seen = new Set<string>();
  const manualMap = new Map<string, ProductUpdateDraft>();

  for (const draft of manual) {
    validateProductUpdateDraft(draft, seen);
    seen.add(draft.id);
    manualMap.set(draft.id, draft);
  }

  const merged: ProductUpdateDraft[] = [...manual];
  const generatedSeen = new Set<string>();

  for (const draft of generated) {
    if (manualMap.has(draft.id)) {
      continue;
    }

    if (generatedSeen.has(draft.id)) {
      throw new ProductUpdateValidationError(`Generated draft id is duplicated: ${draft.id}`);
    }
    generatedSeen.add(draft.id);

    validateProductUpdateDraft(draft, seen);
    seen.add(draft.id);
    merged.push(draft);
  }

  return merged;
}

export function validateProductionProductUpdates(
  payload: unknown,
): asserts payload is ProductionProductUpdates {
  if (!payload || typeof payload !== "object") {
    throw new ProductUpdateValidationError("ProductionProductUpdates must be an object");
  }

  const p = payload as ProductionProductUpdates;
  validateAppVersion(p.version);

  if (!PUBLISHED_AT_PATTERN.test(p.publishedAt)) {
    throw new ProductUpdateValidationError(`Invalid publishedAt: ${p.publishedAt}`);
  }

  if (!Array.isArray(p.updates)) {
    throw new ProductUpdateValidationError("updates must be an array");
  }

  const seenIds = new Set<string>();
  for (const update of p.updates) {
    validateProductUpdateDraft(update, seenIds);
    seenIds.add(update.id);
    validateProductUpdate(update);

    if (update.version !== p.version) {
      throw new ProductUpdateValidationError(
        `ProductUpdate version ${update.version} does not match release version ${p.version}`,
      );
    }

    if (update.publishedAt !== p.publishedAt) {
      throw new ProductUpdateValidationError(
        `ProductUpdate publishedAt ${update.publishedAt} does not match release publishedAt ${p.publishedAt}`,
      );
    }
  }
}

export function mergeProductUpdates({
  pastUpdates,
  drafts,
  appVersion,
  publishedAt,
}: {
  pastUpdates: ProductUpdate[];
  drafts: ProductUpdateDraft[];
  appVersion: string;
  publishedAt: string;
}): { allUpdates: ProductUpdate[]; currentUpdates: ProductUpdate[] } {
  validateAppVersion(appVersion);

  if (!PUBLISHED_AT_PATTERN.test(publishedAt)) {
    throw new ProductUpdateValidationError(`Invalid publishedAt: ${publishedAt}`);
  }

  const publishedMap = new Map(pastUpdates.map((u) => [u.id, u.version]));
  const draftIds = new Set<string>();
  const currentUpdates: ProductUpdate[] = [];

  for (const draft of drafts) {
    validateProductUpdateDraft(draft, draftIds);
    draftIds.add(draft.id);

    const pastVersion = publishedMap.get(draft.id);
    if (pastVersion) {
      if (pastVersion !== appVersion) {
        throw new ProductUpdateValidationError(
          `ProductUpdate id ${draft.id} is already published in version ${pastVersion}`,
        );
      }
      continue;
    }

    currentUpdates.push({ ...draft, version: appVersion, publishedAt });
  }

  const allUpdates = sortProductUpdates([...pastUpdates, ...currentUpdates]);
  return { allUpdates, currentUpdates };
}
