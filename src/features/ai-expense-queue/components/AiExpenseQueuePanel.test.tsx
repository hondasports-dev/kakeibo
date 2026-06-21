import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { AiExpenseQueuePanel } from "./AiExpenseQueuePanel";
import { categories, queueItems, rejectImageDecoding } from "../utils/testFixtures";

const {
  registerReadyDraftsMock,
  updateForReviewMock,
  createBatchMock,
  analyzeImageJobMock,
  retryImageJobMock,
  cancelImageJobMock,
  deleteDraftMock,
  acceptReceiptImageExternalApiConsentMock,
  useQueryMock,
} = vi.hoisted(() => ({
  registerReadyDraftsMock: vi.fn(),
  updateForReviewMock: vi.fn(),
  createBatchMock: vi.fn(),
  analyzeImageJobMock: vi.fn(),
  retryImageJobMock: vi.fn(),
  cancelImageJobMock: vi.fn(),
  deleteDraftMock: vi.fn(),
  acceptReceiptImageExternalApiConsentMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    aiExpenseDrafts: {
      queries: {
        getWithItems: "aiExpenseDrafts.queries.getWithItems",
        listByStatus: "aiExpenseDrafts.queries.listByStatus",
      },
      mutations: {
        registerReadyDrafts: "aiExpenseDrafts.mutations.registerReadyDrafts",
        updateForReview: "aiExpenseDrafts.mutations.updateForReview",
        deleteDraft: "aiExpenseDrafts.mutations.deleteDraft",
      },
    },
    receiptAnalysisJobs: {
      queries: {
        listJobs: "receiptAnalysisJobs.queries.listJobs",
      },
      mutations: {
        createBatch: "receiptAnalysisJobs.mutations.createBatch",
        retryImageJob: "receiptAnalysisJobs.mutations.retryImageJob",
        cancelImageJob: "receiptAnalysisJobs.mutations.cancelImageJob",
      },
      actions: {
        analyzeImageJob: "receiptAnalysisJobs.actions.analyzeImageJob",
      },
    },
    users: {
      queries: {
        getReceiptImageConsent: "users.queries.getReceiptImageConsent",
      },
      mutations: {
        acceptReceiptImageExternalApiConsent:
          "users.mutations.acceptReceiptImageExternalApiConsent",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    if (reference === "aiExpenseDrafts.mutations.updateForReview") return updateForReviewMock;
    if (reference === "aiExpenseDrafts.mutations.deleteDraft") return deleteDraftMock;
    if (reference === "receiptAnalysisJobs.mutations.createBatch") return createBatchMock;
    if (reference === "receiptAnalysisJobs.mutations.retryImageJob") return retryImageJobMock;
    if (reference === "receiptAnalysisJobs.mutations.cancelImageJob") return cancelImageJobMock;
    if (reference === "users.mutations.acceptReceiptImageExternalApiConsent") {
      return acceptReceiptImageExternalApiConsentMock;
    }
    return registerReadyDraftsMock;
  },
  useAction: (reference: string) => {
    if (reference === "receiptAnalysisJobs.actions.analyzeImageJob") return analyzeImageJobMock;
    return vi.fn();
  },
  useQuery: (reference: string, args: unknown) => useQueryMock(reference, args),
}));

describe("AiExpenseQueuePanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.mocked(globalThis.createImageBitmap).mockResolvedValue({
      width: 100,
      height: 100,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    registerReadyDraftsMock.mockReset();
    registerReadyDraftsMock.mockResolvedValue(undefined);
    updateForReviewMock.mockReset();
    updateForReviewMock.mockResolvedValue(undefined);
    createBatchMock.mockReset();
    createBatchMock.mockResolvedValue({
      batch: { _id: "batch-1" },
      jobs: [{ _id: "job-1" }, { _id: "job-2" }],
    });
    analyzeImageJobMock.mockReset();
    analyzeImageJobMock.mockResolvedValue(undefined);
    retryImageJobMock.mockReset();
    retryImageJobMock.mockResolvedValue(undefined);
    cancelImageJobMock.mockReset();
    cancelImageJobMock.mockResolvedValue(undefined);
    deleteDraftMock.mockReset();
    deleteDraftMock.mockResolvedValue({ deleted: true });
    acceptReceiptImageExternalApiConsentMock.mockReset();
    acceptReceiptImageExternalApiConsentMock.mockResolvedValue(undefined);
    useQueryMock.mockReset();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: true, acceptedAt: 1234567890 };
      }
      return [];
    });
  });

  it("空状態では連続追加できる導線とキューの説明を表示する", () => {
    renderWithProviders(<AiExpenseQueuePanel />);

    expect(screen.getByRole("heading", { name: "AI処理キュー" })).toBeInTheDocument();
    expect(screen.getByText("レシート・払込票をまとめて追加できます。")).toBeInTheDocument();
    expect(
      screen.getByText("スマートフォンでは撮影、PCでは画像選択から追加できます。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "撮影する" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "画像を追加" })).toBeEnabled();
    expect(screen.getByLabelText("AI処理キューへカメラで追加")).toHaveAttribute(
      "capture",
      "environment",
    );
    expect(screen.getByText("追加した画像はここに状態別で表示されます。")).toBeInTheDocument();
  });

  it("画像送信の同意状態を読み込み中は画像追加導線を無効化する", () => {
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") return undefined;
      return [];
    });

    renderWithProviders(<AiExpenseQueuePanel />);

    expect(screen.getByRole("button", { name: "撮影する" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "画像を追加" })).toBeDisabled();
    expect(screen.getByLabelText("AI処理キューへカメラで追加")).toBeDisabled();
    expect(screen.getByLabelText("AI処理キューへ画像を追加")).toBeDisabled();
  });

  it("複数画像を選ぶとキューへ解析待ちとして追加される", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") {
        return [
          { _id: "job-1", fileName: "first-receipt.png", status: "queued" },
          { _id: "job-2", fileName: "second-payment.png", status: "queued" },
        ];
      }
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: true, acceptedAt: 1234567890 };
      }
      return [];
    });
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(screen.getByLabelText("AI処理キューへ画像を追加"), [
      new File(["first"], "first-receipt.png", { type: "image/png" }),
      new File(["second"], "second-payment.png", { type: "image/png" }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("first-receipt.png")).toBeInTheDocument();
      expect(screen.getByText("second-payment.png")).toBeInTheDocument();
      expect(screen.getAllByText("解析待ち")).toHaveLength(2);
    });

    expect(createBatchMock).toHaveBeenCalledWith({
      fileNames: ["first-receipt.png", "second-payment.png"],
    });
    expect(analyzeImageJobMock).toHaveBeenCalledTimes(2);
    expect(analyzeImageJobMock).toHaveBeenCalledWith({
      jobId: "job-1",
      imageDataUrl: "data:image/jpeg;base64,mockBase64Data",
    });
  });

  it("画像送信に未同意なら同意ダイアログを表示して解析を開始しない", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: false, acceptedAt: null };
      }
      return [];
    });
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "画像の外部API送信に同意しますか" }),
    ).toBeInTheDocument();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
  });

  it("画像送信に同意すると保留した画像の解析を開始する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: false, acceptedAt: null };
      }
      return [];
    });
    createBatchMock.mockResolvedValueOnce({
      batch: { _id: "batch-consent-1" },
      jobs: [{ _id: "job-consent-1" }],
    });
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "同意して読み取る" }));

    await waitFor(() => {
      expect(acceptReceiptImageExternalApiConsentMock).toHaveBeenCalledTimes(1);
      expect(createBatchMock).toHaveBeenCalledWith({ fileNames: ["receipt.png"] });
      expect(analyzeImageJobMock).toHaveBeenCalledWith({
        jobId: "job-consent-1",
        imageDataUrl: "data:image/jpeg;base64,mockBase64Data",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("画像送信への同意を断ると保留した画像を破棄する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: false, acceptedAt: null };
      }
      return [];
    });
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "手入力する" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(acceptReceiptImageExternalApiConsentMock).not.toHaveBeenCalled();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
  });

  it("画像送信の同意保存に失敗したら解析せずエラーを表示する", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: false, acceptedAt: null };
      }
      return [];
    });
    acceptReceiptImageExternalApiConsentMock.mockRejectedValueOnce(
      new Error("同意状態の保存に失敗しました"),
    );
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "同意して読み取る" }));

    expect(await screen.findByText("同意状態の保存に失敗しました")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
  });

  it("画像送信の同意保存中はダイアログを閉じない", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: false, acceptedAt: null };
      }
      return [];
    });
    acceptReceiptImageExternalApiConsentMock.mockReturnValueOnce(new Promise(() => {}));
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "同意して読み取る" }));
    fireEvent.keyDown(screen.getAllByRole("presentation")[0], { key: "Escape", code: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
    expect(createBatchMock).not.toHaveBeenCalled();
  });

  it("撮影導線から画像を追加してもキューへ解析待ちとして追加される", async () => {
    const user = userEvent.setup();
    createBatchMock.mockResolvedValueOnce({
      batch: { _id: "batch-camera-1" },
      jobs: [{ _id: "job-camera-1" }, { _id: "job-camera-2" }],
    });
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") {
        return [{ _id: "job-camera-1", fileName: "camera-receipt.png", status: "queued" }];
      }
      if (reference === "users.queries.getReceiptImageConsent") {
        return { hasAcceptedExternalApiConsent: true, acceptedAt: 1234567890 };
      }
      return [];
    });
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(screen.getByLabelText("AI処理キューへカメラで追加"), [
      new File(["camera"], "camera-receipt.png", { type: "image/png" }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("camera-receipt.png")).toBeInTheDocument();
      expect(screen.getByText("解析待ち")).toBeInTheDocument();
    });

    expect(createBatchMock).toHaveBeenCalledWith({
      fileNames: ["camera-receipt.png"],
    });
    expect(analyzeImageJobMock).toHaveBeenCalledWith({
      jobId: "job-camera-1",
      imageDataUrl: "data:image/jpeg;base64,mockBase64Data",
    });
  });

  it("画像追加時の読み込み失敗をUIエラーとして表示する", async () => {
    const user = userEvent.setup();
    const createImageBitmapSpy = rejectImageDecoding();
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("AI処理キューへ画像を追加"),
      new File(["broken"], "broken-receipt.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/画像の読み込みに失敗しました/)).toBeInTheDocument();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
    createImageBitmapSpy.mockRestore();
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

  it("失敗ジョブの画像を選び直して再試行できる", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") {
        return [
          {
            _id: "job-failed",
            draftId: "draft-failed",
            fileName: "failed-receipt.png",
            status: "failed",
          },
        ];
      }
      return [];
    });

    renderWithProviders(<AiExpenseQueuePanel initialItems={[queueItems[2]]} />);

    await user.click(screen.getByRole("button", { name: "再試行" }));
    await user.upload(
      screen.getByLabelText("再試行する画像を選択"),
      new File(["retry"], "failed-receipt-retry.png", { type: "image/png" }),
    );

    await waitFor(() => {
      expect(retryImageJobMock).toHaveBeenCalledWith({ jobId: "job-failed" });
      expect(analyzeImageJobMock).toHaveBeenCalledWith({
        jobId: "job-failed",
        imageDataUrl: "data:image/jpeg;base64,mockBase64Data",
      });
    });
  });

  it("失敗下書きから手入力へ戻るとキューから削除する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={[queueItems[2]]} />);

    await user.click(screen.getByRole("button", { name: "手入力へ戻る" }));

    await waitFor(() => {
      expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-failed" });
    });
    expect(screen.queryByText("failed-receipt.png")).not.toBeInTheDocument();
  });

  it("処理中ジョブをキューから削除できる", async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") {
        return [
          {
            _id: "job-running",
            fileName: "running-receipt.png",
            status: "running",
          },
        ];
      }
      return [];
    });

    renderWithProviders(<AiExpenseQueuePanel />);

    const processingSection = screen.getByRole("region", { name: "AI処理中" });
    await user.click(within(processingSection).getByRole("button", { name: "キューから削除" }));

    await waitFor(() => {
      expect(cancelImageJobMock).toHaveBeenCalledWith({ jobId: "job-running" });
    });
    expect(screen.queryByText("running-receipt.png")).not.toBeInTheDocument();
  });

  it("未登録のキューをまとめてクリアできる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    await user.click(screen.getByRole("button", { name: "未登録のキューをクリア（3件）" }));

    await waitFor(() => {
      expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-ready" });
      expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-review" });
      expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-failed" });
    });
    expect(screen.queryByText("ok-receipt.png")).not.toBeInTheDocument();
    expect(screen.queryByText("review-payment.png")).not.toBeInTheDocument();
    expect(screen.queryByText("failed-receipt.png")).not.toBeInTheDocument();
    expect(screen.getByText("registered-receipt.png")).toBeInTheDocument();
  });

  it("再試行画像の読み込み失敗をUIエラーとして表示する", async () => {
    const user = userEvent.setup();
    const createImageBitmapSpy = rejectImageDecoding();
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") {
        return [
          {
            _id: "job-failed",
            draftId: "draft-failed",
            fileName: "failed-receipt.png",
            status: "failed",
          },
        ];
      }
      return [];
    });

    renderWithProviders(<AiExpenseQueuePanel initialItems={[queueItems[2]]} />);

    await user.click(screen.getByRole("button", { name: "再試行" }));
    await user.upload(
      screen.getByLabelText("再試行する画像を選択"),
      new File(["broken"], "failed-receipt-retry.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/画像の読み込みに失敗しました/)).toBeInTheDocument();
    expect(retryImageJobMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
    createImageBitmapSpy.mockRestore();
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
      if (reference !== "aiExpenseDrafts.queries.getWithItems" || args === "skip") {
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
      if (reference === "aiExpenseDrafts.queries.getWithItems" && args !== "skip") {
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
      if (reference === "aiExpenseDrafts.queries.getWithItems" && args !== "skip") {
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

  it("登録済みアイテムに日付とカテゴリが表示される", () => {
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} categories={categories} />);

    const registeredSection = screen.getByRole("region", { name: "登録済み" });
    expect(within(registeredSection).getByText("5/20")).toBeInTheDocument();
    expect(within(registeredSection).getByText("日用品")).toBeInTheDocument();
  });
});
