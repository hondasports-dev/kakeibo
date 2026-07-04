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
            sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 0.75 }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Typography variant="body2">{item.itemName || "（名称なし）"}</Typography>
              <Typography sx={{ textAlign: "right", whiteSpace: "nowrap" }} variant="body2">
                {amountYen.toLocaleString("ja-JP")}円
              </Typography>
              <Typography color="text.secondary" sx={{ whiteSpace: "nowrap" }} variant="body2">
                {categoryName}
              </Typography>
            </Stack>
            <ReviewItemTaxDetails item={item} />
            {item.warnings && item.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 0.75 }} variant="outlined">
                {formatTaxWarnings(item.warnings)}
              </Alert>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
