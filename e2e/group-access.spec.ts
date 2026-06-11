import { expect, test, type Page } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";
import { cleanupGroupMembershipsByUser } from "./helpers/cleanup";

test.describe("グループアクセス", () => {
  let currentUserIdForCleanup: string | undefined;

  test.afterEach(async () => {
    if (currentUserIdForCleanup) {
      await cleanupGroupMembershipsByUser(currentUserIdForCleanup);
      currentUserIdForCleanup = undefined;
    }
  });

  test("@smoke @group-access 未所属ユーザーは /group/setup に誘導され、グループ作成後に設定画面へ進める", async ({
    page,
  }) => {
    await gotoAuthenticated(page);

    const currentUserId = await getCurrentClerkTokenIdentifier(page);
    currentUserIdForCleanup = currentUserId;
    await cleanupGroupMembershipsByUser(currentUserId);

    await page.goto("/");
    await expect(page).toHaveURL("/group/setup", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "家族グループを作成" })).toBeVisible({
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
    await expect(page.getByText("佐藤家")).toBeVisible();
  });
});

async function getCurrentClerkTokenIdentifier(page: Page): Promise<string> {
  const token = (await page.evaluate(async () => {
    const clerk = (
      window as Window & { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }
    ).Clerk;
    return clerk?.session?.getToken ? await clerk.session.getToken() : null;
  })) as string | null;

  if (!token) {
    throw new Error("current Clerk token is not available");
  }

  const payloadPart = token.split(".")[1];
  if (!payloadPart) {
    throw new Error("invalid Clerk token");
  }

  const payloadJson = Buffer.from(payloadPart, "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as { iss?: string; sub?: string };
  if (!payload.iss || !payload.sub) {
    throw new Error("Clerk token is missing iss or sub");
  }

  return `${payload.iss}|${payload.sub}`;
}
