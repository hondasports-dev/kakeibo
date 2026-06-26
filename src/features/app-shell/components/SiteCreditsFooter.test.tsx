import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { SiteCreditsFooter } from "./SiteCreditsFooter";

describe("SiteCreditsFooter", () => {
  it("default variant で著作権表示と英語リンクを表示する", () => {
    renderWithProviders(<SiteCreditsFooter />);

    expect(screen.getByText("© 2026 Tatsuya Miyamoto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/hondasports",
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByText("Suzumemo")).toBeInTheDocument();
  });

  it("ja variant で日本語リンクを表示する", () => {
    renderWithProviders(<SiteCreditsFooter variant="ja" />);

    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/hondasports",
    );
  });
});
