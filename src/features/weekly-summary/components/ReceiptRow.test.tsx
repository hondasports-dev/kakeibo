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

    await user.click(screen.getByRole("button", { name: "スーパーA（6/21）を編集" }));
    await user.click(screen.getByRole("button", { name: "スーパーA（6/21）を削除" }));

    expect(onEdit).toHaveBeenCalledWith(sampleReceipt);
    expect(onDelete).toHaveBeenCalledWith(sampleReceipt);
  });

  it("短いメモは全文を表示する", () => {
    renderWithProviders(<ReceiptRow receipt={{ ...sampleReceipt, memo: "夕食の買い物" }} />);

    expect(screen.getByText("夕食の買い物")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("長いメモは省略表示し、展開すると全文が見える", async () => {
    const user = userEvent.setup();
    const longMemo = "あ".repeat(50);

    renderWithProviders(<ReceiptRow receipt={{ ...sampleReceipt, memo: longMemo }} />);

    expect(screen.getByText(`${"あ".repeat(40)}…`)).toBeInTheDocument();
    expect(screen.getByText(longMemo)).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "もっと見る" }));

    expect(screen.getByText(longMemo)).toBeVisible();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
  });

  it("メモがない場合はメモ行を表示しない", () => {
    renderWithProviders(<ReceiptRow receipt={sampleReceipt} />);

    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
    expect(screen.queryByText("メモあり")).not.toBeInTheDocument();
  });
});
