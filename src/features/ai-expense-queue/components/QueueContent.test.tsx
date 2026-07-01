import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueueContent } from "./QueueContent";
import type { AiExpenseQueueItem } from "../types/types";

const registeredItem: AiExpenseQueueItem = {
  id: "draft-registered-long-name",
  fileName: "17824771095466150171181650108301.jpg",
  status: "registered",
  documentType: "receipt",
  title: "ジャパン 明石稲美店",
  amountYen: 235,
  date: "2026-06-26",
  categoryName: "日用品",
};

function renderQueueContent(groupedItems: {
  processing: AiExpenseQueueItem[];
  ready: AiExpenseQueueItem[];
  needs_review: AiExpenseQueueItem[];
  failed: AiExpenseQueueItem[];
  registered: AiExpenseQueueItem[];
}) {
  const items = Object.values(groupedItems).flat();
  return render(
    <QueueContent
      clearableCount={0}
      deletingIds={[]}
      groupedItems={groupedItems}
      itemCount={items.length}
      readyItems={groupedItems.ready}
      registeringIds={[]}
      registrationError=""
      selectedReadyIds={[]}
      onClearOpenQueue={vi.fn(async () => {})}
      onDeleteQueueItem={vi.fn(async () => {})}
      onOpenReview={vi.fn()}
      onRegisterReady={vi.fn(async () => {})}
      onRetry={vi.fn(async () => {})}
      onToggleReadySelection={vi.fn()}
    />,
  );
}

describe("QueueContent モバイル表示", () => {
  it("ステータスサマリーに折り返し用クラスと flexWrap を付ける", () => {
    const { container } = renderQueueContent({
      processing: [],
      ready: [],
      needs_review: [],
      failed: [],
      registered: [registeredItem],
    });

    const summary = container.querySelector(".ai-expense-queue-status-summary");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveStyle({ flexWrap: "wrap", width: "100%" });
  });

  it("長いファイル名は折り返し用クラスと title を付ける", () => {
    renderQueueContent({
      processing: [],
      ready: [],
      needs_review: [],
      failed: [],
      registered: [registeredItem],
    });

    const fileName = screen.getByText(registeredItem.fileName!);
    expect(fileName).toHaveClass("ai-expense-queue-item-secondary");
    expect(fileName).toHaveAttribute("title", registeredItem.fileName);
  });
});

describe("QueueContent の一覧制御", () => {
  it("登録済みは初期3件に絞り、残件を明示して展開できる", async () => {
    const user = userEvent.setup();
    const registered = Array.from({ length: 5 }, (_, index) => ({
      ...registeredItem,
      id: `registered-${index}`,
      title: `登録済み ${index + 1}`,
    }));
    renderQueueContent({ processing: [], ready: [], needs_review: [], failed: [], registered });

    expect(screen.getAllByText(/登録済み [1-3]$/)).toHaveLength(3);
    expect(screen.queryByText("登録済み 4")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "残り2件を見る" }));
    expect(screen.getByText("登録済み 5")).toBeInTheDocument();
  });

  it("確認対象を金額不一致、カテゴリ、その他の順に並べる", () => {
    const items: AiExpenseQueueItem[] = [
      {
        ...registeredItem,
        id: "other",
        status: "needs_review",
        title: "その他",
        reviewReasons: ["low_confidence"],
      },
      {
        ...registeredItem,
        id: "category",
        status: "needs_review",
        title: "カテゴリ",
        reviewReasons: ["ambiguous_category"],
      },
      {
        ...registeredItem,
        id: "amount",
        status: "needs_review",
        title: "金額",
        reviewReasons: ["amount_mismatch"],
      },
    ];
    const { container } = renderQueueContent({
      processing: [],
      ready: [],
      needs_review: items,
      failed: [],
      registered: [],
    });
    const titles = [...container.querySelectorAll(".ai-expense-queue-item-title")].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(["金額", "カテゴリ", "その他"]);
  });
});
