import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseEntryEditDialog } from "./ExpenseEntryEditDialog";

const {
  updateExpenseEntryMock,
  updateReceiptMock,
  updateRegisteredDraftMock,
  useMutationMock,
  useQueryMock,
} = vi.hoisted(() => ({
  updateExpenseEntryMock: vi.fn(),
  updateReceiptMock: vi.fn(),
  updateRegisteredDraftMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("convex/react", () => ({ useMutation: useMutationMock, useQuery: useQueryMock }));
vi.mock("../../../lib/repositories/expenseEntries", () => ({
  updateExpenseEntryApi: () => "updateExpenseEntry",
}));
vi.mock("../../../lib/repositories/receipts", () => ({
  updateReceiptApi: () => "updateReceipt",
}));
vi.mock("../../../lib/repositories/aiExpenseDrafts", () => ({
  getWithItemsApi: () => "getWithItems",
  updateRegisteredDraftApi: () => "updateRegisteredDraft",
}));

describe("ExpenseEntryEditDialog AI draft history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateRegisteredDraftMock.mockResolvedValue(undefined);
    useQueryMock.mockReturnValue({
      draft: { _id: "draft-1" },
      items: [
        {
          _id: "item-1",
          itemName: "OCR商品",
          amountYen: 1200,
          categoryId: "cat-food",
        },
      ],
    });
    useMutationMock.mockImplementation((reference: string) => {
      if (reference === "updateRegisteredDraft") return updateRegisteredDraftMock;
      if (reference === "updateReceipt") return updateReceiptMock;
      return updateExpenseEntryMock;
    });
  });

  it("合計だけで保存した履歴は下書き専用mutationで同じ支出を更新する", async () => {
    render(
      <ExpenseEntryEditDialog
        categories={[{ _id: "cat-food", name: "食費" }]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        open
        receipt={{
          _id: "entry-1",
          date: "2026-08-26",
          type: "expense",
          shopName: "スーパー青葉",
          amountYen: 1500,
          categoryId: "cat-food",
          categoryName: "食費",
          categoryColor: "#f97316",
          recordType: "expenseEntry",
          receiptShopName: "スーパー青葉",
          receiptTotalAmountYen: 1500,
          aiExpenseDraftId: "draft-1",
          registrationMode: "totalOnly",
        }}
      />,
    );

    expect(screen.getByRole("combobox", { name: "登録方法" })).toHaveTextContent(
      "レシート合計だけで保存",
    );
    expect(screen.getByText(/OCRの商品明細と税内訳は集計に使われません/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("金額"), { target: { value: "1600" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateRegisteredDraftMock).toHaveBeenCalledWith({
        draftId: "draft-1",
        date: "2026-08-26",
        amountYen: 1600,
        categoryId: "cat-food",
        shopName: "スーパー青葉",
        registrationMode: "totalOnly",
      }),
    );
    expect(updateExpenseEntryMock).not.toHaveBeenCalled();
  });

  it("履歴で保存済みOCR明細を修正してdetailedへ切り替えられる", async () => {
    render(
      <ExpenseEntryEditDialog
        categories={[{ _id: "cat-food", name: "食費" }]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        open
        receipt={{
          _id: "entry-1",
          date: "2026-08-26",
          type: "expense",
          shopName: "スーパー青葉",
          amountYen: 1500,
          categoryId: "cat-food",
          categoryName: "食費",
          categoryColor: "#f97316",
          recordType: "expenseEntry",
          receiptShopName: "スーパー青葉",
          receiptTotalAmountYen: 1500,
          aiExpenseDraftId: "draft-1",
          registrationMode: "totalOnly",
        }}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "登録方法" }));
    fireEvent.click(screen.getByRole("option", { name: "明細ごとに保存" }));
    fireEvent.click(screen.getByRole("button", { name: "明細1を削除" }));
    fireEvent.click(screen.getByRole("button", { name: "明細を追加" }));
    fireEvent.change(screen.getByLabelText("明細名 1"), { target: { value: "確定商品" } });
    fireEvent.change(screen.getByLabelText("明細金額 1"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(updateRegisteredDraftMock).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationMode: "detailed",
          items: [
            {
              itemId: undefined,
              itemName: "確定商品",
              amountYen: 1500,
              categoryId: "cat-food",
            },
          ],
        }),
      ),
    );
  });
});
