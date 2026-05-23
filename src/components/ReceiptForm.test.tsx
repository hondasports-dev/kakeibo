import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { renderWithProviders } from "../test/render";
import { ReceiptForm } from "./ReceiptForm";

const { createReceiptMock } = vi.hoisted(() => ({
  createReceiptMock: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    receipts: {
      createReceipt: "receipts.createReceipt",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => createReceiptMock,
}));

const categories = [
  { _id: "cat-food" as Id<"categories">, name: "食費", color: "#2563EB" },
  { _id: "cat-daily" as Id<"categories">, name: "日用品", color: "#16A34A" },
];

describe("ReceiptForm", () => {
  beforeEach(() => {
    createReceiptMock.mockReset();
    createReceiptMock.mockResolvedValue(undefined);
  });

  it("未入力の店舗名と金額は保存せず、バリデーションエラーを表示する", async () => {
    // Given: 週次入力フォームが初期表示されている
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );

    // When: 必須項目を空のまま保存する
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    // Then: 保存APIは呼ばれず、入力エラーが表示される
    expect(createReceiptMock).not.toHaveBeenCalled();
    expect(await screen.findByText("店舗名は必須です")).toBeInTheDocument();
    expect(screen.getByText("金額は必須です")).toBeInTheDocument();
  });

  it("金額フィールドに数字を入力するとカンマ区切りで表示される", async () => {
    // Given: 週次入力フォームが初期表示されている
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const amountInput = screen.getByLabelText("合計金額");

    // When: 7桁の金額を入力する
    await user.type(amountInput, "1234567");

    // Then: 3桁カンマ区切りで表示される
    expect(amountInput).toHaveValue("1,234,567");
  });

  it("金額フィールドに英字・記号を入力しても反映されない", async () => {
    // Given: 週次入力フォームが初期表示されている
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const amountInput = screen.getByLabelText("合計金額");

    // When: 英字・記号を入力する
    await user.type(amountInput, "abc!@#");

    // Then: フィールドは空のまま
    expect(amountInput).toHaveValue("");
  });

  it("金額フィールドに数字と英字を混在入力すると数字のみが反映される", async () => {
    // Given: 週次入力フォームが初期表示されている
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const amountInput = screen.getByLabelText("合計金額");

    // When: 数字と英字を混在入力する
    await user.type(amountInput, "1a2b3c");

    // Then: 数字のみが表示される（カンマ区切り）
    expect(amountInput).toHaveValue("123");
  });

  it("正常入力を保存し、連続入力できるように店舗名・金額・メモだけを空に戻す", async () => {
    // Given: レシート入力に必要なカテゴリと週の日付がある
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );

    // When: 店舗名、金額、カテゴリ、メモを入力して保存する
    await user.type(screen.getByLabelText("店舗名"), "スーパー北浜");
    await user.type(screen.getByLabelText("合計金額"), "4280");
    await user.click(screen.getByRole("option", { name: "日用品" }));
    await user.type(screen.getByLabelText("メモ"), "特売日");
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    // Then: Convex mutationに正規化された値が渡り、連続入力用の状態に戻る
    await waitFor(() => {
      expect(createReceiptMock).toHaveBeenCalledWith({
        date: "2026-05-18",
        shopName: "スーパー北浜",
        amountYen: 4280,
        categoryId: "cat-daily",
        memo: "特売日",
      });
    });
    expect(screen.getByLabelText("店舗名")).toHaveValue("");
    expect(screen.getByLabelText("合計金額")).toHaveValue("");
    expect(screen.getByLabelText("メモ")).toHaveValue("");
    expect(screen.getByRole("option", { name: "日用品 選択中" })).toBeInTheDocument();
    expect(screen.getByText("レシートを保存しました")).toBeInTheDocument();
  });
});
