import { ConvexError } from "convex/values";
import type {
  ExtractReceiptFieldsResult,
  OpenAIReceiptExtractorArgs,
  OpenAIResponsesApiResponse,
} from "./types";
import { buildOpenAIReceiptExtractionRequestBody } from "./openaiSchema";
import { parseOpenAIResponse } from "./parseExtraction";

export async function callOpenAIReceiptExtractor({
  imageDataUrl,
  apiKey,
}: OpenAIReceiptExtractorArgs): Promise<ExtractReceiptFieldsResult> {
  const requestBody = buildOpenAIReceiptExtractionRequestBody(imageDataUrl);

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
