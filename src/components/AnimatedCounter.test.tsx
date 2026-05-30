import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedCounter } from "./AnimatedCounter";

describe("AnimatedCounter", () => {
  it("レンダリングすること", () => {
    render(<AnimatedCounter value={1234} />);

    const container = screen.getByText((_content, element) => {
      return (
        element?.tagName.toLowerCase() === "span" &&
        element?.parentElement?.getAttribute("aria-live") === "polite"
      );
    });
    expect(container).toBeInTheDocument();
  });

  it("prefixとsuffixを表示すること", () => {
    render(<AnimatedCounter value={500} prefix="¥" suffix="円" />);

    const container = screen.getByText((_content, element) => {
      return element?.parentElement?.getAttribute("aria-live") === "polite";
    });
    expect(container).toBeInTheDocument();
    // prefix/suffixが含まれているか確認
    expect(container.parentElement).toHaveTextContent("¥");
    expect(container.parentElement).toHaveTextContent("円");
  });

  it("アクセシビリティ属性を持つこと", () => {
    render(<AnimatedCounter value={100} />);

    const container = screen.getByText((_content, element) => {
      return element?.parentElement?.getAttribute("aria-live") === "polite";
    });
    expect(container.parentElement).toHaveAttribute("aria-live", "polite");
    expect(container.parentElement).toHaveAttribute("aria-atomic", "true");
  });
});
