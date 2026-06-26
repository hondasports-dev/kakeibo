const registrationErrorMessage = "登録に失敗しました。時間をおいて再度お試しください。";
const retryErrorMessage =
  "読み取れませんでした。画像が暗いか、文字が小さい可能性があります。もう一度撮り直すと改善することがあります。";
const deleteErrorMessage = "削除に失敗しました。時間をおいて再度お試しください。";
const reviewErrorMessage = "保存に失敗しました。入力内容を確認して再度お試しください。";

function logUserFacingError(context: string, error: unknown) {
  console.error(context, error);
}

export function toUserFacingRegistrationError(error: unknown) {
  logUserFacingError("AI expense queue registration failed", error);
  return registrationErrorMessage;
}

export function toUserFacingRetryError(error: unknown) {
  logUserFacingError("AI expense queue retry failed", error);
  return retryErrorMessage;
}

export function toUserFacingDeleteError(error: unknown) {
  logUserFacingError("AI expense queue delete failed", error);
  return deleteErrorMessage;
}

export function toUserFacingReviewError(error: unknown) {
  logUserFacingError("AI expense queue review save failed", error);
  return reviewErrorMessage;
}
