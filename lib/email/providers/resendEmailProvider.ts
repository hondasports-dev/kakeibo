import type { CreateEmailOptions, CreateEmailRequestOptions, CreateEmailResponse } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "../model";
import { classifyResendApiError } from "./emailProviderError";

export type ResendSendEmailFn = (
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions,
) => Promise<CreateEmailResponse>;

export type ResendEmailProviderOptions = {
  from: string;
  sendEmail: ResendSendEmailFn;
};

export function createResendEmailProvider({
  from,
  sendEmail,
}: ResendEmailProviderOptions): EmailProvider {
  return {
    async send({
      to,
      subject,
      html,
      text,
      idempotencyKey,
    }: SendEmailInput): Promise<SendEmailResult> {
      try {
        const response = await sendEmail(
          {
            from,
            to,
            subject,
            html,
            text,
          },
          { idempotencyKey },
        );

        if (response.error) {
          const statusCode = response.error.statusCode ?? undefined;
          const message = response.error.message;
          const error = classifyResendApiError({
            statusCode,
            message,
            error: response.error as unknown as { code?: string; name?: string },
          });
          return { ok: false, error };
        }

        if (!response.data?.id) {
          return {
            ok: false,
            error: classifyResendApiError({ message: "Missing provider message id" }),
          };
        }

        return { ok: true, providerMessageId: response.data.id };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
          ok: false,
          error: classifyResendApiError({
            message: err.message,
            error: (error as { code?: string; name?: string }) ?? undefined,
          }),
        };
      }
    },
  };
}
