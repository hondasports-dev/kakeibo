import {
  type BuiltEmail,
  type TransactionalEmailPayload,
  type TransactionalEmailType,
} from "./model";
import { templateDefinitionsByType, validatePayloadForTemplate } from "./templateDefinitions";
import * as v from "valibot";
import { renderAiReviewRequired } from "./templates/aiReviewRequiredTemplate";
import { renderEmailDeliveryTest } from "./templates/emailDeliveryTestTemplate";
import { renderGroupDeleted } from "./templates/groupDeletedTemplate";
import { renderGroupMembershipRemoved } from "./templates/groupMembershipRemovedTemplate";
import { renderGroupOwnershipReceived } from "./templates/groupOwnershipReceivedTemplate";
import { renderGroupOwnershipTransferred } from "./templates/groupOwnershipTransferredTemplate";
import { renderGroupRoleChanged } from "./templates/groupRoleChangedTemplate";
import { renderAccountDeletionCompleted } from "./templates/accountDeletionCompletedTemplate";
import {
  renderGroupDeletionFailed,
  renderGroupDeletionStarted,
} from "./templates/groupDeletionNoticeTemplate";

export { validatePayloadForTemplate, getTemplateSubject } from "./templateDefinitions";

const renderers: Record<TransactionalEmailType, (payload: unknown) => Promise<BuiltEmail>> = {
  email_delivery_test: (payload) =>
    renderEmailDeliveryTest(payload as TransactionalEmailPayload["email_delivery_test"]),
  group_membership_removed: (payload) =>
    renderGroupMembershipRemoved(payload as TransactionalEmailPayload["group_membership_removed"]),
  group_role_changed: (payload) =>
    renderGroupRoleChanged(payload as TransactionalEmailPayload["group_role_changed"]),
  group_ownership_received: (payload) =>
    renderGroupOwnershipReceived(payload as TransactionalEmailPayload["group_ownership_received"]),
  group_ownership_transferred: (payload) =>
    renderGroupOwnershipTransferred(
      payload as TransactionalEmailPayload["group_ownership_transferred"],
    ),
  group_deletion_started: (payload) =>
    renderGroupDeletionStarted(payload as TransactionalEmailPayload["group_deletion_started"]),
  group_deletion_failed: (payload) =>
    renderGroupDeletionFailed(payload as TransactionalEmailPayload["group_deletion_failed"]),
  group_deleted: (payload) =>
    renderGroupDeleted(payload as TransactionalEmailPayload["group_deleted"]),
  ai_review_required: (payload) =>
    renderAiReviewRequired(payload as TransactionalEmailPayload["ai_review_required"]),
  account_deletion_completed: (payload) =>
    renderAccountDeletionCompleted(
      payload as TransactionalEmailPayload["account_deletion_completed"],
    ),
};

export async function buildTransactionalEmail<T extends TransactionalEmailType>(
  type: T,
  payload: TransactionalEmailPayload[T],
): Promise<BuiltEmail> {
  const definition = templateDefinitionsByType.get(type);
  if (!definition) {
    throw new Error(`Unknown template type: ${type}`);
  }
  const validation = validatePayloadForTemplate(type, payload);
  if (!validation.success) {
    throw new Error(
      `Invalid transactional email payload: ${validation.issues.map((issue: v.BaseIssue<unknown>) => issue.message).join(", ")}`,
    );
  }
  const render = renderers[type];
  if (!render) {
    throw new Error(`No renderer for template type: ${type}`);
  }
  return render(validation.data);
}
