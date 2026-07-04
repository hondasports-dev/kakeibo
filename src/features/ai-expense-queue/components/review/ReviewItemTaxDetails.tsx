import { Stack, Typography } from "@mui/material";
import type { ReviewItemValues } from "../../types/types";

const amountBasisLabels = {
  tax_included: "税込印字",
  tax_excluded: "税抜印字",
  unknown: "税込・税抜不明",
} as const;

export function ReviewItemTaxDetails({ item }: { item: ReviewItemValues }) {
  const hasDetails =
    item.printedAmountYen !== undefined ||
    item.amountBasis !== undefined ||
    item.taxRatePercent !== undefined ||
    item.allocatedTaxYen !== undefined ||
    item.quantity !== undefined ||
    item.unitPriceYen !== undefined;
  if (!hasDetails) return null;

  return (
    <Stack
      aria-label={`${item.itemName || "明細"}の税情報`}
      direction="row"
      spacing={1.5}
      sx={{ flexWrap: "wrap" }}
    >
      {item.printedAmountYen !== undefined && (
        <Typography color="text.secondary" variant="body2">
          印字額 {item.printedAmountYen.toLocaleString("ja-JP")}円
        </Typography>
      )}
      {item.amountBasis !== undefined && (
        <Typography color="text.secondary" variant="body2">
          {amountBasisLabels[item.amountBasis]}
        </Typography>
      )}
      {item.taxRatePercent !== undefined && (
        <Typography color="text.secondary" variant="body2">
          税率 {item.taxRatePercent === null ? "不明" : `${item.taxRatePercent}%`}
        </Typography>
      )}
      {item.allocatedTaxYen !== undefined && (
        <Typography color="text.secondary" variant="body2">
          按分税 {item.allocatedTaxYen.toLocaleString("ja-JP")}円
        </Typography>
      )}
      {item.quantity !== undefined && item.unitPriceYen !== undefined && (
        <Typography color="text.secondary" variant="body2">
          {item.quantity}点 × {item.unitPriceYen.toLocaleString("ja-JP")}円
        </Typography>
      )}
    </Stack>
  );
}
