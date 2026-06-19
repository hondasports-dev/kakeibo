import { Box, LinearProgress, Paper, Skeleton, Stack, Typography } from "@mui/material";
import { AnimatedCounter } from "../../ui";
import type { CategorySummary } from "../types/types";

export function CategoryBreakdownCard({
  byCategory,
  count,
  isLoading,
  totalAmountYen,
}: {
  byCategory: CategorySummary[];
  count: number;
  isLoading: boolean;
  totalAmountYen: number;
}) {
  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">
            カテゴリ別
          </Typography>

          {isLoading ? (
            <>
              <Skeleton variant="text" height={32} />
              <Skeleton variant="text" height={32} />
              <Skeleton variant="text" height={32} />
            </>
          ) : count === 0 ? (
            <Typography color="text.secondary" variant="body2">
              まだレシートがありません
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {byCategory.map((cat) => (
                <Stack key={cat.categoryId} spacing={0.5}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "center" }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: cat.categoryColor,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2">{cat.categoryName}</Typography>
                      <Typography color="text.secondary" variant="caption">
                        <AnimatedCounter value={cat.count} suffix="件" />
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700 }} variant="body2">
                      <AnimatedCounter value={cat.totalAmountYen} suffix="円" />
                    </Typography>
                  </Stack>
                  {totalAmountYen > 0 && (
                    <LinearProgress
                      aria-label={`${cat.categoryName}の割合`}
                      value={Math.round((cat.totalAmountYen / totalAmountYen) * 100)}
                      variant="determinate"
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: "var(--color-border-track)",
                        "& .MuiLinearProgress-bar": {
                          backgroundColor: cat.categoryColor,
                        },
                      }}
                    />
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
