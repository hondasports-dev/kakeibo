type CssVariableName = `--${string}`;

function hexToRgbChannel(hexColor: string) {
  const normalizedHex = hexColor.replace("#", "");
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
}

export const designTokens = {
  color: {
    primary: {
      light: "#ccfbf1",
      main: "#0f766e",
      dark: "#115e59",
      contrastText: "#ffffff",
    },
    secondary: {
      light: "#e2e8f0",
      main: "#475569",
      dark: "#334155",
      contrastText: "#ffffff",
    },
    success: {
      main: "#15803d",
    },
    warning: {
      main: "#b45309",
    },
    error: {
      main: "#b91c1c",
    },
    text: {
      primary: "#17202a",
      secondary: "#64748b",
      muted: "#94a3b8",
    },
    surface: {
      canvas: "#f6f7f4",
      panel: "#ffffff",
      sunken: "#f1f5f9",
      accent: "#f8faf9",
    },
    border: {
      subtle: "rgba(23, 32, 42, 0.1)",
      emphasis: "rgba(15, 118, 110, 0.32)",
      track: "rgba(23, 32, 42, 0.06)",
    },
    category: {
      default: "#2563EB",
    },
  },
  space: {
    "2xs": "4px",
    xs: "8px",
    sm: "12px",
    md: "16px",
    panel: "20px",
    lg: "24px",
    xl: "32px",
  },
  radius: {
    sm: "4px",
    md: "8px",
    pill: "999px",
  },
  size: {
    buttonMinHeight: "40px",
    inputMinHeight: "36px",
    bottomNavHeight: "56px",
  },
  layout: {
    contentMaxWidth: "1120px",
    shellInsetLg: "32px",
    shellInsetMd: "24px",
    shellInsetSm: "16px",
    shellInsetXs: "12px",
    workbenchSidebarMinWidth: "320px",
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.25,
      letterSpacing: "0",
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: "0",
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 700,
      lineHeight: 1.35,
      letterSpacing: "0",
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: "0",
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.45,
      letterSpacing: "0",
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: "0",
    },
    button: {
      fontWeight: 700,
      letterSpacing: "0",
      textTransform: "none" as const,
    },
  },
} as const;

export const rootCssVariables: Record<CssVariableName, string> = {
  "--font-family-sans": designTokens.typography.fontFamily,
  "--color-primary-main": designTokens.color.primary.main,
  "--color-primary-light": designTokens.color.primary.light,
  "--color-primary-dark": designTokens.color.primary.dark,
  "--color-secondary-main": designTokens.color.secondary.main,
  "--color-secondary-dark": designTokens.color.secondary.dark,
  "--color-success-main": designTokens.color.success.main,
  "--color-warning-main": designTokens.color.warning.main,
  "--color-error-main": designTokens.color.error.main,
  "--color-text-primary": designTokens.color.text.primary,
  "--color-text-secondary": designTokens.color.text.secondary,
  "--color-surface-canvas": designTokens.color.surface.canvas,
  "--color-surface-panel": designTokens.color.surface.panel,
  "--color-surface-sunken": designTokens.color.surface.sunken,
  "--color-surface-accent": designTokens.color.surface.accent,
  "--color-border-subtle": designTokens.color.border.subtle,
  "--color-border-emphasis": designTokens.color.border.emphasis,
  "--color-border-track": designTokens.color.border.track,
  "--color-surface-canvas-rgb": hexToRgbChannel(designTokens.color.surface.canvas),
  "--color-surface-panel-rgb": hexToRgbChannel(designTokens.color.surface.panel),
  "--space-2xs": designTokens.space["2xs"],
  "--space-xs": designTokens.space.xs,
  "--space-sm": designTokens.space.sm,
  "--space-md": designTokens.space.md,
  "--space-panel": designTokens.space.panel,
  "--space-lg": designTokens.space.lg,
  "--space-xl": designTokens.space.xl,
  "--radius-sm": designTokens.radius.sm,
  "--radius-md": designTokens.radius.md,
  "--radius-pill": designTokens.radius.pill,
  "--size-button-min-height": designTokens.size.buttonMinHeight,
  "--size-input-min-height": designTokens.size.inputMinHeight,
  "--size-bottom-nav-height": designTokens.size.bottomNavHeight,
  "--layout-content-max-width": designTokens.layout.contentMaxWidth,
  "--layout-shell-inset-lg": designTokens.layout.shellInsetLg,
  "--layout-shell-inset-md": designTokens.layout.shellInsetMd,
  "--layout-shell-inset-sm": designTokens.layout.shellInsetSm,
  "--layout-shell-inset-xs": designTokens.layout.shellInsetXs,
  "--layout-workbench-sidebar-min-width": designTokens.layout.workbenchSidebarMinWidth,
};
