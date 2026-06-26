import { describe, expect, it } from "vitest";
import { getCopyrightNotice, SITE_METADATA } from "./siteMetadata";

describe("siteMetadata", () => {
  it("作者名と GitHub プロフィール URL を定義する", () => {
    expect(SITE_METADATA.authorName).toBe("Tatsuya Miyamoto");
    expect(SITE_METADATA.githubProfileUrl).toBe("https://github.com/hondasports");
    expect(SITE_METADATA.copyrightStartYear).toBe(2026);
    expect(SITE_METADATA.serviceName).toBe("Suzumemo");
  });

  it("著作権表示を生成する", () => {
    expect(getCopyrightNotice()).toBe("© 2026 Tatsuya Miyamoto");
  });
});
