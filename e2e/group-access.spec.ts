import { expect, test } from "@playwright/test";
import { getCurrentClerkTokenIdentifier, gotoAuthenticated } from "./helpers/auth";
import {
  cleanupGroupInvitationsByUser,
  cleanupGroupMembershipsByUser,
  setE2eGroupMemberRole,
} from "./helpers/cleanup";
import { seedGroupMemberForUser, seedPendingGroupInvitationForUser } from "./helpers/seed";

test.describe("グループアクセス", () => {
  let currentUserIdForCleanup: string | undefined;
  let seededMemberUserIdForCleanup: string | undefined;

  test.afterEach(async () => {
    if (seededMemberUserIdForCleanup) {
      await cleanupGroupMembershipsByUser(seededMemberUserIdForCleanup);
      seededMemberUserIdForCleanup = undefined;
    }
    if (currentUserIdForCleanup) {
      await cleanupGroupInvitationsByUser(currentUserIdForCleanup);
      await cleanupGroupMembershipsByUser(currentUserIdForCleanup);
      currentUserIdForCleanup = undefined;
    }
  });

  test("@smoke @group-access 未所属ユーザーは /group/setup に誘導され、グループ作成後に設定画面へ進める", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/", { ensureGroup: false });

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;
    await cleanupGroupMembershipsByUser(currentUserId);

    await page.goto("/");
    await expect(page).toHaveURL("/group/setup", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "家族グループを作成" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "グループを作成" })).toBeEnabled({
      timeout: 15_000,
    });

    await page.getByRole("textbox", { name: "グループ名" }).fill("佐藤家");
    await page.getByRole("button", { name: "グループを作成" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "今週のダッシュボード" })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "グループ管理", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "グループ情報", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "メンバー管理", level: 3 })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "グループ名" })).toHaveValue("佐藤家");
  });

  test("@smoke @group-access owner はグループ名を変更できる", async ({ page }) => {
    await gotoAuthenticated(page, "/", { ensureGroup: false });

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;
    await cleanupGroupMembershipsByUser(currentUserId);

    await page.goto("/");
    await expect(page).toHaveURL("/group/setup", { timeout: 15_000 });

    await page.getByRole("textbox", { name: "グループ名" }).fill("佐藤家");
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/settings");
    const nameInput = page.getByRole("textbox", { name: "グループ名" });
    await expect(nameInput).toHaveValue("佐藤家");
    await nameInput.fill("鈴木家");
    await page.getByTestId("group-info-section").getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("グループ名を更新しました")).toBeVisible({ timeout: 15_000 });
    await expect(nameInput).toHaveValue("鈴木家");
  });

  test("@smoke @group-access member ロールでは招待管理と危険な操作を表示しない", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/settings");

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;
    await setE2eGroupMemberRole(currentUserId, "member");

    await page.reload();
    await expect(page.getByRole("heading", { name: "グループ管理", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "グループ情報", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "メンバー管理", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "招待管理", level: 3 })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "危険な操作", level: 3 })).toHaveCount(0);
    await expect(page.getByText("招待と削除はオーナーのみ操作できます。")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "招待するメールアドレス" })).toHaveCount(0);
  });

  test("@smoke @group-access owner は pending 招待一覧の空状態を表示する", async ({ page }) => {
    await gotoAuthenticated(page, "/settings");

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;

    await expect(page.getByRole("heading", { name: "招待管理", level: 3 })).toBeVisible();
    await expect(page.getByTestId("group-pending-invitation-list-empty")).toHaveText(
      "送信済みの招待はありません。",
    );
  });

  test("@smoke @group-access owner は pending 招待を確認ダイアログ経由で取り消せる", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/settings");

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;

    const invitationEmail = "e2e-cancel-pending@example.com";
    await seedPendingGroupInvitationForUser(currentUserId, invitationEmail);

    await page.reload();
    await expect(page.getByText(invitationEmail)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: `${invitationEmail}への招待を取り消す` }).click();
    await expect(page.getByRole("heading", { name: "招待を取り消しますか？" })).toBeVisible();
    await page.getByRole("button", { name: "招待を取り消す" }).click();

    await expect(page.getByText("招待を取り消しました")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("group-pending-invitation-list-empty")).toHaveText(
      "送信済みの招待はありません。",
    );
  });

  test("@smoke @group-access member ロールではグループ名入力とメンバー解除ボタンを表示しない", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/settings");

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;
    await setE2eGroupMemberRole(currentUserId, "member");

    await page.reload();
    await expect(page.getByRole("heading", { name: "グループ管理", level: 2 })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "グループ名" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /をグループから外す/ })).toHaveCount(0);
    await expect(page.getByTestId("group-pending-invitation-list")).toHaveCount(0);
  });

  test("@smoke @group-access owner はメンバー解除を確認ダイアログ経由で実行できる", async ({
    page,
  }) => {
    await gotoAuthenticated(page, "/settings");

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;

    const memberDisplayName = "E2E解除対象メンバー";
    const memberEmail = "e2e-removable-member@example.com";
    const { memberUserId } = await seedGroupMemberForUser(
      currentUserId,
      memberDisplayName,
      memberEmail,
    );
    seededMemberUserIdForCleanup = memberUserId;

    await page.reload();
    await expect(page.getByText(memberDisplayName)).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: `${memberDisplayName}をグループから外す` }).click();
    await expect(
      page.getByRole("heading", { name: "メンバーをグループから外しますか？" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "グループから外す" }).click();

    await expect(page.getByText("メンバーをグループから外しました")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(memberDisplayName)).toHaveCount(0);
  });
});
