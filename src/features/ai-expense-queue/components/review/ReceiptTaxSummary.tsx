import { Stack, Typography } from "@mui/material";
import type { AiExpenseDraft } from "../../types/types";
import { formatYenLabel } from "../../utils/receiptTaxLabels";
import { getTaxModeLabel } from "../../utils/receiptItemTaxViewModel";
import { formatTaxWarnings } from "../../utils/taxWarnings";

export function ReceiptTaxSummary({ draft }: { draft: AiExpenseDraft | null }) {
  const summaries = draft?.taxSummaries ?? [];
  if (summaries.length === 0) {
    return null;
  }

  return (
    <Stack aria-label="税率別集計" spacing={1}>
      <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
        税率別集計
      </Typography>
      {summaries.map((summary) => (
        <Stack
          key={`${summary.taxRatePercent}-${summary.taxableAmountYen}-${summary.taxMode}`}
          spacing={0.25}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1,
          }}
        >
          <Typography variant="body2">
            {summary.taxRatePercent}% {getTaxModeLabel(summary.taxMode)}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            小計 {formatYenLabel(summary.taxableAmountYen)}（{summary.taxRatePercent}%
            {getTaxModeLabel(summary.taxMode)}）
          </Typography>
          <Typography color="text.secondary" variant="body2">
            税額 {formatYenLabel(summary.taxYen)}
          </Typography>
          {summary.taxIncludedAmountYen !== undefined && (
            <Typography color="text.secondary" variant="body2">
              税込合計 {formatYenLabel(summary.taxIncludedAmountYen)}
            </Typography>
          )}
          {summary.warnings.length > 0 && (
            <Typography color="warning.main" variant="body2">
              {formatTaxWarnings(summary.warnings)}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
