import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NavigationPendingOutlet } from "./features/app-shell";
import { MonthlySummaryRouteFallback, router, SummaryRouteFallback } from "./router";

describe("system admin route tree", () => {
  it("/adminはGroupRouteGuardのchildrenではなくtop-level siblingである", () => {
    const adminRoute = router.routes.find((route) => route.path === "/admin");
    const groupGuardRoute = router.routes.find((route) =>
      route.children?.some((child) => child.path === "/"),
    );

    expect(adminRoute?.children?.map((route) => route.path)).toEqual([
      undefined,
      "users",
      "users/:userId",
      "groups",
      "groups/:groupId",
      "audit-logs",
      "system-admins",
      "group-deletion",
    ]);
    expect(groupGuardRoute?.children?.some((route) => route.path === "/admin")).toBe(false);
  });
});

describe("monthly summary route", () => {
  it("月次サマリーのルートを登録している", () => {
    const monthlyRoute = router.routes
      .flatMap((route) => route.children ?? [])
      .find((route) => route.path === "/months/:month");

    expect(monthlyRoute).toMatchObject({ path: "/months/:month" });
    expect(monthlyRoute?.lazy).toEqual(expect.any(Function));
  });

  it("週次・月次のルートfallbackを表示する", () => {
    render(
      <>
        <SummaryRouteFallback />
        <MonthlySummaryRouteFallback />
      </>,
    );

    expect(screen.getByText("週次サマリーを読み込んでいます…")).toBeInTheDocument();
    expect(screen.getByText("月次サマリーを読み込んでいます…")).toBeInTheDocument();
  });

  it("月次lazy遷移中は実ルーターのpending UIを表示する", async () => {
    let resolveLazy: () => void = () => undefined;
    const lazyReady = new Promise<void>((resolve) => {
      resolveLazy = resolve;
    });
    const testRouter = createMemoryRouter(
      [
        {
          element: <NavigationPendingOutlet />,
          children: [
            { path: "/", element: <div>ホーム</div> },
            {
              path: "/months/:month",
              lazy: async () => {
                await lazyReady;
                return { Component: () => <div>月次サマリー本体</div> };
              },
            },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={testRouter} />);
    expect(screen.getByText("ホーム")).toBeInTheDocument();

    let navigationPromise: Promise<void> | undefined;
    act(() => {
      navigationPromise = testRouter.navigate("/months/2026-08");
    });
    expect(await screen.findByText("月次サマリーを読み込んでいます…")).toBeInTheDocument();

    await act(async () => {
      resolveLazy();
      await navigationPromise;
    });
    expect(await screen.findByText("月次サマリー本体")).toBeInTheDocument();
  });

  it("週次・月次のlazy routeが画面コンポーネントを返す", async () => {
    const routes = router.routes.flatMap((route) => route.children ?? []);
    const weeklyRoute = routes.find((route) => route.path === "/weeks/:weekStartDate");
    const monthlyRoute = routes.find((route) => route.path === "/months/:month");

    if (
      !weeklyRoute ||
      typeof weeklyRoute.lazy !== "function" ||
      !monthlyRoute ||
      typeof monthlyRoute.lazy !== "function"
    ) {
      throw new Error("weekly/monthly lazy route is not configured");
    }

    await expect(weeklyRoute.lazy()).resolves.toEqual({ Component: expect.any(Function) });
    await expect(monthlyRoute.lazy()).resolves.toEqual({ Component: expect.any(Function) });
  });
});
