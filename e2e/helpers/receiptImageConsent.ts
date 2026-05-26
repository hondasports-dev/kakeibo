import { expect, type Page } from "@playwright/test";

export async function acceptReceiptImageExternalApiConsentIfVisible(page: Page) {
  const dialog = page.getByRole("dialog", { name: "画像の外部API送信に同意しますか" });
  await dialog.waitFor({ state: "visible", timeout: 1000 }).catch(() => undefined);
  const isVisible = await dialog.isVisible().catch(() => false);
  if (!isVisible) {
    return;
  }

  await expect(
    page.getByText(
      "レシート画像を解析するため、画像データを外部APIへ送信します。画像は長期保存しません。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "同意して読み取る" }).click();
}
