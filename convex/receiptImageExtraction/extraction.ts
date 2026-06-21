import type { ActionCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { requireAuthenticatedUserId } from "../users";

/** Convex string value の 1MB 制限を下回る imageDataUrl の最大長 */
const MAX_IMAGE_DATA_URL_LENGTH = 900_000;
const JAPAN_TIME_ZONE = "Asia/Tokyo";

export type ExtractionConfidence = {
  shopName: number;
  date: number;
  amountYen: number;
  documentType?: number;
  paymentPlace?: number;
  payeeName?: number;
  paymentPurpose?: number;
  categoryName?: number;
};

export type ExtractReceiptFieldsResult = {
  shopName: string;
  date: string;
  amountYen: number;
  documentType: "receipt" | "convenience_payment" | "unknown";
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  categoryName?: string;
  confidence: ExtractionConfidence;
  warnings: string[];
};

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
  documentType: "receipt" | "convenience_payment" | "unknown";
  paymentPlace?: string;
  payeeName?: string;
  paymentPurpose?: string;
  categoryName?: string;
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

  const documentType = parseOptionalDocumentType(obj.documentType);
  const paymentPlace = parseOptionalString(obj.paymentPlace, "paymentPlace");
  const payeeName = parseOptionalString(obj.payeeName, "payeeName");
  const paymentPurpose = parseOptionalString(obj.paymentPurpose, "paymentPurpose");
  const categoryName = parseOptionalString(obj.categoryName, "categoryName");

  return {
    shopName: obj.shopName,
    date: obj.date,
    amountYen: obj.amountYen,
    documentType,
    paymentPlace,
    payeeName,
    paymentPurpose,
    categoryName,
    confidence,
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings as string[]).filter((w) => typeof w === "string")
      : [],
  };
}

function parseOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ConvexError(`OpenAI レスポンスの ${fieldName} が文字列ではありません`);
  }
  return value;
}

function parseOptionalDocumentType(value: unknown): "receipt" | "convenience_payment" | "unknown" {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (value !== "receipt" && value !== "convenience_payment" && value !== "unknown") {
    throw new ConvexError(
      'OpenAI レスポンスの documentType は "receipt", "convenience_payment", "unknown" のいずれかである必要があります',
    );
  }
  return value;
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
  return {
    shopName,
    date,
    amountYen,
    documentType: parseOptionalConfidenceScore(confidence.documentType, "documentType"),
    paymentPlace: parseOptionalConfidenceScore(confidence.paymentPlace, "paymentPlace"),
    payeeName: parseOptionalConfidenceScore(confidence.payeeName, "payeeName"),
    paymentPurpose: parseOptionalConfidenceScore(confidence.paymentPurpose, "paymentPurpose"),
    categoryName: parseOptionalConfidenceScore(confidence.categoryName, "categoryName"),
  };
}

function parseConfidenceScore(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new ConvexError(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

function parseOptionalConfidenceScore(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new ConvexError(
      `OpenAI レスポンスの confidence.${fieldName} は 0.0〜1.0 の数値である必要があります`,
    );
  }
  return value;
}

/** mock モード用のダミーレスポンス */
function getTodayDateStringInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new ConvexError("mock 日付の生成に失敗しました");
  }
  return `${year}-${month}-${day}`;
}

function getMockResult(): ExtractReceiptFieldsResult {
  return {
    shopName: "サンプルストア",
    date: getTodayDateStringInJapan(),
    amountYen: 1234,
    documentType: "receipt",
    categoryName: "食費",
    confidence: {
      shopName: 0.95,
      date: 0.98,
      amountYen: 0.98,
      documentType: 0.9,
      categoryName: 0.85,
    },
    warnings: [],
  };
}

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
  // 認証チェック（画像解析はグループメンバーシップ不要、認証のみ確認）
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
              "この画像はレシートまたはコンビニ払込票です。書類種別を判定し、以下の情報を日本語で抽出してください。",
              "コンビニ払込票の場合は、shopName（店舗名）ではなく paymentPlace（支払場所）・payeeName（支払先）・paymentPurpose（支払内容）を優先して読み取ってください。",
              "カテゴリ推定は、レシートなら shopName、払込票なら payeeName と paymentPurpose を重視してください。",
              "結果は以下の JSON スキーマに従って返してください：",
              '{"documentType": "receipt | convenience_payment | unknown", "shopName": "店名（文字列）", "paymentPlace": "支払場所（文字列）", "payeeName": "支払先（文字列）", "paymentPurpose": "支払内容（文字列）", "date": "日付（YYYY-MM-DD形式の文字列）", "amountYen": 合計金額（整数）, "categoryName": "推定カテゴリ名（文字列）", "confidence": {"documentType": 0.0〜1.0, "shopName": 0.0〜1.0, "paymentPlace": 0.0〜1.0, "payeeName": 0.0〜1.0, "paymentPurpose": 0.0〜1.0, "date": 0.0〜1.0, "amountYen": 0.0〜1.0, "categoryName": 0.0〜1.0}, "warnings": ["注意事項（配列）"]}',
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
            documentType: {
              type: "string",
              enum: ["receipt", "convenience_payment", "unknown"],
            },
            shopName: { type: "string" },
            paymentPlace: { type: "string" },
            payeeName: { type: "string" },
            paymentPurpose: { type: "string" },
            date: { type: "string", pattern: "^$|^\\d{4}-\\d{2}-\\d{2}$" },
            amountYen: { type: "integer", minimum: 0 },
            categoryName: { type: "string" },
            confidence: {
              type: "object",
              properties: {
                documentType: { type: "number", minimum: 0, maximum: 1 },
                shopName: { type: "number", minimum: 0, maximum: 1 },
                paymentPlace: { type: "number", minimum: 0, maximum: 1 },
                payeeName: { type: "number", minimum: 0, maximum: 1 },
                paymentPurpose: { type: "number", minimum: 0, maximum: 1 },
                date: { type: "number", minimum: 0, maximum: 1 },
                amountYen: { type: "number", minimum: 0, maximum: 1 },
                categoryName: { type: "number", minimum: 0, maximum: 1 },
              },
              required: [
                "documentType",
                "shopName",
                "paymentPlace",
                "payeeName",
                "paymentPurpose",
                "date",
                "amountYen",
                "categoryName",
              ],
              additionalProperties: false,
            },
            warnings: { type: "array", items: { type: "string" } },
          },
          required: [
            "documentType",
            "shopName",
            "paymentPlace",
            "payeeName",
            "paymentPurpose",
            "date",
            "amountYen",
            "categoryName",
            "confidence",
            "warnings",
          ],
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
