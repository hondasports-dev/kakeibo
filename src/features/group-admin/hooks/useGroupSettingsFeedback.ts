import { useState } from "react";
import { getConvexErrorMessage } from "../../auth";

export function getGroupSettingsErrorMessage(error: unknown, fallback: string) {
  return getConvexErrorMessage(error, fallback);
}

export function useGroupSettingsFeedback() {
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");

  return {
    error,
    savingTarget,
    setError,
    setSavingTarget,
    setSnackbar,
    snackbar,
  };
}
