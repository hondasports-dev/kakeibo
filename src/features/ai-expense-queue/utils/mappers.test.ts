import { describe, expect, it } from "vitest";
import { mapDraftToQueueItem } from "./mappers";

describe("mapDraftToQueueItem", () => {
  it("統合済みの払込票は店名・内容を一覧タイトルに使う", () => {
    const item = mapDraftToQueueItem(
      {
        _id: "draft-payment",
        status: "ready",
        documentType: "convenience_payment",
        shopName: "大阪市水道局 水道料金",
        reviewReasons: [],
      },
      {},
    );

    expect(item.title).toBe("大阪市水道局 水道料金");
  });
});
