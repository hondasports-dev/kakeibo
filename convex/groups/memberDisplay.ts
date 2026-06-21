import type { GroupMemberListItem } from "./lib/groupTypes";

function getMemberSortLabel(member: GroupMemberListItem) {
  return member.displayName.trim() || member.email?.trim() || member.userId;
}

export function sortGroupMembersForDisplay(members: GroupMemberListItem[]) {
  return [...members].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "owner" ? -1 : 1;
    }

    const labelCompare = getMemberSortLabel(left).localeCompare(getMemberSortLabel(right), "ja");
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.createdAt - right.createdAt;
  });
}
