import { v } from "convex/values";

export const lineLinkRequestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("claimed"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("expired"),
);

export const lineLinkStatusValidator = v.union(v.literal("active"), v.literal("revoked"));

export const lineLinkAuditActionValidator = v.union(
  v.literal("started"),
  v.literal("linked"),
  v.literal("unlinked"),
  v.literal("failed"),
);

export type LineLinkFeedback = {
  result: "success" | "failure";
  code: "success" | "expired" | "invalid" | "conflict" | "failed";
};

export const lineLinkFeedbackValidator = v.object({
  result: v.union(v.literal("success"), v.literal("failure")),
  code: v.union(
    v.literal("success"),
    v.literal("expired"),
    v.literal("invalid"),
    v.literal("conflict"),
    v.literal("failed"),
  ),
});

/** 外部連携の内部詳細をUIへ伝播させないための有限な結果コード。 */
export function getLineLinkFeedback(reason: string): LineLinkFeedback {
  switch (reason) {
    case "SUCCESS":
      return { result: "success", code: "success" };
    case "STATE_EXPIRED":
      return { result: "failure", code: "expired" };
    case "LINE_LINK_CONFLICT":
      return { result: "failure", code: "conflict" };
    case "INVALID_CALLBACK":
    case "INVALID_NONCE":
    case "INVALID_AUDIENCE":
    case "INVALID_ISSUER":
    case "INVALID_EXPIRY":
      return { result: "failure", code: "invalid" };
    default:
      return { result: "failure", code: "failed" };
  }
}

export function getLineIntegrationMode(): "mock" | "real" {
  const mode = process.env.LINE_INTEGRATION_MODE;
  if (mode !== "mock" && mode !== "real") {
    throw new Error("LINE integration mode is unavailable");
  }
  if (mode === "mock" && process.env.APP_ENV === "production") {
    throw new Error("LINE mock mode is not available in production");
  }
  return mode;
}
