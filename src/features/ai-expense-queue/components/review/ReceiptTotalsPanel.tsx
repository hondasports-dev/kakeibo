import type { ReactNode } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import type { AiExpenseDraft, ReviewItemValues } from "../../types/types";
import { toReceiptTotalsViewModel } from "../../utils/receiptTotalsViewModel";

function TotalsRow({
  label,
  amountLabel,
  note,
}: {
  label: string;
  amountLabel: string;
  note?: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "baseline", flexWrap: "wrap", justifyContent: "space-between" }}
    >
      <Typography variant="body2">{label}</Typography>
      <Box sx={{ textAlign: "right" }}>
        <Typography variant="body2">{amountLabel}</Typography>
        {note && (
          <Typography color="warning.main" variant="caption">
            {note}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function ReceiptTotalsPanel({
  reviewItems,
  paidTotalYen,
  taxSummaries,
  bulkTaxAction,
}: {
  reviewItems: ReviewItemValues[];
  paidTotalYen?: number;
  taxSummaries?: AiExpenseDraft["taxSummaries"];
  bulkTaxAction?: ReactNode;
}) {
  const vm = toReceiptTotalsViewModel({ reviewItems, paidTotalYen, taxSummaries });

  if (!vm.showPanel) {
    return null;
  }

  const severity = vm.status === "matched" ? ("success" as const) : ("warning" as const);

  const subtotalLabel = vm.receiptSubtotalYen
    ? `レシートの小計${vm.subtotalRateLabel ? `（${vm.subtotalRateLabel}）` : ""}`
    : "レシートの小計";

  return (
    <Alert aria-label="金額の照合" severity={severity} variant="outlined">
      <Stack spacing={1}>
        <TotalsRow label="お支払い（レシート合計）" amountLabel={vm.paidTotalLabel} />
        <TotalsRow
          amountLabel={vm.itemsPrintedTotalLabel}
          label="読み取った商品の合計"
          note={vm.gapPaidVsItemsNote}
        />
        <TotalsRow
          amountLabel={vm.receiptSubtotalLabel}
          label={subtotalLabel}
          note={vm.gapItemsVsSubtotalNote}
        />
        {vm.guidanceLines.map((line) => (
          <Typography key={line} variant="body2">
            {line}
          </Typography>
        ))}
        {bulkTaxAction}
      </Stack>
    </Alert>
  );
}
