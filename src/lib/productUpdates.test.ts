import { describe, expect, test } from "vitest";
import {
  mergeProductUpdates,
  ProductUpdateValidationError,
  sortProductUpdates,
  validateAppVersion,
  validateProductionProductUpdates,
  validateProductUpdate,
  validateProductUpdateDraft,
} from "./productUpdates";

describe("validateAppVersion", () => {
  test("accepts a valid production version", () => {
    expect(validateAppVersion("2026.07.11-458")).toBe("2026.07.11-458");
  });

  test("rejects a version with a non-zero-padded month", () => {
    expect(() => validateAppVersion("2026.7.11-458")).toThrow(ProductUpdateValidationError);
  });

  test("rejects a version without a run number", () => {
    expect(() => validateAppVersion("2026.07.11")).toThrow(ProductUpdateValidationError);
  });

  test("rejects a version with a trailing hyphen but no run number", () => {
    expect(() => validateAppVersion("2026.07.11-")).toThrow(ProductUpdateValidationError);
  });

  test("rejects a version with a non-numeric run number", () => {
    expect(() => validateAppVersion("2026.07.11-abc")).toThrow(ProductUpdateValidationError);
  });

  test("rejects 'local' in production validation", () => {
    expect(() => validateAppVersion("local")).toThrow(ProductUpdateValidationError);
  });

  test("allows 'local' when explicitly permitted", () => {
    expect(validateAppVersion("local", { allowLocal: true })).toBe("local");
  });
});

describe("validateProductUpdateDraft", () => {
  test("accepts a valid draft", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-a",
        title: "Feature A",
        summary: "Summary text",
      }),
    ).not.toThrow();
  });

  test("accepts a draft with items", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-b",
        title: "Feature B",
        summary: "Summary text",
        items: ["item 1", "item 2"],
      }),
    ).not.toThrow();
  });

  test("rejects an empty id", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "",
        title: "Feature",
        summary: "Summary",
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects a duplicate id", () => {
    const seen = new Set(["feature-a"]);
    expect(() =>
      validateProductUpdateDraft({ id: "feature-a", title: "Feature A", summary: "Summary" }, seen),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects an empty title", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-a",
        title: "",
        summary: "Summary",
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects an empty summary", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-a",
        title: "Feature",
        summary: "",
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects empty items", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-a",
        title: "Feature",
        summary: "Summary",
        items: [],
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects an empty item string", () => {
    expect(() =>
      validateProductUpdateDraft({
        id: "feature-a",
        title: "Feature",
        summary: "Summary",
        items: ["item 1", ""],
      }),
    ).toThrow(ProductUpdateValidationError);
  });
});

