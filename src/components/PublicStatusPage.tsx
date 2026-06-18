import type { ReactNode } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { designTokens } from "../designTokens";

type PublicStatusLinkAction = {
  label: string;
  href: string;
  variant?: "contained" | "outlined";
};

type PublicStatusButtonAction = {
  label: string;
  onClick: () => void;
  variant?: "contained" | "outlined";
};

export type PublicStatusAction = PublicStatusLinkAction | PublicStatusButtonAction;

type PublicStatusBrandImage = {
  alt: string;
  src: string;
  width?: number | string;
};

export type PublicStatusPageProps = {
  label: string;
  title: string;
  description: string;
  brandImage?: PublicStatusBrandImage;
  primaryAction: PublicStatusAction;
  secondaryActions?: PublicStatusAction[];
  role?: string;
  children?: ReactNode;
};

function isLinkAction(action: PublicStatusAction): action is PublicStatusLinkAction {
  return "href" in action;
}

function renderAction(action: PublicStatusAction, variant: "contained" | "outlined") {
  const resolvedVariant = action.variant ?? variant;

  if (isLinkAction(action)) {
    return (
      <Button
        component="a"
        href={action.href}
        key={action.label}
        variant={resolvedVariant}
        sx={{ minWidth: { xs: "100%", sm: "auto" } }}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      key={action.label}
      onClick={action.onClick}
      variant={resolvedVariant}
      sx={{ minWidth: { xs: "100%", sm: "auto" } }}
    >
      {action.label}
    </Button>
  );
}

export function PublicStatusPage({
  label,
  title,
  description,
  brandImage,
  primaryAction,
  secondaryActions = [],
  role,
  children,
}: PublicStatusPageProps) {
  return (
    <Box className="auth-screen" component="main" role={role}>
      <Paper
        className="paper-panel"
        elevation={0}
        sx={{
          width: "min(100%, 600px)",
          mx: designTokens.layout.shellInsetMd,
          px: { xs: designTokens.space.lg, sm: designTokens.space.xl },
          py: { xs: designTokens.space.lg, sm: "calc(var(--space-xl) + var(--space-xs))" },
        }}
      >
        <Stack spacing={2.5} sx={{ alignItems: "center", textAlign: "center" }}>
          <Typography
            component="p"
            sx={{
              color: designTokens.color.text.muted,
              fontSize: designTokens.typography.caption.fontSize,
              fontWeight: designTokens.typography.caption.fontWeight,
              letterSpacing: "0.08em",
              lineHeight: designTokens.typography.caption.lineHeight,
              textTransform: "uppercase",
            }}
          >
            {label}
          </Typography>

          {brandImage ? (
            <Box
              alt={brandImage.alt}
              component="img"
              src={brandImage.src}
              sx={{
                display: "block",
                height: "auto",
                width: brandImage.width ?? 64,
              }}
            />
          ) : null}

          <Stack spacing={1.25} sx={{ width: "100%" }}>
            <Typography component="h1" variant="h5">
              {title}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {description}
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ flexWrap: "wrap", justifyContent: "center", width: "100%" }}
          >
            {renderAction(primaryAction, "contained")}
            {secondaryActions.map((action) => renderAction(action, "outlined"))}
          </Stack>

          {children}
        </Stack>
      </Paper>
    </Box>
  );
}
