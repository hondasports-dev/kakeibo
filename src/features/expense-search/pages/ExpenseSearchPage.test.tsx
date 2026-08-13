import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { ExpenseSearchPage } from "./ExpenseSearchPage";

const useQueryMock = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

const emptySearchResult = {
  page: [],
  continueCursor: "0",
  isDone: true,
  truncated: false,
  matchedGroupCount: 0,
};

describe("ExpenseSearchPage", () => {
  beforeEach(() => {
    useQueryMock.mockImplementation((_api: unknown, args: unknown) => {
      if (args === undefined) {
        return [{ _id: "cat-food", name: "食費" }];
      }
      if (args === "skip") {
        return undefined;
      }
      return emptySearchResult;
    });
  });

  it("検索フォームと空の結果メッセージを表示する", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/search"]}>
        <ExpenseSearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "支出検索", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("店名")).toBeInTheDocument();
    expect(screen.getByLabelText("カテゴリ")).toBeInTheDocument();
    expect(screen.getByLabelText("金額の下限")).toBeInTheDocument();
    expect(screen.getByLabelText("金額の上限")).toBeInTheDocument();
    expect(screen.getByLabelText("開始日")).toBeInTheDocument();
    expect(screen.getByLabelText("終了日")).toBeInTheDocument();
    expect(screen.getByText("条件に合う支出はありません")).toBeInTheDocument();
  });

  it("不正な金額範囲ならエラーを出して検索しない", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/search?min=200&max=100"]}>
        <ExpenseSearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("金額の下限は上限以下にしてください")).toBeInTheDocument();
    expect(screen.queryByText("条件に合う支出はありません")).not.toBeInTheDocument();
  });

  it("件数上限を超えた場合は案内を表示する", () => {
    useQueryMock.mockImplementation((_api: unknown, args: unknown) => {
      if (args === undefined) {
        return [];
      }
      return { ...emptySearchResult, truncated: true, isDone: false };
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/search"]}>
        <ExpenseSearchPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "新しい順の一部を表示しています。見つからない場合は日付や金額で絞り込んでください。",
      ),
    ).toBeInTheDocument();
  });

  it("条件を絞り込むとURLへ反映し、クリアで戻せる", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={["/search"]}>
        <ExpenseSearchPage />
        <LocationProbe />
        <Routes>
          <Route path="/search" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("店名"), "北浜");
    await user.type(screen.getByLabelText("金額の下限"), "9000");
    await user.click(screen.getByRole("button", { name: "絞り込む" }));
    expect(screen.getByText("/search?q=%E5%8C%97%E6%B5%9C&min=9000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "条件をクリア" }));
    expect(screen.getByText("/search")).toBeInTheDocument();
  });
});
