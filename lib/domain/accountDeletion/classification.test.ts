import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_GROUP_MEMBERSHIP_INVARIANT_MESSAGE,
  classifyAccountDeletionGroups,
} from "./classification";

describe("classifyAccountDeletionGroups", () => {
  it("member・複数owner・唯一ownerを退会影響別に分類する", () => {
    const result = classifyAccountDeletionGroups([
      { groupId: "member", groupName: "夫婦家計", role: "member", memberCount: 2, ownerCount: 1 },
      { groupId: "co-owner", groupName: "家族家計", role: "owner", memberCount: 3, ownerCount: 2 },
      { groupId: "blocked", groupName: "宮本家", role: "owner", memberCount: 2, ownerCount: 1 },
      { groupId: "solo", groupName: "自分の家計", role: "owner", memberCount: 1, ownerCount: 1 },
    ]);

    expect(result.groupsToLeave.map((group) => group.groupId)).toEqual(["member", "co-owner"]);
    expect(result.groupsToDelete.map((group) => group.groupId)).toEqual(["solo"]);
    expect(result.blockingGroups).toEqual([
      {
        groupId: "blocked",
        groupName: "宮本家",
        memberCount: 2,
        reason: "sole_owner_with_other_members",
      },
    ]);
  });

  it("ownerがいない不整合を拒否する", () => {
    expect(() =>
      classifyAccountDeletionGroups([
        { groupId: "broken", groupName: "不整合", role: "member", memberCount: 1, ownerCount: 0 },
      ]),
    ).toThrow(ACCOUNT_DELETION_GROUP_MEMBERSHIP_INVARIANT_MESSAGE);
  });
});
