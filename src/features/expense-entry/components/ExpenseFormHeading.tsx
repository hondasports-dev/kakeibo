import { Box, Typography } from "@mui/material";
import { CollapsibleHelp } from "../../ui";

interface ExpenseFormHeadingProps {
  isMultiMode: boolean;
}

export function ExpenseFormHeading({ isMultiMode }: ExpenseFormHeadingProps) {
  return (
    <Box>
      <Typography component="h2" variant="h5">
        入力
      </Typography>
      {!isMultiMode && (
        <CollapsibleHelp summary="入力のコツ">
          保存後は店舗名と金額だけ空にして、次の入力へ進みます。
        </CollapsibleHelp>
      )}
    </Box>
  );
}
