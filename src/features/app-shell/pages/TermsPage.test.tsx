import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { TermsPage } from "./TermsPage";

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <TermsPage />
    </MemoryRouter>,
  );
}

describe("TermsPage", () => {
  it("利用規約の見出しと制定日を表示する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "利用規約" })).toBeInTheDocument();
    expect(screen.getByText(/制定日:/)).toBeInTheDocument();
  });

  it("アカウント登録・管理責任を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "アカウント登録と管理" })).toBeInTheDocument();
    expect(screen.getByText(/アカウント情報の管理責任はユーザー自身にあり/)).toBeInTheDocument();
  });

  it("禁止事項を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "禁止事項" })).toBeInTheDocument();
    expect(screen.getByText(/法令または公序良俗に反する行為/)).toBeInTheDocument();
    expect(screen.getByText(/不正アクセス/)).toBeInTheDocument();
  });

  it("ユーザー入力情報の扱いを明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "ユーザー入力情報の扱い" })).toBeInTheDocument();
    expect(screen.getByText(/メモ、金額、カテゴリ、日付等/)).toBeInTheDocument();
  });

  it("AI解析結果を保証しない旨を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "AI解析・自動分類機能" })).toBeInTheDocument();
    expect(screen.getByText(/参考情報であり、\s*その正確性を保証しません/)).toBeInTheDocument();
  });

  it("家計管理・支出記録の正確性を保証しない旨を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "免責事項" })).toBeInTheDocument();
    expect(screen.getByText(/家計管理・支出記録の正確性を保証しません/)).toBeInTheDocument();
  });
});
