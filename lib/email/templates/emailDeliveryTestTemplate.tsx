import { render, toPlainText } from "react-email";
import { type BuiltEmail, type EmailDeliveryTestPayload } from "../model";
import { emailDeliveryTestSubject } from "../templateDefinitions";
import { EmailDeliveryTest } from "./EmailDeliveryTest";

export async function renderEmailDeliveryTest(
  payload: EmailDeliveryTestPayload,
): Promise<BuiltEmail> {
  const html = await render(<EmailDeliveryTest to={payload.to} groupName={payload.groupName} />);
  const text = toPlainText(html);
  return {
    subject: emailDeliveryTestSubject,
    html,
    text,
  };
}
