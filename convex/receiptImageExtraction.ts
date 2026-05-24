import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAuthenticatedUserId } from "./users";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** Convex string value の 1MB 制限を下回る imageDataUrl の最大長 */
const MAX_IMAGE_DATA_URL_LENGTH = 900_000;

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type ExtractionConfidence = {
  shopName: number;
  date: number;
  amountYen: number;
};

export type ExtractReceiptFieldsResult = {
  shopName: string;
  date: string;
  amountYen: number;
  confidence: ExtractionConfidence;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// バリデーション
// ---------------------------------------------------------------------------

/**
 * imageDataUrl の形式を検証する。
 * - "data:image/" で始まる必要がある
 * - ";base64," を含む必要がある
 * - 5,000,000 文字以内である必要がある
 */
function validateImageDataUrl(imageDataUrl: string): void {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new ConvexError("imageDataUrl は data:image/ で始まる Data URL 形式で指定してください");
  }
  if (!imageDataUrl.includes(";base64,")) {
    throw new ConvexError(
      "imageDataUrl は base64 エンコードされた Data URL 形式で指定してください",
    );
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new ConvexError(
      "画像サイズが大きすぎます。長辺 1400〜1800px・JPEG にリサイズしてから再試行してください",
    );
  }
}

// ---------------------------------------------------------------------------
// OpenAI Responses API レスポンス型
// ---------------------------------------------------------------------------

type OpenAIResponsesApiResponse = {
  output: Array<{
    type: string;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
};

type ExtractedFields = {
  shopName: string;
  date: string;
  amountYen: number;
  confidence: ExtractionConfidence;
  warnings: string[];
};

/** OpenAI Responses API のレスポンスから抽出結果を取り出す */
function parseOpenAIResponse(data: OpenAIResponsesApiResponse): ExtractedFields {
  const message = data.output?.find((o) => o.type === "message");
  const textContent = message?.content?.find((c) => c.type === "output_text");
  if (!textContent?.text) {
    throw new ConvexError("OpenAI からのレスポンスに期待するテキストコンテンツが含まれていません");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textContent.text);
  } catch {
    throw new ConvexError("OpenAI からのレスポンスを JSON としてパースできませんでした");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ConvexError("OpenAI レスポンスが期待する形式ではありません");
  }
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.shopName !== "string") {
    throw new ConvexError("OpenAI レスポンスの shopName が文字列ではありません");
  }
  if (typeof obj.date !== "string") {
    throw new ConvexError("OpenAI レスポンスの date が文字列ではありません");
  }
  validateExtractedDate(obj.date);
  if (typeof obj.amountYen !== "number") {
    throw new ConvexError("OpenAI レスポンスの amountYen が数値ではありません");
  }
  if (!Number.isInteger(obj.amountYen) || obj.amountYen < 0) {
    throw new ConvexError("OpenAI レスポンスの amountYen は 0 以上の整数である必要があります");
  }
  const confidence = parseConfidence(obj.confidence);

  return {
    shopName: obj.shopName,
    date: obj.date,
    amountYen: obj.amountYen,
    confidence,
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings as string[]).filter((w) => typeof w === "string")
      : [],
  };
}

function validateExtractedDate(date: string): void {
  if (date === "") {
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError("OpenAI レスポンスの date は YYYY-MM-DD 形式である必要があります");
  }
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ConvexError("OpenAI レスポンスの date が実在する日付ではありません");
  }
  const normalized = parsedDate.toISOString().slice(0, 10);
  if (normalized !== date) {
    throw new ConvexError("OpenAI レスポンスの date が実在する日付ではありません");
  }
}

function parseConfidence(value: unknown): ExtractionConfidence {
  if (typeof value !== "object" || value === null) {
    throw new ConvexError("OpenAI レスポンスの confidence がオブジェクトではありません");
  }
  const confidence = value as Record<string, unknown>;
  const shopName = parseConfidenceScore(confidence.shopName, "shopName");
  const date = parseConfidenceScore(confidence.date, "date");
  const amountYen = parseConfidenceScore(confidence.amountYen, "amountYen");
  return { shopName, date, amountYen };
}

