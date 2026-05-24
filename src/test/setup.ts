import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom は createImageBitmap / HTMLCanvasElement.toDataURL を実装していないため
// テスト環境用のスタブを提供する
if (typeof globalThis.createImageBitmap !== "function") {
  globalThis.createImageBitmap = vi.fn().mockResolvedValue({
    width: 100,
    height: 100,
    close: vi.fn(),
  });
}

// Canvas の getContext と toDataURL のスタブ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(HTMLCanvasElement.prototype as any).getContext = function (contextId: string) {
  if (contextId === "2d") {
    return {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
};

HTMLCanvasElement.prototype.toDataURL = vi
  .fn()
  .mockReturnValue("data:image/jpeg;base64,mockBase64Data");
