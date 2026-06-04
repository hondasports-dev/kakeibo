import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/render";
import { AiExpenseQueuePanel, type AiExpenseQueueItem } from "./AiExpenseQueuePanel";

const queueItems: AiExpenseQueueItem[] = [
  {
    id: "draft-ready",
    fileName: "ok-receipt.png",
    status: "ready",
    documentType: "receipt",
    title: "スーパー北浜",
    amountYen: 4280,
  },
  {
    id: "draft-review",
    fileName: "review-payment.png",
    status: "needs_review",
    documentType: "convenience_payment",
    title: "公共料金",
    amountYen: 9120,
    reviewReasons: ["low_confidence", "missing_required_field"],
  },
  {
    id: "draft-failed",
    fileName: "failed-receipt.png",
    status: "failed",
    documentType: "unknown",
    title: "読み取り失敗",
    reviewReasons: ["parse_failed"],
  },
  {
    id: "draft-registering",
    fileName: "registering-receipt.png",
    status: "registering",
    documentType: "receipt",
    title: "登録中レシート",
    amountYen: 1200,
  },
  {
    id: "draft-registered",
    fileName: "registered-receipt.png",
    status: "registered",
    documentType: "receipt",
    title: "登録済みレシート",
    amountYen: 1800,
  },
];

describe("AiExpenseQueuePanel", () => {
  it("空状態では連続追加できる導線とキューの説明を表示する", () => {
    renderWithProviders(<AiExpenseQueuePanel />);

    expect(screen.getByRole("heading", { name: "AI処理キュー" })).toBeInTheDocument();
    expect(screen.getByText("レシート・払込票をまとめて追加できます。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "画像を追加" })).toBeEnabled();
    expect(screen.getByText("追加した画像はここに状態別で表示されます。")).toBeInTheDocument();
  });

  it("複数画像を選ぶとキューへ解析待ちとして追加される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(screen.getByLabelText("AI処理キューへ画像を追加"), [
      new File(["first"], "first-receipt.png", { type: "image/png" }),
      new File(["second"], "second-payment.png", { type: "image/png" }),
    ]);

    expect(screen.getByText("first-receipt.png")).toBeInTheDocument();
    expect(screen.getByText("second-payment.png")).toBeInTheDocument();
    expect(screen.getAllByText("解析待ち")).toHaveLength(2);
  });

  it("登録準備OK・確認が必要・失敗を分類して表示する", () => {
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    const readySection = screen.getByRole("region", { name: "登録準備OK" });
    expect(within(readySection).getByText("ok-receipt.png")).toBeInTheDocument();
    expect(within(readySection).getByText("4,280円")).toBeInTheDocument();
    expect(within(readySection).queryByText("registering-receipt.png")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登録準備OKをまとめて登録" })).toBeEnabled();

    const reviewSection = screen.getByRole("region", { name: "確認が必要" });
    expect(within(reviewSection).getByText("review-payment.png")).toBeInTheDocument();
    expect(within(reviewSection).getByText("信頼度が低い項目があります")).toBeInTheDocument();
    expect(within(reviewSection).getByText("必須項目を確認してください")).toBeInTheDocument();
    expect(within(reviewSection).getByRole("button", { name: "下書きを確認" })).toBeEnabled();

    const failedSection = screen.getByRole("region", { name: "失敗" });
    expect(within(failedSection).getByText("failed-receipt.png")).toBeInTheDocument();
    expect(within(failedSection).getByRole("button", { name: "手入力へ戻る" })).toBeEnabled();
    expect(within(failedSection).getByRole("button", { name: "再試行" })).toBeEnabled();

    const processingSection = screen.getByRole("region", { name: "AI処理中" });
    expect(within(processingSection).getByText("registering-receipt.png")).toBeInTheDocument();
    expect(within(processingSection).getByText("登録中")).toBeInTheDocument();

    const registeredSection = screen.getByRole("region", { name: "登録済み" });
    expect(within(registeredSection).getByText("registered-receipt.png")).toBeInTheDocument();
  });
});
