export const SITE_METADATA = {
  serviceName: "Suzumemo",
  authorName: "Tatsuya Miyamoto",
  copyrightStartYear: 2026,
  githubProfileUrl: "https://github.com/hondasports",
} as const;

export function getCopyrightNotice(): string {
  return `© ${SITE_METADATA.copyrightStartYear} ${SITE_METADATA.authorName}`;
}
