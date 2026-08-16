import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { HistoryNavigation } from "./HistoryNavigation";

const paths = {
  weekly: "/weeks/2026-06-15",
  monthly: "/months/2026-06",
  search: "/search",
};

function renderNavigation(initialEntry: string, overrides: Partial<typeof paths> = {}) {
  renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HistoryNavigation
        monthlyPath={overrides.monthly ?? paths.monthly}
        searchPath={overrides.search ?? paths.search}
        weeklyPath={overrides.weekly ?? paths.weekly}
      />
    </MemoryRouter>,
  );
}

describe("HistoryNavigation", () => {
  it("履歴メニュー内に週次・月次・履歴検索の3リンクを表示し、週次を選択する", () => {
    renderNavigation(paths.weekly);

    const navigation = screen.getByRole("navigation", { name: "履歴メニュー" });
    const links = within(navigation).getAllByRole("link");

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.textContent)).toEqual([
      "週次サマリー",
      "月次サマリー",
      "履歴検索",
    ]);
    expect(within(navigation).getByRole("link", { name: "週次サマリー" })).toHaveAttribute(
      "href",
      paths.weekly,
    );
    expect(within(navigation).getByRole("link", { name: "月次サマリー" })).toHaveAttribute(
      "href",
      paths.monthly,
    );
    expect(within(navigation).getByRole("link", { name: "履歴検索" })).toHaveAttribute(
      "href",
      paths.search,
    );
    expect(within(navigation).getByRole("link", { name: "週次サマリー" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(navigation).getByRole("link", { name: "月次サマリー" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("月次の選択日と検索のraw queryを導線に保持する", () => {
    renderNavigation("/months/2026-07?date=2026-07-10", {
      monthly: "/months/2026-07?date=2026-07-10",
    });

    const navigation = screen.getByRole("navigation", { name: "履歴メニュー" });
    expect(within(navigation).getByRole("link", { name: "月次サマリー" })).toHaveAttribute(
      "href",
      "/months/2026-07?date=2026-07-10",
    );
    expect(within(navigation).getByRole("link", { name: "月次サマリー" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    renderNavigation("/search?q=%E5%BA%97&from=2026-08-01", {
      search: "/search?q=%E5%BA%97&from=2026-08-01",
    });

    const searchNavigation = screen.getAllByRole("navigation", { name: "履歴メニュー" }).at(-1);
    expect(searchNavigation).toBeDefined();
    expect(
      within(searchNavigation as HTMLElement).getByRole("link", { name: "履歴検索" }),
    ).toHaveAttribute("href", "/search?q=%E5%BA%97&from=2026-08-01");
    expect(
      within(searchNavigation as HTMLElement).getByRole("link", { name: "履歴検索" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
