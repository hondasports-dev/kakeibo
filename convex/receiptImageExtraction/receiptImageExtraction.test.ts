import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ActionCtx } from "../_generated/server";
import { extractReceiptFieldsHandler } from "./extraction";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

function createIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|user-001",
    subject: "user-001",
    issuer: "https://issuer.example",
    ...overrides,
  };
}

const GROUP_ID = "group-001";

/**
 * ActionCtx の最小モックを生成する。
 *
 * - ctx.auth.getUserIdentity() は identity を返す
 * - ctx.db.query("groupMembers").withIndex("by_user_id").unique() はグループメンバーを返す
 */
function createActionCtx(identity: UserIdentity | null): ActionCtx {
  const groupMember =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: GROUP_ID,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      query: vi.fn().mockImplementation((_tableName: string) => ({
        withIndex: vi
          .fn()
          .mockImplementation((_indexName: string, builder?: (q: unknown) => unknown) => {
            if (builder) {
              const q = { eq: vi.fn().mockImplementation(() => q) };
              builder(q);
            }
            return { unique: vi.fn().mockResolvedValue(groupMember) };
          }),
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ActionCtx;
}

/**
 * process.env をテスト用の値で上書きし、テスト後に復元するヘルパー。
 */
async function withEnv(
  envVars: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(envVars)) {
    original[key] = process.env[key];
    if (envVars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envVars[key];
    }
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

/** 有効な data URL スタブ（テスト用の小さな文字列） */
const VALID_IMAGE_DATA_URL = "data:image/jpeg;base64," + "A".repeat(100);

/** 5MB を超える data URL スタブ */
const OVERSIZED_IMAGE_DATA_URL = "data:image/jpeg;base64," + "A".repeat(5_000_001);

function getTodayDateStringInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Tokyo",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("JST 日付の生成に失敗しました");
  }
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("extractReceiptFieldsHandler", () => {
  describe("認証チェック", () => {
    it("未認証ユーザーは実行できない", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(null);
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
        ).rejects.toThrow(ConvexError);
      });
    });
  });

  describe("imageDataUrl バリデーション", () => {
    it("data:image/ で始まらない場合は拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: "https://example.com/image.jpg" }),
        ).rejects.toThrow(ConvexError);
      });
    });

    it("base64 がない不正フォーマットを拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, {
            imageDataUrl: "data:image/jpeg;plaintext,abc",
          }),
        ).rejects.toThrow(ConvexError);
      });
    });

    it("大きすぎる画像を拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: OVERSIZED_IMAGE_DATA_URL }),
        ).rejects.toThrow(ConvexError);
      });
    });
  });

  describe("mock モード", () => {
    it("mock モードでは OpenAI API が呼ばれずにモックデータを返す", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const ctx = createActionCtx(createIdentity());
        const result = await extractReceiptFieldsHandler(ctx, {
          imageDataUrl: VALID_IMAGE_DATA_URL,
        });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          shopName: expect.any(String),
          date: expect.any(String),
          amountYen: expect.any(Number),
          confidence: {
            shopName: expect.any(Number),
            date: expect.any(Number),
            amountYen: expect.any(Number),
          },
        });
        fetchSpy.mockRestore();
      });
    });

    it("mock モードの返却値に必須フィールドが含まれる", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        const result = await extractReceiptFieldsHandler(ctx, {
          imageDataUrl: VALID_IMAGE_DATA_URL,
        });

        expect(result).toHaveProperty("shopName");
        expect(result).toHaveProperty("date");
        expect(result).toHaveProperty("amountYen");
        expect(result).toHaveProperty("confidence");
        expect(result).toHaveProperty("documentType");
        expect(typeof result.amountYen).toBe("number");
        // date は YYYY-MM-DD 形式
        expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("mock モードの日付はJSTの今日を返す", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));
      try {
        await withEnv(
          { RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" },
          async () => {
            const ctx = createActionCtx(createIdentity());
            const expectedDate = getTodayDateStringInJapan();
            const result = await extractReceiptFieldsHandler(ctx, {
              imageDataUrl: VALID_IMAGE_DATA_URL,
            });

            expect(result.date).toBe(expectedDate);
          },
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("mock モードでは documentType が receipt を返す", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "mock", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        const result = await extractReceiptFieldsHandler(ctx, {
          imageDataUrl: VALID_IMAGE_DATA_URL,
        });

        expect(result.documentType).toBe("receipt");
      });
    });
  });

  describe("real モードのガード", () => {
    it("APP_ENV が production 以外のときは real モードを拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "real", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
        ).rejects.toThrow(ConvexError);
      });
    });

    it("APP_ENV が preview のときも real モードを拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "real", APP_ENV: "preview" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
        ).rejects.toThrow(ConvexError);
      });
    });

    it("OPENAI_API_KEY 未設定のときは real モードでエラーを返す", async () => {
      await withEnv(
        { RECEIPT_IMAGE_EXTRACTOR_MODE: "real", APP_ENV: "production", OPENAI_API_KEY: undefined },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("production で mode 未設定の場合は拒否する", async () => {
      await withEnv(
        { RECEIPT_IMAGE_EXTRACTOR_MODE: undefined, APP_ENV: "production" },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("mode が mock / real 以外の場合は拒否する", async () => {
      await withEnv({ RECEIPT_IMAGE_EXTRACTOR_MODE: "moc", APP_ENV: "development" }, async () => {
        const ctx = createActionCtx(createIdentity());
        await expect(
          extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
        ).rejects.toThrow(ConvexError);
      });
    });
  });

  describe("real モード - OpenAI API 呼び出し", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("正常レスポンスをパースして返す", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "スーパーマーケット ABC",
                  date: "2024-03-15",
                  amountYen: 1580,
                  confidence: {
                    shopName: 0.94,
                    date: 0.96,
                    amountYen: 0.98,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          const result = await extractReceiptFieldsHandler(ctx, {
            imageDataUrl: VALID_IMAGE_DATA_URL,
          });

          expect(result).toMatchObject({
            shopName: "スーパーマーケット ABC",
            date: "2024-03-15",
            amountYen: 1580,
            confidence: {
              shopName: 0.94,
              date: 0.96,
              amountYen: 0.98,
            },
          });
        },
      );
    });

    it("OpenAI API エラー時は ConvexError を投げる", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-invalid-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("JSON パース失敗時は ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "これはJSONではない",
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("スキーマ不正なレスポンス（amountYen が文字列）は ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "ABC",
                  date: "2024-03-15",
                  amountYen: "千五百円", // number のはずが string
                  confidence: {
                    shopName: 0.7,
                    date: 0.7,
                    amountYen: 0.2,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("実在しない日付は ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "ABC",
                  date: "2024-02-31",
                  amountYen: 1500,
                  confidence: {
                    shopName: 0.7,
                    date: 0.4,
                    amountYen: 0.8,
                  },
                  warnings: ["日付が不明瞭です"],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("小数の amountYen は ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "ABC",
                  date: "2024-03-15",
                  amountYen: 123.45,
                  confidence: {
                    shopName: 0.8,
                    date: 0.8,
                    amountYen: 0.8,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("confidence が項目別スコアでないレスポンスは ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "ABC",
                  date: "2024-03-15",
                  amountYen: 1500,
                  confidence: "high",
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("confidence スコアが 0.0〜1.0 の範囲外なら ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  shopName: "ABC",
                  date: "2024-03-15",
                  amountYen: 1500,
                  confidence: {
                    shopName: 0.8,
                    date: 1.2,
                    amountYen: 0.9,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("fetch 自体がネットワークエラーのとき ConvexError を投げる", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });

    it("コンビニ払込票のレスポンスをパースして返す", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  documentType: "convenience_payment",
                  shopName: "セブンイレブン",
                  paymentPlace: "セブンイレブン北浜店",
                  payeeName: "東京都",
                  paymentPurpose: "自動車税",
                  date: "2024-03-15",
                  amountYen: 39500,
                  categoryName: "税金",
                  confidence: {
                    documentType: 0.92,
                    shopName: 0.85,
                    paymentPlace: 0.9,
                    payeeName: 0.95,
                    paymentPurpose: 0.94,
                    date: 0.9,
                    amountYen: 0.98,
                    categoryName: 0.88,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          const result = await extractReceiptFieldsHandler(ctx, {
            imageDataUrl: VALID_IMAGE_DATA_URL,
          });

          expect(result).toMatchObject({
            documentType: "convenience_payment",
            shopName: "セブンイレブン",
            paymentPlace: "セブンイレブン北浜店",
            payeeName: "東京都",
            paymentPurpose: "自動車税",
            date: "2024-03-15",
            amountYen: 39500,
            categoryName: "税金",
            confidence: {
              documentType: 0.92,
              shopName: 0.85,
              paymentPlace: 0.9,
              payeeName: 0.95,
              paymentPurpose: 0.94,
              date: 0.9,
              amountYen: 0.98,
              categoryName: 0.88,
            },
          });
        },
      );
    });

    it("オプション confidence スコアが 0.0〜1.0 の範囲外なら ConvexError を投げる", async () => {
      const mockApiResponse = {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  documentType: "convenience_payment",
                  shopName: "セブンイレブン",
                  paymentPlace: "セブンイレブン北浜店",
                  payeeName: "東京都",
                  paymentPurpose: "自動車税",
                  date: "2024-03-15",
                  amountYen: 39500,
                  categoryName: "税金",
                  confidence: {
                    documentType: 0.92,
                    shopName: 0.85,
                    paymentPlace: 1.5,
                    payeeName: 0.95,
                    paymentPurpose: 0.94,
                    date: 0.9,
                    amountYen: 0.98,
                    categoryName: 0.88,
                  },
                  warnings: [],
                }),
              },
            ],
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await withEnv(
        {
          RECEIPT_IMAGE_EXTRACTOR_MODE: "real",
          APP_ENV: "production",
          OPENAI_API_KEY: "sk-test-key",
        },
        async () => {
          const ctx = createActionCtx(createIdentity());
          await expect(
            extractReceiptFieldsHandler(ctx, { imageDataUrl: VALID_IMAGE_DATA_URL }),
          ).rejects.toThrow(ConvexError);
        },
      );
    });
  });
});
