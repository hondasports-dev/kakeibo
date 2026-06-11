import { expect, test } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupGroupMembershipsByUser } from "./helpers/cleanup";

test.describe("グループアクセス", () => {
  test.beforeEach(async () => {
    await cleanupGroupMembershipsByUser();
  });

  test.afterEach(async () => {
    await cleanupGroupMembershipsByUser();
  });

  test("@smoke @group-access 未所属ユーザーは /group/setup に誘導され、グループ作成後に設定画面へ進める", async ({
    page,
  }) => {
    await gotoAuthenticated(page);

    await expect(page).toHaveURL("/group/setup");
    await expect(page.getByRole("heading", { name: "家族グループを作成" })).toBeVisible();

    await page.getByRole("textbox", { name: "グループ名" }).fill("佐藤家");
    await page.getByRole("button", { name: "グループを作成" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "今週のダッシュボード" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "グループ管理", level: 2 })).toBeVisible();
    await expect(page.getByText("佐藤家")).toBeVisible();
  });
});
