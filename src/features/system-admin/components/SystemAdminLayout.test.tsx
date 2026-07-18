import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/react", () => ({
  useClerk: () => ({ signOut: vi.fn(), openUserProfile: vi.fn() }),
  useUser: () => ({
    user: { firstName: "管理者", primaryEmailAddress: { emailAddress: "admin@example.test" } },
  }),
}));
vi.mock("@mui/material", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mui/material")>()),
  useMediaQuery: () => true,
}));

import { SystemAdminLayout } from "./SystemAdminLayout";

describe("SystemAdminLayout", () => {
  it("管理者モードと環境と家計データ非表示を常設する", () => {
    render(
      <MemoryRouter>
        <SystemAdminLayout environment="preview" />
      </MemoryRouter>,
    );

    expect(screen.getByText("システム管理者として操作")).toBeInTheDocument();
    expect(screen.getByText("環境: Preview")).toBeInTheDocument();
    expect(screen.getByText(/家計データは表示されません/)).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
