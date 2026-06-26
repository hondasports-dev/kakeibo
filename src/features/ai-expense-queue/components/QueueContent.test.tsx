import { render, screen } from "@testing-library/react";
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
  it("ステータスサマリーに折り返し用クラスを付ける", () => {
    const { container } = renderQueueContent({
      processing: [],
      ready: [],
      needs_review: [],
      failed: [],
      registered: [registeredItem],
    });

    expect(container.querySelector(".ai-expense-queue-status-summary")).toBeInTheDocument();
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
