import type { MutationCtx } from "../../_generated/server";
import { enqueueTransactionalEmailJobHandler } from "../../email/jobs";
import type { TransactionalEmailType } from "../../../lib/email/model";

export async function enqueueGroupMembershipRemovedEmail(
  ctx: MutationCtx,
  groupName: string,
  recipientEmail: string | undefined,
): Promise<void> {
  if (!recipientEmail) {
    return;
  }
  await enqueueTransactionalEmailJobHandler(ctx, {
    templateType: "group_membership_removed",
    payloadJson: JSON.stringify({ groupName }),
    recipientEmail,
  });
}

export async function enqueueGroupRoleChangedEmail(
  ctx: MutationCtx,
  groupName: string,
  previousRole: "owner" | "member",
  newRole: "owner" | "member",
  recipientEmail: string | undefined,
): Promise<void> {
  if (!recipientEmail) {
    return;
  }
  await enqueueTransactionalEmailJobHandler(ctx, {
    templateType: "group_role_changed",
    payloadJson: JSON.stringify({ groupName, previousRole, newRole }),
    recipientEmail,
  });
}

export async function enqueueGroupOwnershipReceivedEmail(
  ctx: MutationCtx,
  groupName: string,
  recipientEmail: string | undefined,
): Promise<void> {
  if (!recipientEmail) {
    return;
  }
  await enqueueTransactionalEmailJobHandler(ctx, {
    templateType: "group_ownership_received",
    payloadJson: JSON.stringify({ groupName }),
    recipientEmail,
  });
}

export async function enqueueGroupOwnershipTransferredEmail(
  ctx: MutationCtx,
  groupName: string,
  newOwnerDisplayName: string,
  recipientEmail: string | undefined,
): Promise<void> {
  if (!recipientEmail) {
    return;
  }
  await enqueueTransactionalEmailJobHandler(ctx, {
    templateType: "group_ownership_transferred",
    payloadJson: JSON.stringify({ groupName, newOwnerDisplayName }),
    recipientEmail,
  });
}

export async function enqueueGroupDeletedEmail(
  ctx: MutationCtx,
  groupName: string,
  recipientEmail: string | undefined,
): Promise<void> {
  if (!recipientEmail) {
    return;
  }
  await enqueueTransactionalEmailJobHandler(ctx, {
    templateType: "group_deleted",
    payloadJson: JSON.stringify({ groupName }),
    recipientEmail,
  });
}
