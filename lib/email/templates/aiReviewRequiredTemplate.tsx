import { render, toPlainText } from "react-email";
import { type BuiltEmail, type AiReviewRequiredPayload } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { AiReviewRequired } from "./AiReviewRequired";

export async function renderAiReviewRequired(payload: AiReviewRequiredPayload): Promise<BuiltEmail> {
  const html = await render(<AiReviewRequired {...payload} />);
  const text = toPlainText(html);
  return {
    subject: subjectRenderers["ai_review_required"](payload),
    html,
    text,
  };
}
