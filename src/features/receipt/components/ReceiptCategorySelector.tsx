import type { Id } from "../../../../convex/_generated/dataModel";
import { Box, Stack, Typography } from "@mui/material";

type Category = { _id: Id<"categories">; name: string; color: string };

export function ReceiptCategorySelector({
  categories,
  error,
  selectedCategoryId,
  onSelectCategory,
}: {
  categories: Category[];
  error?: string;
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: Id<"categories">) => void;
}) {
  return (
    <Stack spacing={1}>
      <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
        カテゴリ
      </Typography>
      {error && (
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      )}
      <Box className="category-grid" aria-label="カテゴリ候補" role="listbox">
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category._id;
          return (
            <Box
              aria-label={`${category.name}${isSelected ? " 選択中" : ""}`}
              aria-selected={isSelected}
              className="category-button"
              key={category._id}
              onClick={() => onSelectCategory(category._id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCategory(category._id);
                }
              }}
              role="option"
              tabIndex={0}
              sx={
                isSelected
                  ? {
                      border: "1px solid",
                      borderColor: "primary.main",
                      borderRadius: 1,
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      px: 1,
                      py: 0.75,
                      textAlign: "center",
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.main",
                        outlineOffset: "2px",
                      },
                    }
                  : {
                      border: "1px solid",
                      borderColor: category.color,
                      borderRadius: 1,
                      color: category.color,
                      px: 1,
                      py: 0.75,
                      textAlign: "center",
                      cursor: "pointer",
                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: category.color,
                        outlineOffset: "2px",
                      },
                    }
              }
            >
              {category.name}
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
