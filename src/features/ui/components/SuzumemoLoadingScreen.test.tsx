import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const animationDirectory = resolve("public/animations/suzumemo-loading");

describe("Suzumemo loading Lottie", () => {
  it("3秒ループと左右独立のSVG葉レイヤーを持つ", () => {
    const lottiePath = resolve(animationDirectory, "lottie.json");
    const leftLeafPath = resolve(animationDirectory, "leaf-left.svg");
    const rightLeafPath = resolve(animationDirectory, "leaf-right.svg");

    expect(existsSync(lottiePath)).toBe(true);
    expect(existsSync(leftLeafPath)).toBe(true);
    expect(existsSync(rightLeafPath)).toBe(true);

    const lottie = JSON.parse(readFileSync(lottiePath, "utf8")) as {
      fr: number;
      op: number;
      assets: Array<{ p?: string }>;
      slots?: Record<string, unknown>;
    };

    expect(lottie.fr).toBe(30);
    expect(lottie.op).toBe(90);
    expect(lottie.assets.map((asset) => asset.p)).toEqual(
      expect.arrayContaining(["leaf-left.svg", "leaf-right.svg"]),
    );
    expect(lottie.slots).toHaveProperty("bgColor");
    expect(readFileSync(leftLeafPath, "utf8")).toContain("<path");
    expect(readFileSync(rightLeafPath, "utf8")).toContain("<path");
  });

  it("動きを減らす設定ではアニメーションを停止する", () => {
    const css = readFileSync(
      resolve("src/features/ui/components/SuzumemoLoadingScreen.css"),
      "utf8",
    );

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation: none");
  });

  it("英字と日本語ロゴをフォント非依存のSVGパスで描画する", () => {
    const wordmark = readFileSync(resolve(animationDirectory, "wordmark.svg"), "utf8");
    const subtitle = readFileSync(resolve(animationDirectory, "subtitle.svg"), "utf8");

    expect(wordmark).not.toContain("<text");
    expect(subtitle).not.toContain("<text");
    expect(wordmark).toContain("<path");
    expect(subtitle).toContain("<path");
  });

  it("全レイヤーを合成したSVGロゴを配布する", () => {
    const logoPath = resolve(animationDirectory, "logo.svg");

    expect(existsSync(logoPath)).toBe(true);
    const logo = readFileSync(logoPath, "utf8");
    expect(logo).toContain('href="leaf-left.svg"');
    expect(logo).toContain('href="leaf-right.svg"');
  });

  it("狭い画面では親要素の利用可能幅を超えない", () => {
    const css = readFileSync(
      resolve("src/features/ui/components/SuzumemoLoadingScreen.css"),
      "utf8",
    );

    expect(css).toContain("width: min(600px, 100%)");
  });
});
