import { Alert, Box, Stack, Typography } from "@mui/material";
import type { AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";
import { ReviewItemTaxDetails } from "./ReviewItemTaxDetails";
import { formatTaxWarnings } from "../../utils/taxWarnings";

export function ReviewItemsReadOnly({
  categories,
  reviewItems,
}: {
  categories: AiExpenseQueueCategory[];
  reviewItems: ReviewItemValues[];
}) {
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {reviewItems.map((item) => {
        const categoryName =
          categories.find((category) => category._id === item.categoryId)?.name ?? "未分類";
        const amountYen = Number(item.amountYen) || 0;
        return (
          <Box
            component="li"
            key={item.id}
            sx={{
              alignItems: "baseline",
              borderBottom: "1px solid",
              borderColor: "divider",
              columnGap: 1.5,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(72px, auto) minmax(56px, auto)",
              pb: 0.75,
              rowGap: 0.25,
            }}
          >
            <Typography sx={{ minWidth: 0, overflowWrap: "anywhere" }} variant="body2">
              {item.itemName || "（名称なし）"}
            </Typography>
            <Typography
              sx={{ fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" }}
              variant="body2"
            >
              {amountYen.toLocaleString("ja-JP")}円
            </Typography>
            <Typography color="text.secondary" sx={{ textAlign: "right" }} variant="body2">
              {categoryName}
            </Typography>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <ReviewItemTaxDetails item={item} />
            </Box>
            {item.warnings && item.warnings.length > 0 && (
              <Alert severity="warning" sx={{ gridColumn: "1 / -1", mt: 0.5 }} variant="outlined">
                {formatTaxWarnings(item.warnings)}
              </Alert>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
