import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { ExpenseSearchBox } from "./ExpenseSearchBox";

function LocationProbe() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

describe("ExpenseSearchBox", () => {
  it("店名を入力して送信すると検索ページへ遷移する", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <ExpenseSearchBox />
        <LocationProbe />
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/search" element={<div>search-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("履歴を検索"), "セブン");
    await user.click(screen.getByRole("button", { name: "検索する" }));

    expect(screen.getByText("/search?q=%E3%82%BB%E3%83%96%E3%83%B3")).toBeInTheDocument();
    expect(screen.getByText("search-page")).toBeInTheDocument();
  });

  it("検索ページでは既存の絞り込み条件を保ったまま店名だけ更新する", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={["/search?min=100"]}>
        <ExpenseSearchBox />
        <LocationProbe />
        <Routes>
          <Route path="/search" element={<div>search-page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("履歴を検索"));
    await user.type(screen.getByLabelText("履歴を検索"), "イオン");
    await user.click(screen.getByRole("button", { name: "検索する" }));

    expect(screen.getByText("/search?q=%E3%82%A4%E3%82%AA%E3%83%B3&min=100")).toBeInTheDocument();
  });
});
