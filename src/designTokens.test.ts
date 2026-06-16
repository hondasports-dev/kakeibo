import { describe, expect, it } from "vitest";
import { designTokens, rootCssVariables } from "./designTokens";
import { theme } from "./theme";

describe("designTokens", () => {
  it("defines the calm workbench palette and spacing scale", () => {
    expect(designTokens.color.brand.sparrow).toBe("#8B5E3C");
    expect(designTokens.color.primary.main).toBe("#8B5E3C");
    expect(designTokens.color.surface.canvas).toBe("#FBF8F2");
    expect(designTokens.space.md).toBe("16px");
    expect(designTokens.radius.md).toBe("8px");
  });

  it("exposes shared CSS variables for app layout styles", () => {
    expect(rootCssVariables["--color-surface-canvas"]).toBe(designTokens.color.surface.canvas);
    expect(rootCssVariables["--color-brand-coral"]).toBe(designTokens.color.brand.coral);
    expect(rootCssVariables["--color-surface-canvas-rgb"]).toBe("251 248 242");
    expect(rootCssVariables["--color-surface-panel-rgb"]).toBe("255 253 248");
    expect(rootCssVariables["--color-border-subtle"]).toBe(designTokens.color.border.subtle);
    expect(rootCssVariables["--space-lg"]).toBe(designTokens.space.lg);
    expect(rootCssVariables["--layout-content-max-width"]).toBe(
      designTokens.layout.contentMaxWidth,
    );
  });
});

describe("theme", () => {
  it("derives its base palette and shape from design tokens", () => {
    expect(theme.palette.primary.main).toBe(designTokens.color.primary.main);
    expect(theme.palette.background.default).toBe(designTokens.color.surface.canvas);
    expect(theme.palette.divider).toBe(designTokens.color.border.subtle);
    expect(theme.shape.borderRadius).toBe(8);
  });
});
