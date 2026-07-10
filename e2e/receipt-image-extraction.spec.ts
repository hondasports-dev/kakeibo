import { test, expect } from "@playwright/test";
import { gotoAuthenticated } from "./helpers/auth";

/**
 * Issue #174: UIから「画像から入力」以下を削除
 *
 * 旧「画像から入力」セクションが支出入力画面に残っていないこと、
 * 代わりに読み取りと手入力フォームが見えていることを確認する。
 */

const INPUT_PATH = "/weeks/current/input";

test("@smoke I-5: 画像入力セクションが削除され、読み取りと手入力導線が見える", async ({ page }) => {
  await gotoAuthenticated(page, INPUT_PATH);

  await expect(page.getByRole("region", { name: "画像から入力" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "レシート入力" })).toBeVisible();
  await expect(page.getByLabel("店舗名 / 支払先")).toBeVisible();
  await expect(page.getByLabel("合計金額")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存して次へ" })).toBeVisible();
});
