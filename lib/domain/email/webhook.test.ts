import { describe, expect, it } from "vitest";
import { resolveStatusAndSuppression } from "./webhook";

describe("resolveStatusAndSuppression", () => {
  it.each([
    ["email.sent", {}, { statusUpdate: "sent" }],
    ["email.delivered", {}, { statusUpdate: "delivered" }],
    ["email.delivery_delayed", {}, undefined],
    [
      "email.complained",
      { complaint: { type: "abuse" } },
      { statusUpdate: "complained", suppressionReason: "complaint", suppressionSource: "abuse" },
    ],
    [
      "email.bounced",
      { bounce: { type: "bounce" } },
      { statusUpdate: "bounced", suppressionReason: "bounce", suppressionSource: "bounce" },
    ],
    [
      "email.suppressed",
      { suppressed: { type: "hard_bounce" } },
      {
        statusUpdate: "suppressed",
        suppressionReason: "provider_suppressed",
        suppressionSource: "hard_bounce",
      },
    ],
    ["email.failed", {}, { statusUpdate: "failed" }],
  ] as const)("%s -> %o", (eventType, data, expected) => {
    expect(resolveStatusAndSuppression(eventType as never, data as never)).toEqual(expected);
  });

  it("未知のイベントタイプは undefined", () => {
    expect(resolveStatusAndSuppression("email.opened" as never, {})).toBeUndefined();
  });
});
