export type ReadyDraftForRegistration = {
  status: string;
  date?: string;
  amountYen?: number;
  categoryId?: string | null;
};

export type ValidateReadyDraftError =
  | "not_ready"
  | "missing_date"
  | "missing_amount"
  | "missing_category";

export function validateReadyDraftForRegistration(
  draft: ReadyDraftForRegistration,
): { success: true } | { success: false; error: ValidateReadyDraftError } {
  if (draft.status !== "ready") {
    return { success: false, error: "not_ready" };
  }
  if (!draft.date) {
    return { success: false, error: "missing_date" };
  }
  if (draft.amountYen === undefined || draft.amountYen <= 0) {
    return { success: false, error: "missing_amount" };
  }
  if (!draft.categoryId) {
    return { success: false, error: "missing_category" };
  }
  return { success: true };
}

export function dedupeDraftIds<T extends string>(draftIds: T[]): T[] {
  return [...new Set(draftIds)];
}

export type RegisteredDraftCheck = {
  status: string;
  registeredReceiptId?: string;
};

export function isAlreadyRegisteredAsReceipt(draft: RegisteredDraftCheck): boolean {
  return draft.status === "registered" && !!draft.registeredReceiptId;
}

export function isAlreadyRegistered(draft: { status: string }): boolean {
  return draft.status === "registered";
}

const readyDraftRegistrationErrorMessages: Record<ValidateReadyDraftError, string> = {
  not_ready: "Only ready drafts can be registered",
  missing_date: "Draft date is required to register",
  missing_amount: "Draft amount is required to register",
  missing_category: "Draft category is required to register",
};

/** ready 状態の下書きを登録できない理由をメッセージに変換する */
export function getReadyDraftRegistrationErrorMessage(error: ValidateReadyDraftError): string {
  return readyDraftRegistrationErrorMessages[error];
}
