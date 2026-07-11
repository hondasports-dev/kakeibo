import { render, toPlainText } from "react-email";
import { type BuiltEmail, type GroupDeletedPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { GroupDeleted } from "./GroupDeleted";

export async function renderGroupDeleted(payload: GroupDeletedPayload): Promise<BuiltEmail> {
  const html = await render(<GroupDeleted {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["group_deleted"](payload),
    html,
    text,
  };
}
