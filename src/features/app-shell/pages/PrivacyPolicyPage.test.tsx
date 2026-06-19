import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { PrivacyPolicyPage } from "./PrivacyPolicyPage";

function renderPage() {
  return renderWithProviders(
    <MemoryRouter>
      <PrivacyPolicyPage />
    </MemoryRouter>,
  );
}

describe("PrivacyPolicyPage", () => {
  it("プライバシーポリシーの見出しと制定日を表示する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "プライバシーポリシー" })).toBeInTheDocument();
    expect(screen.getByText(/制定日:/)).toBeInTheDocument();
  });

  it("Googleログインで取得する情報と利用目的を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "取得する情報" })).toBeInTheDocument();
    expect(screen.getByText(/Googleログインにより取得されるメールアドレス/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "利用目的" })).toBeInTheDocument();
    expect(screen.getByText(/認証、アカウント管理/)).toBeInTheDocument();
  });

  it("Gmail / Drive / Calendar 等を取得しない旨を明記する", () => {
    renderPage();

    expect(
      screen.getByText(/Gmail \/ Google Drive \/ Google Calendar 等の内容は取得しません/),
    ).toBeInTheDocument();
  });

  it("Clerk / Google / Vercel 等の外部サービス利用を明記する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "外部サービスの利用" })).toBeInTheDocument();
    expect(screen.getByText(/Clerk（認証）/)).toBeInTheDocument();
    expect(screen.getByText(/Google（OAuth認証）/)).toBeInTheDocument();
    expect(screen.getByText(/Vercel（ホスティング）/)).toBeInTheDocument();
  });

  it("お問い合わせ先を表示する", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "お問い合わせ先" })).toBeInTheDocument();
  });
});
