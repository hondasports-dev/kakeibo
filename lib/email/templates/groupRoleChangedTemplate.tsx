import { render, toPlainText } from "react-email";
import { type BuiltEmail, type GroupRoleChangedPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { GroupRoleChanged } from "./GroupRoleChanged";

export async function renderGroupRoleChanged(
  payload: GroupRoleChangedPayload,
): Promise<BuiltEmail> {
  const html = await render(<GroupRoleChanged {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["group_role_changed"](payload),
    html,
    text,
  };
}
