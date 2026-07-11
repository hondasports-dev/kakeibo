import { render, toPlainText } from "react-email";
import { type BuiltEmail, type GroupOwnershipReceivedPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { GroupOwnershipReceived } from "./GroupOwnershipReceived";

export async function renderGroupOwnershipReceived(payload: GroupOwnershipReceivedPayload): Promise<BuiltEmail> {
  const html = await render(<GroupOwnershipReceived {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["group_ownership_received"](payload),
    html,
    text,
  };
}
