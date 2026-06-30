export const RECEIPT_EXTRACTION_PROMPT_LINES = [
  "この画像はレシートまたはコンビニ払込票です。書類種別を判定し、以下の情報を日本語で抽出してください。",
  "コンビニ払込票の場合は、shopName（店舗名）ではなく paymentPlace（支払場所）・payeeName（支払先）・paymentPurpose（支払内容）を優先して読み取ってください。",
  "カテゴリ推定は、レシートなら shopName、払込票なら payeeName と paymentPurpose を重視してください。",
  "結果は以下の JSON スキーマに従って返してください：",
  '{"documentType": "receipt | convenience_payment | unknown", "shopName": "店名（文字列）", "paymentPlace": "支払場所（文字列）", "payeeName": "支払先（文字列）", "paymentPurpose": "支払内容（文字列）", "date": "日付（YYYY-MM-DD形式の文字列）", "amountYen": 合計金額（整数）, "categoryName": "推定カテゴリ名（文字列）", "items": [{"itemName": "明細名（文字列）", "amountYen": 明細金額（整数）, "categoryName": "明細の推定カテゴリ名（文字列）", "confidence": {"itemName": 0.0〜1.0, "amountYen": 0.0〜1.0, "categoryName": 0.0〜1.0}, "warnings": ["明細の注意事項（配列）"]}], "confidence": {"documentType": 0.0〜1.0, "shopName": 0.0〜1.0, "paymentPlace": 0.0〜1.0, "payeeName": 0.0〜1.0, "paymentPurpose": 0.0〜1.0, "date": 0.0〜1.0, "amountYen": 0.0〜1.0, "categoryName": 0.0〜1.0}, "warnings": ["注意事項（配列）"]}',
  "レシート内の明細が読み取れる場合は items に itemName、amountYen、categoryName、confidence、warnings を入れてください。",
  "商品明細の金額は印字された税込金額を使用し、内税額・税率別対象額・消費税計・小計・合計・決済情報は items に含めないでください。",
  "値引き・クーポン・ポイント充当は負の amountYen として items に含めてください。対象商品が分かる場合は同じ categoryName、分からない場合は categoryName を空文字列にして warnings に理由を入れてください。",
  "明細が読み取れない場合も items は空配列 [] にしてください。",
  "読み取れない項目は空文字列または0を使用し、該当項目の confidence を低くしてください。",
] as const;

export const RECEIPT_EXTRACTION_JSON_SCHEMA = {
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
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemName: { type: "string" },
          amountYen: { type: "integer" },
          categoryName: { type: "string" },
          confidence: {
            type: "object",
            properties: {
              itemName: { type: "number", minimum: 0, maximum: 1 },
              amountYen: { type: "number", minimum: 0, maximum: 1 },
              categoryName: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["itemName", "amountYen", "categoryName"],
            additionalProperties: false,
          },
          warnings: { type: "array", items: { type: "string" } },
        },
        required: ["itemName", "amountYen", "categoryName", "confidence", "warnings"],
        additionalProperties: false,
      },
    },
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
    "items",
    "confidence",
    "warnings",
  ],
  additionalProperties: false,
} as const;

export function buildOpenAIReceiptExtractionRequestBody(imageDataUrl: string) {
  return {
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
            text: RECEIPT_EXTRACTION_PROMPT_LINES.join("\n"),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "receipt_extraction",
        strict: true,
        schema: RECEIPT_EXTRACTION_JSON_SCHEMA,
      },
    },
  };
}
