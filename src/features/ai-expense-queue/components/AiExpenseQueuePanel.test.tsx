import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { AiExpenseQueuePanel } from "./AiExpenseQueuePanel";
import { categories, queueItems, rejectImageDecoding } from "../utils/testFixtures";

const {
  registerReadyDraftsAsExpenseEntriesMock,
  legacyRegisterReadyDraftsMock,
  updateForReviewMock,
  createBatchMock,
  analyzeImageJobMock,
  retryImageJobMock,
  cancelImageJobMock,
  deleteDraftMock,
  acceptReceiptImageExternalApiConsentMock,
  useQueryMock,
} = vi.hoisted(() => ({
  registerReadyDraftsAsExpenseEntriesMock: vi.fn(),
  legacyRegisterReadyDraftsMock: vi.fn(),
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
        registerReadyDraftsAsExpenseEntries:
          "aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries",
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
    if (reference === "aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries") {
      return registerReadyDraftsAsExpenseEntriesMock;
    }
    if (reference === "aiExpenseDrafts.mutations.registerReadyDrafts") {
      return legacyRegisterReadyDraftsMock;
    }
    if (reference === "aiExpenseDrafts.mutations.deleteDraft") return deleteDraftMock;
    if (reference === "receiptAnalysisJobs.mutations.createBatch") return createBatchMock;
    if (reference === "receiptAnalysisJobs.mutations.retryImageJob") return retryImageJobMock;
    if (reference === "receiptAnalysisJobs.mutations.cancelImageJob") return cancelImageJobMock;
    if (reference === "users.mutations.acceptReceiptImageExternalApiConsent") {
      return acceptReceiptImageExternalApiConsentMock;
    }
    return vi.fn();
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
    registerReadyDraftsAsExpenseEntriesMock.mockReset();
    registerReadyDraftsAsExpenseEntriesMock.mockResolvedValue(undefined);
    legacyRegisterReadyDraftsMock.mockReset();
    legacyRegisterReadyDraftsMock.mockResolvedValue(undefined);
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

  it("空状態では主導線と短い説明だけを表示する", () => {
    renderWithProviders(<AiExpenseQueuePanel />);

    expect(screen.getByRole("heading", { name: "レシート入力" })).toBeInTheDocument();
    expect(screen.queryByText("撮影して、あとでまとめて確認できます。")).not.toBeInTheDocument();
    expect(screen.getByText("まだ下書きはありません")).toBeInTheDocument();
    expect(
      screen.getByText("レシートを追加すると、AIが支出下書きを作ります。"),
    ).toBeInTheDocument();
    expect(screen.queryByText("追加したレシートは状態別に表示されます。")).not.toBeInTheDocument();
    expect(screen.queryByText("レシート・払込票をまとめて追加できます。")).not.toBeInTheDocument();
    expect(
      screen.queryByText("スマートフォンでは撮影、PCでは画像選択から追加できます。"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "レシートを追加" }).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByRole("button", { name: "撮影する" })).toBeEnabled();
    expect(screen.getByLabelText("読み取り用カメラ画像を追加")).toHaveAttribute(
      "capture",
      "environment",
    );
    expect(screen.getByRole("button", { name: "詳しい説明" })).toBeInTheDocument();
  });

  it("画像送信の同意状態を読み込み中は画像追加導線を無効化する", () => {
    useQueryMock.mockImplementation((reference: string, _args: unknown) => {
      if (reference === "receiptAnalysisJobs.queries.listJobs") return [];
      if (reference === "users.queries.getReceiptImageConsent") return undefined;
      return [];
    });

    renderWithProviders(<AiExpenseQueuePanel />);

    expect(screen.getByRole("button", { name: "撮影する" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "レシートを追加" })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByLabelText("読み取り用カメラ画像を追加")).toBeDisabled();
    expect(screen.getByLabelText("読み取り用画像を追加")).toBeDisabled();
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

    await user.upload(screen.getByLabelText("読み取り用画像を追加"), [
      new File(["first"], "first-receipt.png", { type: "image/png" }),
      new File(["second"], "second-payment.png", { type: "image/png" }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("first-receipt.png")).toBeInTheDocument();
      expect(screen.getByText("second-payment.png")).toBeInTheDocument();
      expect(screen.getAllByText("解析中", { exact: true })).toHaveLength(2);
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
      screen.getByLabelText("読み取り用画像を追加"),
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
      screen.getByLabelText("読み取り用画像を追加"),
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
      screen.getByLabelText("読み取り用画像を追加"),
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
      screen.getByLabelText("読み取り用画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "同意して読み取る" }));

    expect(await screen.findByText("同意状態の保存に失敗しました")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
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

    await user.upload(screen.getByLabelText("読み取り用カメラ画像を追加"), [
      new File(["camera"], "camera-receipt.png", { type: "image/png" }),
    ]);

    await waitFor(() => {
      expect(screen.getByText("camera-receipt.png")).toBeInTheDocument();
      expect(screen.getByText("解析中", { exact: true })).toBeInTheDocument();
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
      screen.getByLabelText("読み取り用画像を追加"),
      new File(["broken"], "broken-receipt.png", { type: "image/png" }),
    );

    expect(await screen.findByText(/画像の読み込みに失敗しました/)).toBeInTheDocument();
    expect(createBatchMock).not.toHaveBeenCalled();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
    createImageBitmapSpy.mockRestore();
  });

  it("画像追加バッチの作成に失敗してもエラーを表示してinputをリセットする", async () => {
    const user = userEvent.setup();
    createBatchMock.mockRejectedValueOnce(new Error("画像の追加に失敗しました"));
    renderWithProviders(<AiExpenseQueuePanel />);

    const input = screen.getByLabelText("読み取り用画像を追加") as HTMLInputElement;
    await user.upload(input, new File(["receipt"], "receipt.png", { type: "image/png" }));

    expect(await screen.findByText("画像の追加に失敗しました")).toBeInTheDocument();
    expect(input.files).toHaveLength(0);
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
  });

  it("画像追加バッチを作成できなかった場合もエラーを表示する", async () => {
    const user = userEvent.setup();
    createBatchMock.mockResolvedValueOnce(undefined);
    renderWithProviders(<AiExpenseQueuePanel />);

    await user.upload(
      screen.getByLabelText("読み取り用画像を追加"),
      new File(["receipt"], "receipt.png", { type: "image/png" }),
    );

    expect(
      await screen.findByText("画像の追加に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    expect(analyzeImageJobMock).not.toHaveBeenCalled();
  });

  it("登録準備OK・確認が必要・失敗を分類して表示する", () => {
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    expect(screen.getByText("解析中 0件")).toBeInTheDocument();
    expect(screen.getByText("登録準備OK 2件")).toBeInTheDocument();
    expect(screen.getByText("確認が必要 1件")).toBeInTheDocument();
    expect(screen.getByText("失敗 1件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下書きを確認（1件）" })).toBeEnabled();

    const readySection = screen.getByRole("region", { name: "登録準備OK" });
    expect(within(readySection).getByText("ok-receipt.png")).toBeInTheDocument();
    expect(within(readySection).getByText("2026/05/18 ・ 4,280円")).toBeInTheDocument();
    expect(within(readySection).getByText("registering-receipt.png")).toBeInTheDocument();
    expect(within(readySection).getByText("登録中")).toBeInTheDocument();
    expect(within(readySection).getByRole("button", { name: "登録する" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "まとめて登録（1件）" })).toBeEnabled();
    expect(
      within(readySection).getByRole("checkbox", { name: "スーパー北浜を登録対象に含める" }),
    ).toBeChecked();

    const reviewSection = screen.getByRole("region", { name: "確認が必要" });
    expect(within(reviewSection).getByText("review-payment.png")).toBeInTheDocument();
    expect(within(reviewSection).getByText("低信頼度")).toBeInTheDocument();
    expect(within(reviewSection).getByText("必須項目不足")).toBeInTheDocument();
    expect(within(reviewSection).getByRole("button", { name: "確認する" })).toBeEnabled();

    const failedSection = screen.getByRole("region", { name: "失敗" });
    expect(within(failedSection).getByText("failed-receipt.png")).toBeInTheDocument();
    expect(within(failedSection).getByText("解析失敗")).toBeInTheDocument();
    expect(within(failedSection).getByRole("button", { name: "手入力へ戻る" })).toBeEnabled();
    expect(within(failedSection).getByRole("button", { name: "再試行" })).toBeEnabled();

    expect(screen.queryByRole("region", { name: "読み取り中" })).not.toBeInTheDocument();

    const registeredSection = screen.getByRole("region", { name: "登録済み" });
    expect(within(registeredSection).getByText("registered-receipt.png")).toBeInTheDocument();
  });

  it("登録準備OKカードの主アクションから単体登録できる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    const readySection = screen.getByRole("region", { name: "登録準備OK" });
    await user.click(within(readySection).getByRole("button", { name: "登録する" }));

    expect(registerReadyDraftsAsExpenseEntriesMock).toHaveBeenCalledWith({
      draftIds: ["draft-ready"],
    });
  });

  it("登録準備OKの下書きにカテゴリ別登録候補を表示する", () => {
    renderWithProviders(
      <AiExpenseQueuePanel
        initialItems={[
          {
            ...queueItems[0],
            amountYen: 1380,
            itemTotalYen: 1380,
            itemDifferenceYen: 0,
            categoryAggregates: [
              { categoryId: "cat-food", categoryName: "食費", amountYen: 400 },
              { categoryId: "cat-medical", categoryName: "医療費", amountYen: 980 },
            ],
          },
        ]}
      />,
    );

    const readySection = screen.getByRole("region", { name: "登録準備OK" });
    expect(within(readySection).getByText("カテゴリ別登録候補 1,380円")).toBeInTheDocument();
    expect(within(readySection).getByText("食費 400円")).toBeInTheDocument();
    expect(within(readySection).getByText("医療費 980円")).toBeInTheDocument();
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

  it("失敗下書きから手入力へ戻ると一覧から削除する", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={[queueItems[2]]} />);

    await user.click(screen.getByRole("button", { name: "手入力へ戻る" }));

    await waitFor(() => {
      expect(deleteDraftMock).toHaveBeenCalledWith({ draftId: "draft-failed" });
    });
    expect(screen.queryByText("failed-receipt.png")).not.toBeInTheDocument();
  });

  it("処理中ジョブを一覧から削除できる", async () => {
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

    const processingSection = screen.getByRole("region", { name: "読み取り中" });
    await user.click(within(processingSection).getByRole("button", { name: "一覧から削除" }));

    await waitFor(() => {
      expect(cancelImageJobMock).toHaveBeenCalledWith({ jobId: "job-running" });
    });
    expect(screen.queryByText("running-receipt.png")).not.toBeInTheDocument();
  });

  it("未登録の画像をまとめてクリアできる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} />);

    await user.click(screen.getByRole("button", { name: "未登録の画像をクリア（3件）" }));

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
      expect(screen.getByRole("button", { name: "まとめて登録（0件）" })).toBeDisabled();
    });

    await user.click(screen.getByRole("checkbox", { name: "スーパー北浜を登録対象に含める" }));
    await user.click(screen.getByRole("button", { name: "まとめて登録（1件）" }));
    await user.click(screen.getByRole("button", { name: "登録する" }));

    expect(registerReadyDraftsAsExpenseEntriesMock).toHaveBeenCalledWith({
      draftIds: ["draft-ready"],
    });
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

    await user.click(screen.getByRole("button", { name: "確認する" }));

    expect(screen.getByRole("heading", { name: "下書き確認" })).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("低信頼度")).toBeInTheDocument();
    expect(within(dialog).getByText("必須項目不足")).toBeInTheDocument();

    expect(within(dialog).queryByLabelText("支払場所")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("支払先")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("支払内容")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("店名・内容"));
    await user.type(screen.getByLabelText("店名・内容"), "スーパー青葉");
    await user.clear(screen.getByLabelText("合計金額"));
    await user.type(screen.getByLabelText("合計金額"), "1680");
    await user.click(screen.getByRole("button", { name: "修正して登録" }));

    expect(updateForReviewMock).toHaveBeenCalledWith({
      draftId: "draft-review",
      documentType: "receipt",
      shopName: "スーパー青葉",
      date: "2026-06-01",
      amountYen: 1680,
      categoryId: "cat-daily",
      items: [],
    });
    expect(registerReadyDraftsAsExpenseEntriesMock).toHaveBeenCalledWith({
      draftIds: ["draft-review"],
    });
  });

  it("明細あり下書きはカテゴリ別集約を主表示し、明細は折りたたみで確認できる", async () => {
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
          shopName: "ドラッグストアA",
          date: "2026-06-21",
          amountYen: 1380,
          categoryId: "cat-daily",
          reviewReasons: ["ambiguous_category", "amount_mismatch"],
          warnings: [],
        },
        items: [
          {
            _id: "item-food",
            itemName: "パン",
            amountYen: 150,
            categoryId: "cat-food",
            confidence: { itemName: 0.9, amountYen: 0.95, categoryId: 0.8 },
            warnings: [],
          },
          {
            _id: "item-medical",
            itemName: "胃薬",
            amountYen: 980,
            confidence: { itemName: 0.85, amountYen: 0.95, categoryName: 0.5 },
            warnings: ["品名が不鮮明です"],
          },
        ],
      };
    });

    renderWithProviders(
      <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
    );

    await user.click(screen.getByRole("button", { name: "確認する" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "ドラッグストアA" })).toBeInTheDocument();
    expect(within(dialog).getByText("2026/06/21 ・ 1,380円")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "登録候補" })).toBeInTheDocument();
    expect(within(dialog).getByText("食費 150円")).toBeInTheDocument();
    expect(within(dialog).getByText("未分類の明細があります")).toBeInTheDocument();
    expect(within(dialog).getByText("低信頼度の明細があります")).toBeInTheDocument();
    expect(within(dialog).getByText("明細合計と合計金額に差額があります")).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "明細" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "明細を見る" }));
    expect(within(dialog).getByText("パン")).toBeInTheDocument();
    expect(within(dialog).getByText("胃薬")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "修正する" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "登録する" })).toBeInTheDocument();
  });

  it("確認が必要な下書きの明細を表示し、編集・追加・削除して保存できる", async () => {
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
          shopName: "ドラッグストアA",
          date: "2026-06-21",
          amountYen: 1380,
          categoryId: "cat-daily",
          reviewReasons: ["ambiguous_category", "amount_mismatch"],
          warnings: [],
        },
        items: [
          {
            _id: "item-food",
            itemName: "パン",
            amountYen: 150,
            categoryId: "cat-food",
            confidence: { itemName: 0.9, amountYen: 0.95, categoryId: 0.8 },
            warnings: [],
          },
          {
            _id: "item-medical",
            itemName: "胃薬",
            amountYen: 980,
            confidence: { itemName: 0.85, amountYen: 0.95, categoryName: 0.5 },
            warnings: ["品名が不鮮明です"],
          },
        ],
      };
    });

    renderWithProviders(
      <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
    );

    await user.click(screen.getByRole("button", { name: "確認する" }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "修正する" }));

    expect(within(dialog).getByRole("heading", { name: "明細" })).toBeInTheDocument();
    expect(within(dialog).getByText("明細合計 1,130円 / 差額 250円")).toBeInTheDocument();
    expect(
      within(dialog).getByText("レシート合計と明細合計に差額があります。"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("未分類")).toBeInTheDocument();
    expect(within(dialog).getByText("低信頼度")).toBeInTheDocument();

    await user.clear(within(dialog).getByDisplayValue("150"));
    await user.type(within(dialog).getAllByLabelText("金額")[0], "400");
    await user.click(within(dialog).getByRole("button", { name: "胃薬を削除" }));
    await user.click(within(dialog).getByRole("button", { name: "明細を追加" }));

    const itemNameInputs = within(dialog).getAllByLabelText("明細名");
    const amountInputs = within(dialog).getAllByLabelText("金額");
    const categoryInputs = within(dialog).getAllByLabelText("明細カテゴリ");
    await user.type(itemNameInputs[1], "牛乳");
    await user.type(amountInputs[1], "980");
    await user.click(categoryInputs[1]);
    await user.click(screen.getByRole("option", { name: "食費" }));
    await user.click(within(dialog).getByRole("button", { name: "登録準備OKに戻す" }));

    expect(updateForReviewMock).toHaveBeenCalledWith({
      draftId: "draft-review",
      documentType: "receipt",
      shopName: "ドラッグストアA",
      date: "2026-06-21",
      amountYen: 1380,
      categoryId: "cat-daily",
      items: [
        expect.objectContaining({
          itemName: "パン",
          amountYen: 400,
          categoryId: "cat-food",
        }),
        expect.objectContaining({
          itemName: "牛乳",
          amountYen: 980,
          categoryId: "cat-food",
        }),
      ],
    });
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

    await user.click(screen.getByRole("button", { name: "確認する" }));

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

    await user.click(screen.getByRole("button", { name: "確認する" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("下書きを読み込んでいます。")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("下書きが見つかりません。一覧を更新してもう一度確認してください。"),
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

    await user.click(screen.getByRole("button", { name: "確認する" }));

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
            shopName: "コンビニ北浜",
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

    await user.click(screen.getByRole("button", { name: "確認する" }));
    const nameInput = screen.getByLabelText("店名・内容");
    expect(nameInput).toHaveValue("大阪市水道局");
    await user.clear(nameInput);
    await user.type(nameInput, "大阪市水道局 水道料金");
    await user.click(screen.getByRole("button", { name: "登録準備OKに戻す" }));

    expect(onReviewSubmit).toHaveBeenCalledWith(
      "draft-review",
      expect.objectContaining({
        documentType: "convenience_payment",
        shopName: "大阪市水道局 水道料金",
        amountYen: 9120,
        categoryId: "cat-daily",
      }),
      false,
    );
    expect(registerReadyDraftsAsExpenseEntriesMock).not.toHaveBeenCalled();
  });

  it("登録済みアイテムに日付とカテゴリが表示される", () => {
    renderWithProviders(<AiExpenseQueuePanel initialItems={queueItems} categories={categories} />);

    const registeredSection = screen.getByRole("region", { name: "登録済み" });
    expect(within(registeredSection).getByText("2026/05/20 ・ 1,800円")).toBeInTheDocument();
    expect(within(registeredSection).getByText("日用品")).toBeInTheDocument();
  });

  describe("Issue #337 レシート入力UI改善の表示・操作回帰", () => {
    it("詳しい説明は折りたたみ内にだけ補足テキストを表示する", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AiExpenseQueuePanel />);

      const detailText = screen.getByText(/追加したレシートは状態別に表示されます/);
      expect(detailText).not.toBeVisible();
      await user.click(screen.getByRole("button", { name: "詳しい説明" }));
      await waitFor(() => {
        expect(detailText).toBeVisible();
      });
    });

    it("解析中の下書きは登録導線を出さず状態だけ表示する", () => {
      renderWithProviders(
        <AiExpenseQueuePanel
          initialItems={[
            {
              id: "draft-analyzing",
              fileName: "processing.png",
              status: "analyzing",
              documentType: "receipt",
            },
          ]}
        />,
      );

      const processingSection = screen.getByRole("region", { name: "読み取り中" });
      expect(within(processingSection).getByText("processing.png")).toBeInTheDocument();
      expect(
        within(processingSection).queryByRole("button", { name: "登録する" }),
      ).not.toBeInTheDocument();
      expect(
        within(processingSection).queryByRole("button", { name: "確認する" }),
      ).not.toBeInTheDocument();
    });

    it("下書き詳細は登録候補と修正導線を表示する", async () => {
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
            shopName: "ドラッグストアA",
            date: "2026-06-21",
            amountYen: 1380,
            categoryId: "cat-daily",
            reviewReasons: ["ambiguous_category"],
            warnings: [],
          },
          items: [
            {
              _id: "item-food",
              itemName: "パン",
              amountYen: 150,
              categoryId: "cat-food",
              confidence: { itemName: 0.9, amountYen: 0.95, categoryId: 0.8 },
              warnings: [],
            },
          ],
        };
      });

      renderWithProviders(
        <AiExpenseQueuePanel initialItems={[queueItems[1]]} categories={categories} />,
      );

      await user.click(screen.getByRole("button", { name: "確認する" }));

      const dialog = screen.getByRole("dialog", { name: "下書き確認" });
      expect(within(dialog).getByRole("heading", { name: "登録候補" })).toBeInTheDocument();
      expect(within(dialog).getByText("食費 150円")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "修正する" })).toBeEnabled();
      expect(within(dialog).getByRole("button", { name: "登録する" })).toBeEnabled();
    });
  });
});