function parseConfidenceScore(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new ConvexError(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// モックデータ
// ---------------------------------------------------------------------------

/** mock モード用のダミーレスポンス */
function getMockResult(): ExtractReceiptFieldsResult {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return {
    shopName: "サンプルストア",
    date: `${yyyy}-${mm}-${dd}`,
    amountYen: 1234,
    confidence: {
      shopName: 0.95,
      date: 0.98,
      amountYen: 0.98,
    },
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// handler（テスト用に export）
// ---------------------------------------------------------------------------

type ExtractReceiptFieldsArgs = {
  imageDataUrl: string;
};

type OpenAIReceiptExtractorArgs = {
  imageDataUrl: string;
  apiKey: string;
};

export async function extractReceiptFieldsHandler(
  ctx: ActionCtx,
  args: ExtractReceiptFieldsArgs,
): Promise<ExtractReceiptFieldsResult> {
  // 認証チェック
  await requireAuthenticatedUserId(ctx);

  const { imageDataUrl } = args;

  // imageDataUrl バリデーション
  validateImageDataUrl(imageDataUrl);

  const appEnv = process.env.APP_ENV ?? "development";
  const mode = getExtractorMode(appEnv);

  // real モードのガード: production 以外では実行不可
  if (mode === "real" && appEnv !== "production") {
    throw new ConvexError(
      `real モードは APP_ENV=production のときのみ利用できます（現在: ${appEnv}）`,
    );
  }

  // mock モード
  if (mode === "mock") {
    return getMockResult();
  }

  // real モード: OPENAI_API_KEY チェック
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConvexError(
      "OPENAI_API_KEY が設定されていません。Convex Dashboard で環境変数を設定してください",
    );
  }

  return callOpenAIReceiptExtractor({ imageDataUrl, apiKey });
}

async function callOpenAIReceiptExtractor({
  imageDataUrl,
  apiKey,
}: OpenAIReceiptExtractorArgs): Promise<ExtractReceiptFieldsResult> {
  // OpenAI Responses API 呼び出し（fetch を使用、"use node" 不要）
  const requestBody = {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: imageDataUrl,
          },
          {
            type: "input_text",
            text: [
              "このレシート画像から以下の情報を日本語で抽出してください。",
              "結果は以下の JSON スキーマに従って返してください：",
              '{"shopName": "店名（文字列）", "date": "日付（YYYY-MM-DD形式の文字列）", "amountYen": 合計金額（整数）, "confidence": {"shopName": 0.0〜1.0, "date": 0.0〜1.0, "amountYen": 0.0〜1.0}, "warnings": ["注意事項（配列）"]}',
              "読み取れない項目は空文字列または0を使用し、該当項目の confidence を低くしてください。",
            ].join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "receipt_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            shopName: { type: "string" },
            date: { type: "string", pattern: "^$|^\\d{4}-\\d{2}-\\d{2}$" },
            amountYen: { type: "integer", minimum: 0 },
            confidence: {
              type: "object",
              properties: {
                shopName: { type: "number", minimum: 0, maximum: 1 },
                date: { type: "number", minimum: 0, maximum: 1 },
                amountYen: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["shopName", "date", "amountYen"],
              additionalProperties: false,
            },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: ["shopName", "date", "amountYen", "confidence", "warnings"],
          additionalProperties: false,
        },
      },
    },
  };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new ConvexError(
      `OpenAI API への接続に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new ConvexError(`OpenAI API がエラーを返しました（HTTP ${response.status}）`);
  }

  let data: OpenAIResponsesApiResponse;
  try {
    data = (await response.json()) as OpenAIResponsesApiResponse;
  } catch {
    throw new ConvexError("OpenAI API のレスポンスを JSON としてパースできませんでした");
  }

  return parseOpenAIResponse(data);
}

// ---------------------------------------------------------------------------
// Action 定義
// ---------------------------------------------------------------------------

export const extractReceiptFields = action({
  args: {
    imageDataUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return extractReceiptFieldsHandler(ctx, args);
  },
});

function getExtractorMode(appEnv: string): "mock" | "real" {
  const mode = process.env.RECEIPT_IMAGE_EXTRACTOR_MODE;
  if (mode === undefined || mode === "") {
    if (appEnv === "production") {
      throw new ConvexError("RECEIPT_IMAGE_EXTRACTOR_MODE を production では必ず設定してください");
    }
    return "mock";
  }
  if (mode !== "mock" && mode !== "real") {
    throw new ConvexError(
      "RECEIPT_IMAGE_EXTRACTOR_MODE は mock または real のどちらかを指定してください",
    );
  }
  return mode;
}
