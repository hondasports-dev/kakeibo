import { describe, expect, it } from "vitest";
import {
  getInvitationSentAtLabel,
  getInvitationStatusLabel,
} from "./groupInvitationDisplay";

describe("groupInvitationDisplay", () => {
  it("pending 招待の状態ラベルを返す", () => {
    expect(getInvitationStatusLabel("pending")).toBe("招待中");
  });

  it("招待日時ラベルを返す", () => {
    expect(getInvitationSentAtLabel(1_704_067_200_000)).toMatch(/^招待日時: /);
  });
});
