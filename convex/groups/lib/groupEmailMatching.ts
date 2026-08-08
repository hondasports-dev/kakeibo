import { ConvexError } from "convex/values";
import type { GroupPendingInvitationListItem } from "./groupTypes";
import {
  dedupePendingInvitationsByEmail,
  sortPendingInvitationsByCreatedAtAndEmail,
  validateEmail,
} from "../../../lib/domain/groups/email";

export {
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
} from "../../../lib/domain/groups/email";

export function normalizeEmail(email: string) {
  const result = validateEmail(email);
  if (!result.success) {
    throw new ConvexError("メールアドレスを入力してください");
  }
  return result.email;
}

export function sortPendingGroupInvitationsForDisplay(
  invitations: GroupPendingInvitationListItem[],
) {
  return sortPendingInvitationsByCreatedAtAndEmail(invitations);
}

export function dedupePendingGroupInvitationsByEmail(
  invitations: GroupPendingInvitationListItem[],
) {
  return dedupePendingInvitationsByEmail(invitations);
}
