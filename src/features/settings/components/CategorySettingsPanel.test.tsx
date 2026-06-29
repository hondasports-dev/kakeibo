import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { renderWithProviders } from "../../../test/render";
import { CategorySettingsPanel } from "./CategorySettingsPanel";

type Category = {
  _id: Id<"categories">;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
};

const {
  createCategoryMock,
  deactivateCategoryMock,
  updateCategoryMock,
  useMutationMock,
  useQueryMock,
} = vi.hoisted(() => ({
  createCategoryMock: vi.fn(),
  deactivateCategoryMock: vi.fn(),
  updateCategoryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    categories: {
      queries: {
        listForSettings: "categories.queries.listForSettings",
      },
      mutations: {
        createCategory: "categories.mutations.createCategory",
        deactivateCategory: "categories.mutations.deactivateCategory",
        updateCategory: "categories.mutations.updateCategory",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
}));

const categories: Category[] = [
  {
    _id: "cat-food" as Id<"categories">,
    name: "食費",
    color: "#AAB7C4",
    isActive: true,
    sortOrder: 10,
  },
  {
    _id: "cat-old" as Id<"categories">,
    name: "旧カテゴリ",
    color: "#765F4F",
    isActive: false,
    sortOrder: 20,
  },
];

describe("CategorySettingsPanel", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    createCategoryMock.mockReset();
    updateCategoryMock.mockReset();
    deactivateCategoryMock.mockReset();
    createCategoryMock.mockResolvedValue(undefined);
    updateCategoryMock.mockResolvedValue(undefined);
    deactivateCategoryMock.mockResolvedValue(undefined);
    useQueryMock.mockReturnValue(categories);
    useMutationMock.mockImplementation((reference: string) => {
      if (reference === "categories.mutations.createCategory") return createCategoryMock;
      if (reference === "categories.mutations.updateCategory") return updateCategoryMock;
      if (reference === "categories.mutations.deactivateCategory") return deactivateCategoryMock;
      throw new Error(`Unexpected mutation reference: ${reference}`);
    });
  });

  it("カテゴリ取得中は読み込み状態を表示する", () => {
    // Given: カテゴリ一覧のqueryがまだ完了していない
    useQueryMock.mockReturnValue(undefined);

    // When: カテゴリ設定を表示する
    renderWithProviders(<CategorySettingsPanel />);

    // Then: 読み込み中の状態が表示される
    expect(screen.getByLabelText("カテゴリを読み込んでいます")).toBeInTheDocument();
  });

  it("カテゴリを追加でき、入力欄を初期状態に戻す", async () => {
    // Given: 既存カテゴリが読み込まれている
    const user = userEvent.setup();
    renderWithProviders(<CategorySettingsPanel />);

    // When: 新しいカテゴリ名を入力して追加する
    await user.click(screen.getByRole("button", { name: "カテゴリを追加" }));
    await user.type(screen.getByLabelText("新しいカテゴリ名"), "交通");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    // Then: 作成mutationが呼ばれ、カテゴリ名の入力欄が空になる
    await waitFor(() => {
      expect(createCategoryMock).toHaveBeenCalledWith({
        name: "交通",
        color: "#8B5E3C",
      });
    });
    expect(screen.getByLabelText("新しいカテゴリ名")).toHaveValue("");
    expect(screen.getByText("カテゴリを追加しました")).toBeInTheDocument();
  });

  it("E2Eから安定して参照できる入力名を公開する", async () => {
    // Given: カテゴリ設定を表示する
    const user = userEvent.setup();
    renderWithProviders(<CategorySettingsPanel />);

    // Then: Playwright がラベル描画に依存せず入力欄を参照できる
    await user.click(screen.getByRole("button", { name: "カテゴリを追加" }));
    expect(screen.getByRole("textbox", { name: "新しいカテゴリ名" })).toHaveAttribute(
      "name",
      "newCategoryName",
    );
    expect(screen.getByLabelText("新しいカテゴリ色")).toHaveAttribute("name", "newCategoryColor");

    await user.click(screen.getByRole("button", { name: "食費を編集" }));
    expect(screen.getByRole("textbox", { name: "カテゴリ名を編集" })).toHaveAttribute(
      "name",
      "editCategoryName",
    );
    expect(screen.getByLabelText("カテゴリ色を編集")).toHaveAttribute("name", "editCategoryColor");
  });

  it("カテゴリ名を編集して保存できる", async () => {
    // Given: 既存カテゴリが編集可能な状態で表示されている
    const user = userEvent.setup();
    renderWithProviders(<CategorySettingsPanel />);

    // When: カテゴリ名を変更して保存する
    await user.click(screen.getByRole("button", { name: "食費を編集" }));
    const editName = screen.getByLabelText("カテゴリ名を編集");
    await user.clear(editName);
    await user.type(editName, "スーパー");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    // Then: 更新mutationに編集後の値が渡る
    await waitFor(() => {
      expect(updateCategoryMock).toHaveBeenCalledWith({
        categoryId: "cat-food",
        name: "スーパー",
        color: "#AAB7C4",
      });
    });
    expect(screen.getByText("カテゴリを更新しました")).toBeInTheDocument();
  });

  it("有効カテゴリを無効化し、無効カテゴリのボタンは押せない", async () => {
    // Given: 有効カテゴリと無効カテゴリが一覧にある
    const user = userEvent.setup();
    renderWithProviders(<CategorySettingsPanel />);

    // When: 有効カテゴリの無効化ボタンを押す
    await user.click(screen.getByRole("button", { name: "食費を編集" }));
    await user.click(screen.getByRole("button", { name: "食費を無効化" }));

    // Then: 対象IDで無効化mutationが呼ばれ、無効カテゴリは操作不可のまま
    await waitFor(() => {
      expect(deactivateCategoryMock).toHaveBeenCalledWith({ categoryId: "cat-food" });
    });
    await user.click(screen.getByRole("button", { name: "旧カテゴリを編集" }));
    expect(screen.getByRole("button", { name: "旧カテゴリを無効化" })).toBeDisabled();
  });

  it("カテゴリの利用状態を色だけに依存せず表示する", () => {
    renderWithProviders(<CategorySettingsPanel />);

    expect(screen.getByText("使用中")).toBeInTheDocument();
    expect(screen.getByText("無効")).toBeInTheDocument();
  });

  it("カテゴリが0件なら追加導線のある空状態を表示する", () => {
    useQueryMock.mockReturnValue([]);

    renderWithProviders(<CategorySettingsPanel />);

    expect(screen.getByText("カテゴリがまだありません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初のカテゴリを追加" })).toBeInTheDocument();
  });
});
