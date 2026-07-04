import { Stack, Typography } from "@mui/material";
import type { ReviewItemValues } from "../../types/types";
import { getAmountBasisLabel } from "../../utils/receiptTaxLabels";
import {
  buildTaxContextFromReviewItem,
  toReceiptItemTaxViewModel,
} from "../../utils/receiptItemTaxViewModel";
import { TaxResolutionReason } from "./TaxResolutionReason";

export function ReceiptItemTaxDetail({
  item,
  draft,
}: {
  item: ReviewItemValues;
  draft?: { markerDefinitions?: Array<{ marker: string; description: string }> } | null;
}) {
  const vm = toReceiptItemTaxViewModel(item);
  const context = buildTaxContextFromReviewItem(item);

  return (
    <Stack aria-label={`${vm.itemName || "明細"}の税詳細`} spacing={0.75}>
      <Typography sx={{ fontWeight: 600 }} variant="subtitle2">
        レシート印字
      </Typography>
      <Typography variant="body2">印字金額 {vm.printedAmountLabel}</Typography>
      {vm.markerLabels.length > 0 && (
        <Typography variant="body2">レシート記号 {vm.markerLabels.join(", ")}</Typography>
      )}
      {vm.markerLabels.map((marker) => {
        const definition = draft?.markerDefinitions?.find((entry) => entry.marker === marker);
        if (!definition) {
          return null;
        }
        return (
          <Typography color="text.secondary" key={marker} variant="body2">
            レシート内の説明: {definition.description}
          </Typography>
        );
      })}

      <Typography sx={{ fontWeight: 600, pt: 0.5 }} variant="subtitle2">
        分析結果
      </Typography>
      <Typography variant="body2">登録金額 {vm.normalizedAmountLabel}</Typography>
      <Typography variant="body2">税率 {vm.taxRateLabel}</Typography>
      <Typography variant="body2">金額種別 {getAmountBasisLabel(context.amountBasis)}</Typography>
      <Typography variant="body2">按分税 {vm.allocatedTaxLabel}</Typography>
      <Typography variant="body2">
        判定状態 {context.status === "resolved" ? "解決済み" : "要確認"}
      </Typography>
      <Typography variant="body2">判定根拠</Typography>
      <TaxResolutionReason context={context} />
    </Stack>
  );
}
