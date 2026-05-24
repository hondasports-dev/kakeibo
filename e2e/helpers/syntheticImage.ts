import { Buffer } from "node:buffer";
import type { Page } from "@playwright/test";

export async function createSyntheticReceiptImage(page: Page, name = "receipt-sample.jpg") {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context を取得できませんでした");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111827";
    context.font = "20px sans-serif";
    context.fillText("Sample Store", 24, 48);
    context.font = "16px sans-serif";
    context.fillText("2026-05-24", 24, 84);
    context.fillText("Total 1,234 JPY", 24, 120);

    return canvas.toDataURL("image/jpeg", 0.85);
  });

  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.from(base64, "base64"),
  };
}
