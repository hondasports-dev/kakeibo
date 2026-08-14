import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DashboardYearlySummaryLink } from "./DashboardYearlySummaryLink";

describe("DashboardYearlySummaryLink", () => {
  it("指定した年次サマリーへのリンクを表示する", () => {
    render(
      <MemoryRouter>
        <DashboardYearlySummaryLink year="2026" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "今年の年次サマリーを見る" })).toHaveAttribute(
      "href",
      "/years/2026",
    );
  });
});
