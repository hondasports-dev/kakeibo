import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { ReceiptRow } from "./ReceiptRow";
import type { ReceiptItem } from "../types/types";

const sampleReceipt: ReceiptItem = {
  _id: "entry-001",
  date: "2026-06-21",
  type: "expense",
  shopName: "スーパーA",
  amountYen: 1280,
  categoryId: "cat-food",
  categoryName: "食費",
  categoryColor: "#AAB7C4",
  recordType: "expenseEntry",
};

describe("ReceiptRow", () => {
  it("編集と削除ボタンからコールバックを呼び出す", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderWithProviders(<ReceiptRow receipt={sampleReceipt} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(onEdit).toHaveBeenCalledWith(sampleReceipt);
    expect(onDelete).toHaveBeenCalledWith(sampleReceipt);
  });
});
