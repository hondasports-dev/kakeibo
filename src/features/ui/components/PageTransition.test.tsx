import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTransition } from "./PageTransition";

describe("PageTransition", () => {
  it("子要素をレンダリングすること", () => {
    render(
      <PageTransition>
        <div data-testid="child-content">テストコンテンツ</div>
      </PageTransition>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("正しいARIAラベルを持つこと", () => {
    render(
      <PageTransition>
        <div>コンテンツ</div>
      </PageTransition>,
    );

    const container = screen.getByLabelText("ページコンテンツ");
    expect(container).toBeInTheDocument();
  });

  it("カスタムクラス名を適用すること", () => {
    render(
      <PageTransition className="custom-class">
        <div>コンテンツ</div>
      </PageTransition>,
    );

    const container = screen.getByLabelText("ページコンテンツ");
    expect(container).toHaveClass("custom-class");
  });
});
