import { Resend, type WebhookEventPayload } from "resend";
import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { EMAIL_WEBHOOK_EVENT_TYPES } from "../model";
import type { EmailWebhookEventType } from "../../../lib/email/model";

type WebhookVerifier = (
  payload: Parameters<Resend["webhooks"]["verify"]>[0],
) => WebhookEventPayload;

export function createResendWebhookHandler(
  verifier: WebhookVerifier,
): ReturnType<typeof httpAction> {
  return httpAction(async (ctx, req) => {
    const rawBody = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Missing webhook secret", { status: 500 });
    }

    const id = req.headers.get("webhook-id") ?? "";
    const timestamp = req.headers.get("webhook-timestamp") ?? "";
    const signature = req.headers.get("webhook-signature") ?? "";

    let event: WebhookEventPayload;
    try {
      event = verifier({ payload: rawBody, headers: { id, timestamp, signature }, webhookSecret });
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const processedAt = Date.now();

    if (!(EMAIL_WEBHOOK_EVENT_TYPES as unknown as readonly string[]).includes(event.type)) {
      return new Response("ok", { status: 200 });
    }

    await ctx.runMutation(internal.email.webhooks.processResendEvent.processResendEvent, {
      svixId: id,
      provider: "resend",
      eventType: event.type as EmailWebhookEventType,
      payloadJson: JSON.stringify(event.data),
      processedAt,
    });

    return new Response("ok", { status: 200 });
  });
}

export const resendWebhookHandler = createResendWebhookHandler((payload) =>
  new Resend("").webhooks.verify(payload),
);
