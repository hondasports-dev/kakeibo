// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import {
  fetchMergedPullRequests,
  sanitizeExternalText,
  summarizePullRequest,
} from "./generateProductUpdates";
import { ProductUpdateValidationError } from "./productUpdates";

describe("sanitizeExternalText", () => {
  test("removes zero-width and control characters", () => {
    const text = "title\u200B\u202E with hidden chars";
    expect(sanitizeExternalText(text)).toBe("title with hidden chars");
  });

  test("normalizes unicode and trims", () => {
    const text = "  \u0061\u0301  "; // a + combining acute -> á
    expect(sanitizeExternalText(text)).toBe("á");
  });

  test("removes HTML comments", () => {
    const text = "before<!-- ignore -->after";
    expect(sanitizeExternalText(text)).toBe("beforeafter");
  });
});

describe("summarizePullRequest", () => {
  test("returns fallback draft when apiKey is not provided", async () => {
    const draft = await summarizePullRequest({
      number: 123,
      title: "Add feature",
      body: "This is a long description.\nMore details.",
      labels: ["enhancement"],
    });

    expect(draft).toEqual({
      id: "pr-123",
      title: "Add feature",
      summary: "不具合の修正を行いました",
    });
  });

  test("calls OpenAI and returns parsed draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "新機能を追加",
                summary: "家計簿に新機能を追加しました。",
                items: ["入力を簡略化", "履歴を表示"],
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const draft = await summarizePullRequest({
      number: 456,
      title: "Add feature",
      body: "body",
      labels: ["enhancement"],
      apiKey: "sk-test",
    });

    expect(draft).toEqual({
      id: "pr-456",
      title: "新機能を追加",
      summary: "家計簿に新機能を追加しました。",
      items: ["入力を簡略化", "履歴を表示"],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.model).toBe("gpt-4o-mini");
    expect(requestBody.response_format.type).toBe("json_object");

    vi.unstubAllGlobals();
  });

  test("returns fallback draft when OpenAI API returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: vi.fn().mockResolvedValue(""),
      }),
    );

    const draft = await summarizePullRequest({
      number: 1,
      title: "title",
      body: "body",
      labels: [],
      apiKey: "sk-bad",
    });

    expect(draft).toEqual({
      id: "pr-1",
      title: "title",
      summary: "不具合の修正を行いました",
    });

    vi.unstubAllGlobals();
  });

  test("returns fallback draft when OpenAI response is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ choices: [{ message: { content: "not-json" } }] }),
      }),
    );

    const draft = await summarizePullRequest({
      number: 1,
      title: "title",
      body: "body",
      labels: [],
      apiKey: "sk-test",
    });

    expect(draft).toEqual({
      id: "pr-1",
      title: "title",
      summary: "不具合の修正を行いました",
    });

    vi.unstubAllGlobals();
  });

  test("returns fallback draft when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const draft = await summarizePullRequest({
      number: 1,
      title: "title",
      body: "body",
      labels: [],
      apiKey: "sk-test",
    });

    expect(draft).toEqual({
      id: "pr-1",
      title: "title",
      summary: "不具合の修正を行いました",
    });

    vi.unstubAllGlobals();
  });
});

describe("fetchMergedPullRequests", () => {
  test("returns merged pull requests from GitHub search", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            number: 1,
            title: "Feature A",
            body: "Adds feature A",
            labels: [{ name: "enhancement" }],
            merged_at: "2026-07-11T10:00:00Z",
          },
          {
            number: 2,
            title: "Feature B",
            body: null,
            labels: [],
            merged_at: "2026-07-10T10:00:00Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const pulls = await fetchMergedPullRequests({
      owner: "hondasports",
      repo: "kakeibo",
      base: "main",
      since: "2026-07-10T00:00:00Z",
      token: "token",
    });

    expect(pulls).toHaveLength(2);
    expect(pulls[0].number).toBe(1);
    expect(pulls[0].title).toBe("Feature A");
    expect(pulls[0].body).toBe("Adds feature A");
    expect(pulls[0].labels).toEqual(["enhancement"]);
    expect(pulls[0].mergedAt).toBe("2026-07-11T10:00:00Z");
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("repo%3Ahondasports%2Fkakeibo");
    expect(url).toContain("base%3Amain");
    expect(url).toContain("merged%3A%3E2026-07-10T00%3A00%3A00Z");

    vi.unstubAllGlobals();
  });

  test("uses merged range when since and before are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            number: 1,
            title: "Feature A",
            body: "Adds feature A",
            labels: [{ name: "enhancement" }],
            merged_at: "2026-07-11T10:00:00Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchMergedPullRequests({
      owner: "hondasports",
      repo: "kakeibo",
      base: "main",
      since: "2026-07-10T00:00:00Z",
      before: "2026-07-11T10:00:00Z",
      token: "token",
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("merged%3A2026-07-10T00%3A00%3A00Z..2026-07-11T10%3A00%3A00Z");

    vi.unstubAllGlobals();
  });

  test("throws when GitHub search fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue(""),
      }),
    );

    await expect(
      fetchMergedPullRequests({
        owner: "hondasports",
        repo: "kakeibo",
        base: "main",
        token: "token",
      }),
    ).rejects.toThrow(ProductUpdateValidationError);

    vi.unstubAllGlobals();
  });
});
