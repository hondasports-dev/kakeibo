import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import type { ReceiptItem } from "../types/types";
import { ReceiptListCard } from "./ReceiptListCard";

const receipts: ReceiptItem[] = Array.from({ length: 7 }, (_, index) => ({
  _id: `entry-${index}`,
  date: `2026-06-${String(21 - index).padStart(2, "0")}`,
  shopName: `店舗${index + 1}`,
  amountYen: 1_000 + index,
  categoryId: "food",
  categoryName: "食費",
  categoryColor: "#f97316",
  recordType: "expenseEntry",
}));

describe("ReceiptListCard", () => {
  it("初期表示を5件に制限し残件数を示して全件展開する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReceiptListCard count={7} isLoading={false} receipts={receipts} />);

    expect(screen.getAllByTestId("receipt-row")).toHaveLength(5);
    const showMore = screen.getByRole("button", { name: "さらに2件を見る" });
    await user.click(showMore);

    expect(screen.getAllByTestId("receipt-row")).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "さらに2件を見る" })).not.toBeInTheDocument();
  });

  it("PC一覧用の列見出しを提供する", () => {
    renderWithProviders(
      <ReceiptListCard count={1} isLoading={false} receipts={receipts.slice(0, 1)} />,
    );

    for (const label of ["日付", "店名・内容", "カテゴリ", "金額（円）", "メモ", "操作"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
