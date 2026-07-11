import { render, toPlainText } from "react-email";
import { type BuiltEmail, type GroupMembershipRemovedPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { GroupMembershipRemoved } from "./GroupMembershipRemoved";

export async function renderGroupMembershipRemoved(payload: GroupMembershipRemovedPayload): Promise<BuiltEmail> {
  const html = await render(<GroupMembershipRemoved {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["group_membership_removed"](payload),
    html,
    text,
  };
}
