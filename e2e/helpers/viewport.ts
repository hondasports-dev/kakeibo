import { expect, type Locator } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export async function expectLocatorInsideViewport(locator: Locator) {
  await expect
    .poll(
      async () =>
        locator.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return Math.ceil(rect.right - window.innerWidth);
        }),
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(0);
}

export async function expectLocatorLeftInsideViewport(locator: Locator) {
  await expect
    .poll(
      async () =>
        locator.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return Math.floor(rect.left);
        }),
      { timeout: 5000 },
    )
    .toBeGreaterThanOrEqual(0);
}

export async function expectLocatorInsideContainer(locator: Locator, container: Locator) {
  await expect
    .poll(
      async () => {
        const targetRect = await locator.evaluate((target) => {
          const rect = target.getBoundingClientRect();
          return { right: rect.right };
        });
        const containerRect = await container.evaluate((target) => {
          let box: Element | null = target;
          let rect = box.getBoundingClientRect();
          while (box.parentElement && rect.width === 0 && rect.height === 0) {
            box = box.parentElement;
            rect = box.getBoundingClientRect();
          }
          return { right: rect.right };
        });
        return Math.ceil(targetRect.right - containerRect.right);
      },
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(0);
}

export async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const hasHorizontalOverflow = root.scrollWidth > root.clientWidth + 1;
    if (hasHorizontalOverflow) {
      const clientWidth = root.clientWidth;
      const scrollWidth = root.scrollWidth;
      const offenders = Array.from(document.querySelectorAll("*"))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            className: el.className,
            id: (el as HTMLElement).id,
            right: rect.right,
            width: rect.width,
            text: (el.textContent ?? "").slice(0, 80).replace(/\s+/g, " "),
          };
        })
        .filter((el) => el.right > clientWidth + 1)
        .sort((a, b) => b.right - a.right)
        .slice(0, 20);
      return { hasHorizontalOverflow, clientWidth, scrollWidth, offenders };
    }
    return { hasHorizontalOverflow };
  });
  if (result.hasHorizontalOverflow) {
    const debugDir = join(process.cwd(), "test-results");
    if (!existsSync(debugDir)) {
      mkdirSync(debugDir, { recursive: true });
    }
    const html = await page.evaluate(() => document.body.innerHTML);
    const htmlPath = join(debugDir, `overflow-debug-${Date.now()}.html`);
    writeFileSync(htmlPath, html);
    console.log("[expectNoHorizontalOverflow] overflow detected", result);
    console.log("[expectNoHorizontalOverflow] body HTML saved to", htmlPath);
  }
  expect(result.hasHorizontalOverflow).toBe(false);
}
