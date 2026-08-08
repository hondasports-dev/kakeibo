import { ConvexError } from "convex/values";
import {
  parseOpenAIResponse as parseOpenAIResponseDomain,
  type ParseOpenAIResponseResult,
} from "../../../lib/domain/receipt/extraction";
import type {
  ExtractedFields,
  OpenAIResponsesApiResponse,
} from "./types";

/** OpenAI Responses API のレスポンスから抽出結果を取り出す */
export function parseOpenAIResponse(data: OpenAIResponsesApiResponse): ExtractedFields {
  const result = parseOpenAIResponseDomain(data);
  if (!result.success) {
    throw new ConvexError(result.error);
  }
  return result.extracted;
}

export type { ParseOpenAIResponseResult };
