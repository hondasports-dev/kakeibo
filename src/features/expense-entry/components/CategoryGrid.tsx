import { Box, Typography } from "@mui/material";
import type { ExpenseEntryCategory } from "../types/types";

export function CategoryGrid({
  ariaLabel,
  categories,
  selectedCategoryId,
  onSelect,
  compact = false,
}: {
  ariaLabel: string;
  categories: ExpenseEntryCategory[];
  selectedCategoryId?: string;
  onSelect: (categoryId: string) => void;
  compact?: boolean;
}) {
  return (
    <Box className="category-grid" aria-label={ariaLabel} role="listbox">
      {categories.map((category) => {
        const isSelected = selectedCategoryId === category._id;
        return (
          <Box
            key={category._id}
            aria-label={`${category.name}${isSelected ? " 選択中" : ""}`}
            aria-selected={isSelected}
            className="category-button"
            role="option"
            tabIndex={0}
            onClick={() => onSelect(category._id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(category._id);
              }
            }}
            sx={{
              border: "1px solid",
              borderColor: isSelected ? "primary.main" : "divider",
              borderRadius: 1,
              bgcolor: isSelected ? "primary.main" : "background.paper",
              color: isSelected ? "primary.contrastText" : "text.primary",
              px: 1,
              py: compact ? 0.75 : 1,
              textAlign: "center",
              cursor: "pointer",
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "2px",
              },
            }}
          >
            {compact ? (
              <Typography variant="caption">{category.name}</Typography>
            ) : (
              <span>{category.name}</span>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
