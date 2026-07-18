import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock, useConvexAuthMock, useQueryMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useConvexAuthMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock("@clerk/react", () => ({ useAuth: useAuthMock }));
vi.mock("convex/react", () => ({
  useConvexAuth: useConvexAuthMock,
  useQuery: useQueryMock,
}));

import { SystemAdminRouteGuard } from "./SystemAdminRouteGuard";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route element={<SystemAdminRouteGuard />} path="/admin">
          <Route element={<div>管理画面の内容</div>} index />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("SystemAdminRouteGuard", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: true });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: true });
    useQueryMock.mockReturnValue({ status: "active", environment: "preview" });
  });

  it("active system adminだけがchildを表示する", () => {
    renderGuard();

    expect(screen.getByText("管理画面の内容")).toBeInTheDocument();
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("認可確認中は管理情報を表示しない", () => {
    useQueryMock.mockReturnValue(undefined);

    renderGuard();

    expect(screen.getByRole("status", { name: "管理者権限を確認中" })).toBeInTheDocument();
    expect(screen.queryByText("管理画面の内容")).not.toBeInTheDocument();
  });

  it.each(["none", "revoked"])("%s はgeneric forbiddenを表示する", (status) => {
    useQueryMock.mockReturnValue({ status, environment: "preview" });

    renderGuard();

    expect(screen.getByRole("heading", { name: "管理画面を利用できません" })).toBeInTheDocument();
    expect(screen.queryByText("管理画面の内容")).not.toBeInTheDocument();
  });

  it("未認証ではcontext queryをskipして通常アプリへの導線を表示する", () => {
    useAuthMock.mockReturnValue({ isLoaded: true, isSignedIn: false });
    useConvexAuthMock.mockReturnValue({ isLoading: false, isAuthenticated: false });

    renderGuard();

    expect(screen.getByRole("heading", { name: "管理画面を利用できません" })).toBeInTheDocument();
    expect(useQueryMock).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("context queryのエラーは管理画面専用の再読み込み状態で扱う", () => {
    useQueryMock.mockImplementation(() => {
      throw new Error("forbidden");
    });

    renderGuard();

    expect(screen.getByRole("heading", { name: "管理画面を利用できません" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });
});
