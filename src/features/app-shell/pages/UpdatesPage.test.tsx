import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { UpdatesPage } from "./UpdatesPage";

describe("UpdatesPage", () => {
  test("shows the page title and empty state", () => {
    render(<UpdatesPage />);

    expect(screen.getByRole("heading", { name: "Suzumemoの更新履歴" })).toBeInTheDocument();
    expect(screen.getByText("まだ公開された更新履歴はありません。")).toBeInTheDocument();
  });

  test("shows the current app version", () => {
    render(<UpdatesPage />);

    expect(screen.getByText("Version local")).toBeInTheDocument();
  });

  test("provides a link to the public pages footer", () => {
    render(<UpdatesPage />);

    expect(screen.getByRole("link", { name: "更新履歴" })).toBeInTheDocument();
  });
});
