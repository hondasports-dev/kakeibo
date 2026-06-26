const registrationErrorMessage = "登録に失敗しました。時間をおいて再度お試しください。";
const retryErrorMessage =
  "読み取れませんでした。画像が暗いか、文字が小さい可能性があります。もう一度撮り直すと改善することがあります。";
const deleteErrorMessage = "削除に失敗しました。時間をおいて再度お試しください。";
const reviewErrorMessage = "保存に失敗しました。入力内容を確認して再度お試しください。";

export function toUserFacingRegistrationError(_error: unknown) {
  return registrationErrorMessage;
}

export function toUserFacingRetryError(_error: unknown) {
  return retryErrorMessage;
}

export function toUserFacingDeleteError(_error: unknown) {
  return deleteErrorMessage;
}

export function toUserFacingReviewError(_error: unknown) {
  return reviewErrorMessage;
}
