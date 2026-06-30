import { Box, Stack, Typography } from "@mui/material";
import type { AiExpenseQueueCategory, ReviewItemValues } from "../../types/types";

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
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr auto", sm: "minmax(0, 1fr) auto auto" },
              alignItems: "center",
            }}
          >
            <Typography variant="body2">{item.itemName || "（名称なし）"}</Typography>
            <Typography sx={{ textAlign: "right", whiteSpace: "nowrap" }} variant="body2">
              {amountYen.toLocaleString("ja-JP")}円
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: "nowrap" }} variant="body2">
              {categoryName}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
