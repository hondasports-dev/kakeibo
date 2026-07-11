import { Link as MuiLink, Stack, Typography } from "@mui/material";
import { designTokens } from "../../../designTokens";
import { getCopyrightNotice, SITE_METADATA } from "../lib/siteMetadata";

type SiteCreditsFooterProps = {
  variant?: "default" | "ja";
};

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

function FooterLinkRow({ links }: { links: FooterLink[] }) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        color: designTokens.color.text.muted,
        flexWrap: "wrap",
        fontSize: designTokens.typography.caption.fontSize,
        justifyContent: "center",
      }}
    >
      {links.map((link, index) => (
        <Stack direction="row" key={link.label} spacing={0.75} sx={{ alignItems: "center" }}>
          {index > 0 ? (
            <Typography component="span" variant="caption">
              /
            </Typography>
          ) : null}
          {link.external ? (
            <MuiLink
              href={link.href}
              rel="noopener noreferrer"
              target="_blank"
              underline="hover"
              variant="caption"
            >
              {link.label}
            </MuiLink>
          ) : (
            <MuiLink href={link.href} underline="hover" variant="caption">
              {link.label}
            </MuiLink>
          )}
        </Stack>
      ))}
      <Typography component="span" variant="caption">
        /
      </Typography>
      <Typography component="span" variant="caption">
        {SITE_METADATA.serviceName}
      </Typography>
    </Stack>
  );
}

export function SiteCreditsFooter({ variant = "default" }: SiteCreditsFooterProps) {
  const links: FooterLink[] =
    variant === "ja"
      ? [
          { label: "プライバシーポリシー", href: "/privacy" },
          { label: "利用規約", href: "/terms" },
          { label: "更新履歴", href: "/updates" },
          { label: "GitHub", href: SITE_METADATA.githubProfileUrl, external: true },
        ]
      : [
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
          { label: "Updates", href: "/updates" },
          { label: "GitHub", href: SITE_METADATA.githubProfileUrl, external: true },
        ];

  return (
    <Stack
      spacing={0.75}
      sx={{
        alignItems: "center",
        color: designTokens.color.text.muted,
        textAlign: "center",
      }}
    >
      <Typography component="p" variant="caption">
        {getCopyrightNotice()}
      </Typography>
      <FooterLinkRow links={links} />
    </Stack>
  );
}
