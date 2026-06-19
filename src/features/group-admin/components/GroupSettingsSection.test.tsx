import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupSettingsSection } from "./GroupSettingsSection";

describe("GroupSettingsSection", () => {
  it("testId 未指定でも aria-labelledby が h3 と一致する", () => {
    render(<GroupSettingsSection title="テスト">content</GroupSettingsSection>);

    const heading = screen.getByRole("heading", { level: 3, name: "テスト" });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("testId 指定時は見出し id が testId-heading になる", () => {
    render(
      <GroupSettingsSection testId="sample-section" title="サンプル">
        content
      </GroupSettingsSection>,
    );

    const section = screen.getByTestId("sample-section");
    expect(section).toHaveAttribute("aria-labelledby", "sample-section-heading");
    expect(screen.getByRole("heading", { level: 3, name: "サンプル" })).toHaveAttribute(
      "id",
      "sample-section-heading",
    );
  });
});
