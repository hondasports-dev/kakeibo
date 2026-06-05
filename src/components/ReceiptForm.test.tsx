import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { renderWithProviders } from "../test/render";
import { ReceiptForm } from "./ReceiptForm";

const {
  createReceiptMock,
  registerReadyDraftsMock,
  extractReceiptFieldsMock,
  acceptReceiptImageConsentMock,
  receiptImageConsentQueryMock,
  aiExpenseDraftsByStatusQueryMock,
} = vi.hoisted(() => ({
  createReceiptMock: vi.fn(),
  registerReadyDraftsMock: vi.fn(),
  extractReceiptFieldsMock: vi.fn(),
  acceptReceiptImageConsentMock: vi.fn(),
  receiptImageConsentQueryMock: vi.fn(),
  aiExpenseDraftsByStatusQueryMock: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    receipts: {
      createReceipt: "receipts.createReceipt",
    },
    aiExpenseDrafts: {
      listByStatus: "aiExpenseDrafts.listByStatus",
      registerReadyDrafts: "aiExpenseDrafts.registerReadyDrafts",
    },
    users: {
      acceptReceiptImageExternalApiConsent: "users.acceptReceiptImageExternalApiConsent",
      getReceiptImageConsent: "users.getReceiptImageConsent",
    },
    receiptImageExtraction: {
      extractReceiptFields: "receiptImageExtraction.extractReceiptFields",
    },
    receiptAnalysisJobs: {
      listJobs: "receiptAnalysisJobs.listJobs",
      createBatch: "receiptAnalysisJobs.createBatch",
      analyzeImageJob: "receiptAnalysisJobs.analyzeImageJob",
      retryImageJob: "receiptAnalysisJobs.retryImageJob",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (functionRef: string) => {
    if (functionRef === "users.acceptReceiptImageExternalApiConsent") {
      return acceptReceiptImageConsentMock;
    }
    if (functionRef === "aiExpenseDrafts.registerReadyDrafts") {
      return registerReadyDraftsMock;
    }
    if (functionRef === "receiptAnalysisJobs.createBatch") {
      return vi.fn().mockResolvedValue({ batch: { _id: "batch-1" }, jobs: [] });
    }
    if (functionRef === "receiptAnalysisJobs.retryImageJob") {
      return vi.fn().mockResolvedValue(undefined);
    }
    return createReceiptMock;
  },
  useAction: (functionRef: string) => {
    if (functionRef === "receiptAnalysisJobs.analyzeImageJob") {
      return vi.fn().mockResolvedValue(undefined);
    }
    return extractReceiptFieldsMock;
  },
  useQuery: (functionRef: string, args?: unknown) => {
    if (functionRef === "users.getReceiptImageConsent") {
      return receiptImageConsentQueryMock();
    }
    if (functionRef === "aiExpenseDrafts.listByStatus") {
      return aiExpenseDraftsByStatusQueryMock(args);
    }
    if (functionRef === "receiptAnalysisJobs.listJobs") {
      return [];
    }
    return undefined;
  },
}));

const categories = [
  { _id: "cat-food" as Id<"categories">, name: "食費", color: "#2563EB" },
  { _id: "cat-daily" as Id<"categories">, name: "日用品", color: "#16A34A" },
];

describe("ReceiptForm", () => {
  beforeEach(() => {
    createReceiptMock.mockReset();
    createReceiptMock.mockResolvedValue(undefined);
    registerReadyDraftsMock.mockReset();
    registerReadyDraftsMock.mockResolvedValue(undefined);
    extractReceiptFieldsMock.mockReset();
    acceptReceiptImageConsentMock.mockReset();
    acceptReceiptImageConsentMock.mockResolvedValue(undefined);
    receiptImageConsentQueryMock.mockReset();
    receiptImageConsentQueryMock.mockReturnValue({
      hasAcceptedExternalApiConsent: true,
      acceptedAt: 1234567890,
    });
    aiExpenseDraftsByStatusQueryMock.mockReset();
    aiExpenseDraftsByStatusQueryMock.mockReturnValue([]);
    HTMLCanvasElement.prototype.toDataURL = vi
      .fn()
      .mockReturnValue("data:image/jpeg;base64,mockBase64Data");
    extractReceiptFieldsMock.mockResolvedValue({
      shopName: "サンプルストア",
      date: "2026-05-18",
      amountYen: 1234,
      confidence: {
        shopName: 0.95,
        date: 0.98,
        amountYen: 0.98,
      },
      warnings: [],
    });
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
      expect(createReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-05-18",
          shopName: "スーパー北浜",
          amountYen: 4280,
          categoryId: "cat-daily",
          memo: "特売日",
        }),
      );
    });
    expect(screen.getByLabelText("店舗名")).toHaveValue("");
    expect(screen.getByLabelText("合計金額")).toHaveValue("");
    expect(screen.getByLabelText("メモ")).toHaveValue("");
    expect(screen.getByRole("option", { name: "日用品 選択中" })).toBeInTheDocument();
    expect(screen.getByText("レシートを保存しました")).toBeInTheDocument();
  });

  it("画像未選択時は読み取りを開始できない", () => {
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );

    expect(screen.getByRole("heading", { name: "画像から入力" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み取る" })).toBeDisabled();
    expect(
      screen.getByText("画像は保存されません。確認用の一時プレビューです。"),
    ).toBeInTheDocument();
  });

  it("画像を選択するとプレビューとファイル名を表示し、削除で未選択状態に戻る", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);

    expect(
      screen.getByRole("img", { name: "選択したレシート画像のプレビュー" }),
    ).toBeInTheDocument();
    expect(screen.getByText("receipt-sample.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み取る" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "選択画像を削除" }));

    expect(
      screen.queryByRole("img", { name: "選択したレシート画像のプレビュー" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("receipt-sample.png")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み取る" })).toBeDisabled();
  });

  it("画像以外のファイルはプレビューせず読み取りを開始できない", () => {
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const input = screen.getByLabelText("レシート画像を選択") as HTMLInputElement;
    const file = new File(["not image"], "receipt.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("画像ファイルを選択してください。")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "選択したレシート画像のプレビュー" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み取る" })).toBeDisabled();
    expect(input).toHaveValue("");
  });

  it("読み取り未接続の失敗UIが出ても手入力の保存を妨げない", async () => {
    // extractReceiptFields がエラーを返すシナリオ（API 未接続 / 失敗）
    extractReceiptFieldsMock.mockRejectedValue(new Error("画像の読み取りに失敗しました"));

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    // 失敗後はエラーメッセージが表示される
    expect(await screen.findByText("画像の読み取りに失敗しました")).toBeInTheDocument();

    // 手入力で保存できる
    await user.type(screen.getByLabelText("店舗名"), "画像確認スーパー");
    await user.type(screen.getByLabelText("合計金額"), "980");
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    await waitFor(() => {
      expect(createReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-05-18",
          shopName: "画像確認スーパー",
          amountYen: 980,
          categoryId: "cat-food",
        }),
      );
    });
  });

  it("外部API送信に未同意の場合、読み取り前に同意ダイアログを表示し Action を呼ばない", async () => {
    receiptImageConsentQueryMock.mockReturnValue({
      hasAcceptedExternalApiConsent: false,
      acceptedAt: null,
    });
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect(
      await screen.findByRole("dialog", { name: "画像の外部API送信に同意しますか" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "レシート画像を解析するため、画像データを外部APIへ送信します。画像は長期保存しません。",
      ),
    ).toBeInTheDocument();
    expect(extractReceiptFieldsMock).not.toHaveBeenCalled();
    expect(acceptReceiptImageConsentMock).not.toHaveBeenCalled();
  });

  it("外部API送信に同意すると Convex に保存してから読み取りを実行する", async () => {
    receiptImageConsentQueryMock.mockReturnValue({
      hasAcceptedExternalApiConsent: false,
      acceptedAt: null,
    });
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));
    await user.click(await screen.findByRole("button", { name: "同意して読み取る" }));

    await waitFor(() => {
      expect(acceptReceiptImageConsentMock).toHaveBeenCalledOnce();
      expect(extractReceiptFieldsMock).toHaveBeenCalledWith({
        imageDataUrl: "data:image/jpeg;base64,mockBase64Data",
      });
    });
    expect(screen.getByLabelText("店舗名")).toHaveValue("サンプルストア");
  });

  it("外部API送信を拒否すると画像送信せず手入力に戻れる", async () => {
    receiptImageConsentQueryMock.mockReturnValue({
      hasAcceptedExternalApiConsent: false,
      acceptedAt: null,
    });
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));
    await user.click(await screen.findByRole("button", { name: "手入力する" }));

    expect(extractReceiptFieldsMock).not.toHaveBeenCalled();
    expect(acceptReceiptImageConsentMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("店舗名"), "同意なしスーパー");
    await user.type(screen.getByLabelText("合計金額"), "880");
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    await waitFor(() => {
      expect(createReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-05-18",
          shopName: "同意なしスーパー",
          amountYen: 880,
          categoryId: "cat-food",
        }),
      );
    });
  });

  it("リサイズ後の Data URL が大きすぎる場合は Action を呼ばずに手入力導線を表示する", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue(
      "data:image/jpeg;base64," + "A".repeat(900_001),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["large dummy image"], "large-receipt.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect(
      await screen.findByText(
        "画像サイズが大きすぎます。別の画像を選択するか、手入力してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("手入力でも保存できます。")).toBeInTheDocument();
    expect(extractReceiptFieldsMock).not.toHaveBeenCalled();
  });

  it("confidence が低い抽出項目は要確認として扱い、自動反映しない", async () => {
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "サンプルストア",
      date: "2026/05/23",
      amountYen: "￥1,234",
      confidence: {
        shopName: 0.95,
        date: 0.4,
        amountYen: 0.95,
      },
      warnings: [],
    });

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect(await screen.findByText("日付は要確認です")).toBeInTheDocument();
    expect(screen.getByLabelText("店舗名")).toHaveValue("サンプルストア");
    expect(screen.getByLabelText("合計金額")).toHaveValue("1,234");
    expect(screen.getByLabelText("日付")).toHaveValue("2026-05-18");
  });

  it("warnings がある抽出結果は既存入力を上書きせず要確認を表示する", async () => {
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "警告つきストア",
      date: "2026/05/23",
      amountYen: "￥1,234",
      confidence: {
        shopName: 0.95,
        date: 0.95,
        amountYen: 0.95,
      },
      warnings: ["合計金額候補が複数あります"],
    });

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.type(screen.getByLabelText("店舗名"), "既存ストア");
    await user.type(screen.getByLabelText("合計金額"), "500");
    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect(await screen.findByText("要確認の項目があります")).toBeInTheDocument();
    expect(screen.getByText("合計金額候補が複数あります")).toBeInTheDocument();
    expect(screen.getByLabelText("店舗名")).toHaveValue("既存ストア");
    expect(screen.getByLabelText("合計金額")).toHaveValue("500");
    expect(screen.getByLabelText("日付")).toHaveValue("2026-05-18");
  });

  it("抽出 applied フィールドがフォームに反映されると AI候補 helperText を表示する", async () => {
    // 全フィールド applied (confidence 高め)
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "サンプルストア",
      date: "2026-05-20",
      amountYen: 1234,
      confidence: { shopName: 0.95, date: 0.95, amountYen: 0.95 },
      warnings: [],
    });

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    // 抽出値がフォームに反映される
    expect(await screen.findByDisplayValue("サンプルストア")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1,234")).toBeInTheDocument();

    // AI候補 helperText が表示される
    expect(screen.getAllByText("AI候補").length).toBeGreaterThan(0);
  });

  it("AI候補 helperText は保存後にリセットされる", async () => {
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "サンプルストア",
      date: "2026-05-20",
      amountYen: 1234,
      confidence: { shopName: 0.95, date: 0.95, amountYen: 0.95 },
      warnings: [],
    });
    createReceiptMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect((await screen.findAllByText("AI候補")).length).toBeGreaterThan(0);

    // 保存する
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    await waitFor(() => {
      expect(createReceiptMock).toHaveBeenCalled();
    });

    // AI候補 helperText が全て消える
    expect(screen.queryAllByText("AI候補")).toHaveLength(0);
  });

  it("AI候補 helperText はユーザーが手動編集すると消える", async () => {
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "サンプルストア",
      date: "2026-05-20",
      amountYen: 1234,
      confidence: { shopName: 0.95, date: 0.95, amountYen: 0.95 },
      warnings: [],
    });

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect((await screen.findAllByText("AI候補")).length).toBeGreaterThan(0);

    // 店舗名を手動編集する
    const shopNameInput = screen.getByLabelText("店舗名");
    await user.clear(shopNameInput);
    await user.type(shopNameInput, "手入力ストア");

    // 店舗名フィールドの AI候補 helperText が消える
    const shopNameField = screen.getByTestId("shop-name-field");
    expect(within(shopNameField).queryByText("AI候補")).not.toBeInTheDocument();
  });

  it("週外の日付を含む抽出結果は既存入力を上書きせず日付確認エラーを表示する", async () => {
    extractReceiptFieldsMock.mockResolvedValueOnce({
      shopName: "翌週ストア",
      date: "2026/05/25",
      amountYen: "￥1,234",
      confidence: {
        shopName: 0.95,
        date: 0.95,
        amountYen: 0.95,
      },
      warnings: [],
    });

    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    const file = new File(["dummy image"], "receipt-sample.png", { type: "image/png" });

    await user.type(screen.getByLabelText("店舗名"), "既存ストア");
    await user.type(screen.getByLabelText("合計金額"), "500");
    await user.upload(screen.getByLabelText("レシート画像を選択"), file);
    await user.click(screen.getByRole("button", { name: "読み取る" }));

    expect(
      await screen.findByText("読み取った日付はこの週の範囲外です。確認して手入力してください。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("店舗名")).toHaveValue("既存ストア");
    expect(screen.getByLabelText("合計金額")).toHaveValue("500");
    expect(screen.getByLabelText("日付")).toHaveValue("2026-05-18");
  });

  it("収入タブに切り替えると銀行名フィールドが表示され、店舗名フィールドが非表示になる", async () => {
    // Given: フォームが表示されている（デフォルトは支出）
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );

    // When: 収入タブをクリックする
    await user.click(screen.getByRole("tab", { name: "収入" }));

    // Then: 銀行名フィールドが表示され、店舗名フィールドが非表示になる
    expect(screen.getByLabelText("銀行名")).toBeInTheDocument();
    expect(screen.queryByLabelText("店舗名")).not.toBeInTheDocument();
  });

  it("収入: 銀行名・金額・カテゴリを入力して保存するとAPIに type:income で渡す", async () => {
    // Given: 収入タブに切り替え済み
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    await user.click(screen.getByRole("tab", { name: "収入" }));

    // When: 銀行名、金額、カテゴリを入力して保存する
    await user.type(screen.getByLabelText("銀行名"), "三菱UFJ銀行");
    await user.type(screen.getByLabelText("合計金額"), "200000");
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    // Then: type:income で bankName が渡る
    await waitFor(() => {
      expect(createReceiptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "income",
          bankName: "三菱UFJ銀行",
          amountYen: 200000,
          categoryId: "cat-food",
        }),
      );
    });
    expect(screen.getByLabelText("銀行名")).toHaveValue("");
    expect(screen.getByLabelText("合計金額")).toHaveValue("");
  });

  it("収入: 銀行名が空のまま保存しようとするとエラーを表示する", async () => {
    // Given: 収入タブに切り替え済み
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiptForm weekStartDate="2026-05-18" weekEndDate="2026-05-24" categories={categories} />,
    );
    await user.click(screen.getByRole("tab", { name: "収入" }));

    // When: 銀行名を入力せずに保存ボタンをクリックする
    await user.click(screen.getByRole("button", { name: "保存して次へ" }));

    // Then: 銀行名エラーが表示され、APIは呼ばれない
    expect(await screen.findByText("銀行名は必須です")).toBeInTheDocument();
    expect(createReceiptMock).not.toHaveBeenCalled();
  });
});
