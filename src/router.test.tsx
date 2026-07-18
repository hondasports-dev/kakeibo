import { describe, expect, it } from "vitest";
import { router } from "./router";

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
    ]);
    expect(groupGuardRoute?.children?.some((route) => route.path === "/admin")).toBe(false);
  });
});
