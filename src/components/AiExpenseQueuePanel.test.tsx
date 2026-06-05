import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { AiExpenseQueuePanel, type AiExpenseQueueItem } from "./AiExpenseQueuePanel";

const { registerReadyDraftsMock, updateForReviewMock, useQueryMock } = vi.hoisted(() => ({
  registerReadyDraftsMock: vi.fn(),
  updateForReviewMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    aiExpenseDrafts: {
      getWithItems: "aiExpenseDrafts.getWithItems",
      listByStatus: "aiExpenseDrafts.listByStatus",
      registerReadyDrafts: "aiExpenseDrafts.registerReadyDrafts",
      updateForReview: "aiExpenseDrafts.updateForReview",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    if (reference === "aiExpenseDrafts.updateForReview") return updateForReviewMock;
    return registerReadyDraftsMock;
  },
  useQuery: (reference: string, args: unknown) => useQueryMock(reference, args),
}));

const categories = [
  { _id: "cat-food", name: "食費", color: "#2563EB" },
  { _id: "cat-daily", name: "日用品", color: "#16A34A" },
];

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
  beforeEach(() => {
    registerReadyDraftsMock.mockReset();
    registerReadyDraftsMock.mockResolvedValue(undefined);
    updateForReviewMock.mockReset();
    updateForReviewMock.mockResolvedValue(undefined);
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue([]);
  });

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
    expect(
      screen.getByRole("button", { name: "選択中の登録準備OKをまとめて登録（1件）" }),
    ).toBeEnabled();
    expect(
      within(readySection).getByRole("checkbox", { name: "スーパー北浜を登録対象に含める" }),
    ).toBeChecked();

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

  it("選択した ready 下書きだけまとめて登録する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    await user.click(screen.getByRole("checkbox", { name: "スーパー北浜を登録対象に含める" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "選択中の登録準備OKをまとめて登録（0件）" }),
      ).toBeDisabled();
    });

    await user.click(screen.getByRole("checkbox", { name: "スーパー北浜を登録対象に含める" }));
    await user.click(
      screen.getByRole("button", { name: "選択中の登録準備OKをまとめて登録（1件）" }),
    );

    expect(registerReadyDraftsMock).toHaveBeenCalledWith({ draftIds: ["draft-ready"] });
  });

  it("確認が必要な下書きを理由表示つきで編集し、そのまま登録する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, args: { draftId?: string } | "skip") => {
      if (reference !== "aiExpenseDrafts.getWithItems" || args === "skip") {
        return [];
      }
      return {
        draft: {
          _id: args.draftId,
          status: "needs_review",
          documentType: "receipt",
          shopName: "",
          paymentPlace: "",
          payeeName: "スーパー青葉",
          paymentPurpose: "",
          date: "2026-06-01",
          amountYen: 9120,
          categoryId: "cat-daily",
          reviewReasons: ["low_confidence", "missing_required_field"],
          warnings: ["店名が読み取れませんでした"],
        },
        items: [],
      };
    });

    renderWithProviders(
      <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
    );

    await user.click(screen.getByRole("button", { name: "下書きを確認" }));

    expect(screen.getByRole("heading", { name: "下書き確認" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("信頼度が低い項目があります")).toBeInTheDocument();
    expect(within(dialog).getByText("必須項目を確認してください")).toBeInTheDocument();

    await user.type(screen.getByLabelText("店名"), "スーパー青葉");
    await user.clear(screen.getByLabelText("合計金額"));
    await user.type(screen.getByLabelText("合計金額"), "1680");
    await user.click(screen.getByRole("button", { name: "修正して登録" }));

    expect(updateForReviewMock).toHaveBeenCalledWith({
      draftId: "draft-review",
      documentType: "receipt",
      shopName: "スーパー青葉",
      paymentPlace: "",
      payeeName: "スーパー青葉",
      paymentPurpose: "",
      date: "2026-06-01",
      amountYen: 1680,
      categoryId: "cat-daily",
    });
    expect(registerReadyDraftsMock).toHaveBeenCalledWith({ draftIds: ["draft-review"] });
  });

  it("確認下書きの詳細読み込み前はフォーム送信できない", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, args: { draftId?: string } | "skip") => {
      if (reference === "aiExpenseDrafts.getWithItems" && args !== "skip") {
        return undefined;
      }
      return [];
    });

    renderWithProviders(
      <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
    );

    await user.click(screen.getByRole("button", { name: "下書きを確認" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("下書きを読み込んでいます。")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "登録準備OKに戻す" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "修正して登録" })).toBeDisabled();
    expect(within(dialog).queryByLabelText("合計金額")).not.toBeInTheDocument();
  });

  it("確認下書きが見つからない場合はローディングを続けずエラーを表示する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, args: { draftId?: string } | "skip") => {
      if (reference === "aiExpenseDrafts.getWithItems" && args !== "skip") {
        return null;
      }
      return [];
    });

    renderWithProviders(
      <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
    );

    await user.click(screen.getByRole("button", { name: "下書きを確認" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("下書きを読み込んでいます。")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "下書きが見つかりません。キューを更新してもう一度確認してください。",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "登録準備OKに戻す" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "修正して登録" })).toBeDisabled();
  });

  it("未判定の書類種別は選択肢に表示せず送信前に止める", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <AiExpenseQueuePanel
        initialItems={[queueItems[1]]}
        categories={categories}
        initialReviewDrafts={{
          "draft-review": {
            _id: "draft-review",
            status: "needs_review",
            documentType: "unknown",
            shopName: "スーパー青葉",
            date: "2026-06-01",
            amountYen: 9120,
            categoryId: "cat-daily",
            reviewReasons: ["ambiguous_document_type"],
          },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "下書きを確認" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("書類種別を選択")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("combobox", { name: "書類種別" }));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).queryByRole("option", { name: "種別未判定" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "登録準備OKに戻す" }));

    expect(within(dialog).getByText("書類種別を選択してください。")).toBeInTheDocument();
    expect(updateForReviewMock).not.toHaveBeenCalled();
  });

  it("確認が必要な下書きを登録準備OKへ戻す送信分岐を呼べる", async () => {
    const user = userEvent.setup();
    const onReviewSubmit = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <AiExpenseQueuePanel
        initialItems={[queueItems[1]]}
        categories={categories}
        initialReviewDrafts={{
          "draft-review": {
            _id: "draft-review",
            status: "needs_review",
            documentType: "convenience_payment",
            paymentPlace: "コンビニ北浜",
            payeeName: "大阪市水道局",
            paymentPurpose: "",
            date: "2026-06-01",
            amountYen: 9120,
            categoryId: "cat-daily",
            reviewReasons: ["missing_required_field"],
          },
        }}
        onReviewSubmit={onReviewSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "下書きを確認" }));
    await user.type(screen.getByLabelText("支払内容"), "水道料金");
    await user.click(screen.getByRole("button", { name: "登録準備OKに戻す" }));

    expect(onReviewSubmit).toHaveBeenCalledWith(
      "draft-review",
      expect.objectContaining({
        documentType: "convenience_payment",
        payeeName: "大阪市水道局",
        paymentPurpose: "水道料金",
        amountYen: 9120,
        categoryId: "cat-daily",
      }),
      false,
    );
    expect(registerReadyDraftsMock).not.toHaveBeenCalled();
  });
});
