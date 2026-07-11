import { render, toPlainText } from "react-email";
import { type BuiltEmail, type GroupOwnershipTransferredPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { GroupOwnershipTransferred } from "./GroupOwnershipTransferred";

export async function renderGroupOwnershipTransferred(
  payload: GroupOwnershipTransferredPayload,
): Promise<BuiltEmail> {
  const html = await render(<GroupOwnershipTransferred {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["group_ownership_transferred"](payload),
    html,
    text,
  };
}