describe("validateProductUpdate", () => {
  test("accepts a valid published update", () => {
    expect(() =>
      validateProductUpdate({
        id: "feature-a",
        title: "Feature A",
        summary: "Summary",
        version: "2026.07.11-458",
        publishedAt: "2026-07-11",
      }),
    ).not.toThrow();
  });

  test("rejects an invalid version", () => {
    expect(() =>
      validateProductUpdate({
        id: "feature-a",
        title: "Feature A",
        summary: "Summary",
        version: "2026.7.11-458",
        publishedAt: "2026-07-11",
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects an invalid publishedAt", () => {
    expect(() =>
      validateProductUpdate({
        id: "feature-a",
        title: "Feature A",
        summary: "Summary",
        version: "2026.07.11-458",
        publishedAt: "2026/07/11",
      }),
    ).toThrow(ProductUpdateValidationError);
  });
});

describe("sortProductUpdates", () => {
  test("sorts by version descending, latest run first on the same date", () => {
    const updates = [
      { id: "a", version: "2026.07.11-458", title: "A", summary: "A", publishedAt: "2026-07-11" },
      { id: "b", version: "2026.07.11-462", title: "B", summary: "B", publishedAt: "2026-07-11" },
      { id: "c", version: "2026.07.10-999", title: "C", summary: "C", publishedAt: "2026-07-10" },
    ];

    const sorted = sortProductUpdates(updates);

    expect(sorted.map((u) => u.id)).toEqual(["b", "a", "c"]);
  });
});

describe("mergeProductUpdates", () => {
  test("keeps only unpublished drafts as the current release", () => {
    const pastUpdates = [
      { id: "a", title: "A", summary: "A", version: "2026.07.10-100", publishedAt: "2026-07-10" },
      { id: "b", title: "B", summary: "B", version: "2026.07.10-100", publishedAt: "2026-07-10" },
    ];
    const drafts = [{ id: "c", title: "C", summary: "C" }];

    const { allUpdates, currentUpdates } = mergeProductUpdates({
      pastUpdates,
      drafts,
      appVersion: "2026.07.11-458",
      publishedAt: "2026-07-11",
    });

    expect(currentUpdates.map((u) => u.id)).toEqual(["c"]);
    expect(currentUpdates[0]).toEqual({
      id: "c",
      title: "C",
      summary: "C",
      version: "2026.07.11-458",
      publishedAt: "2026-07-11",
    });
    expect(allUpdates.map((u) => u.id)).toEqual(["c", "a", "b"]);
  });

  test("skips a draft that is already published in the same version", () => {
    const pastUpdates = [
      { id: "a", title: "A", summary: "A", version: "2026.07.11-458", publishedAt: "2026-07-11" },
    ];
    const drafts = [
      { id: "a", title: "A", summary: "A" },
      { id: "b", title: "B", summary: "B" },
    ];

    const { allUpdates, currentUpdates } = mergeProductUpdates({
      pastUpdates,
      drafts,
      appVersion: "2026.07.11-458",
      publishedAt: "2026-07-11",
    });

    expect(currentUpdates.map((u) => u.id)).toEqual(["b"]);
    expect(allUpdates.map((u) => u.id)).toEqual(["a", "b"]);
  });

  test("rejects a draft whose id is already published with a different version", () => {
    const pastUpdates = [
      { id: "a", title: "A", summary: "A", version: "2026.07.10-100", publishedAt: "2026-07-10" },
    ];
    const drafts = [{ id: "a", title: "A", summary: "A" }];

    expect(() =>
      mergeProductUpdates({
        pastUpdates,
        drafts,
        appVersion: "2026.07.11-458",
        publishedAt: "2026-07-11",
      }),
    ).toThrow(ProductUpdateValidationError);
  });

  test("rejects a draft whose id is duplicated in the draft list", () => {
    const pastUpdates: ReturnType<typeof mergeProductUpdates>["allUpdates"] = [];
    const drafts = [
      { id: "a", title: "A", summary: "A" },
      { id: "a", title: "A2", summary: "A2" },
    ];

    expect(() =>
      mergeProductUpdates({
        pastUpdates,
        drafts,
        appVersion: "2026.07.11-458",
        publishedAt: "2026-07-11",
      }),
    ).toThrow(ProductUpdateValidationError);
  });
});

describe("validateProductionProductUpdates", () => {
  test("accepts a valid release payload", () => {
    const payload = {
      version: "2026.07.11-458",
      publishedAt: "2026-07-11",
      updates: [
        {
          id: "feature-a",
          title: "Feature A",
          summary: "Summary",
          version: "2026.07.11-458",
          publishedAt: "2026-07-11",
        },
      ],
    };

    expect(() => validateProductionProductUpdates(payload)).not.toThrow();
  });

  test("rejects a payload whose update version does not match payload version", () => {
    const payload = {
      version: "2026.07.11-458",
      publishedAt: "2026-07-11",
      updates: [
        {
          id: "feature-a",
          title: "Feature A",
          summary: "Summary",
          version: "2026.07.10-100",
          publishedAt: "2026-07-11",
        },
      ],
    };

    expect(() => validateProductionProductUpdates(payload)).toThrow(ProductUpdateValidationError);
  });

  test("rejects a payload whose update publishedAt does not match payload publishedAt", () => {
    const payload = {
      version: "2026.07.11-458",
      publishedAt: "2026-07-11",
      updates: [
        {
          id: "feature-a",
          title: "Feature A",
          summary: "Summary",
          version: "2026.07.11-458",
          publishedAt: "2026-07-10",
        },
      ],
    };

    expect(() => validateProductionProductUpdates(payload)).toThrow(ProductUpdateValidationError);
  });

  test("rejects a payload with duplicate update ids", () => {
    const payload = {
      version: "2026.07.11-458",
      publishedAt: "2026-07-11",
      updates: [
        {
          id: "feature-a",
          title: "Feature A",
          summary: "Summary",
          version: "2026.07.11-458",
          publishedAt: "2026-07-11",
        },
        {
          id: "feature-a",
          title: "Feature A",
          summary: "Summary",
          version: "2026.07.11-458",
          publishedAt: "2026-07-11",
        },
      ],
    };

    expect(() => validateProductionProductUpdates(payload)).toThrow(ProductUpdateValidationError);
  });
});
