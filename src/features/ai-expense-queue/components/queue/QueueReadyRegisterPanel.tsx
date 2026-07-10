import { useState } from "react";
import { Button, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { AiExpenseQueueItem } from "../../types/types";
import { BulkRegisterConfirmDialog } from "../BulkRegisterConfirmDialog";

const amountFormatter = new Intl.NumberFormat("ja-JP");

type QueueReadyRegisterPanelProps = {
  readyItems: AiExpenseQueueItem[];
  selectedReadyIds: string[];
  registeringIds: string[];
  onRegisterReady: (itemIds?: string[]) => Promise<void>;
};

export function QueueReadyRegisterPanel({
  readyItems,
  selectedReadyIds,
  registeringIds,
  onRegisterReady,
}: QueueReadyRegisterPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInFlight, setConfirmInFlight] = useState(false);

  const selectedTotalAmountYen = readyItems
    .filter((item) => selectedReadyIds.includes(item.id))
    .reduce((total, item) => total + (item.amountYen ?? 0), 0);

  const handleConfirmRegister = async () => {
    if (confirmInFlight) {
      return;
    }
    setConfirmInFlight(true);
    try {
      await onRegisterReady();
      setConfirmOpen(false);
    } finally {
      setConfirmInFlight(false);
    }
  };

  if (readyItems.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        登録できる下書きが{readyItems.length}件あります
        {selectedReadyIds.length > 0 &&
          `（選択中 ${selectedReadyIds.length}件 / 合計 ${amountFormatter.format(selectedTotalAmountYen)}円）`}
      </Typography>
      <Button
        color="primary"
        startIcon={<CheckCircleIcon />}
        disabled={selectedReadyIds.length === 0 || registeringIds.length > 0}
        onClick={() => setConfirmOpen(true)}
        type="button"
        variant="contained"
        sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
      >
        まとめて登録（{selectedReadyIds.length}件）
      </Button>

      <BulkRegisterConfirmDialog
        confirmDisabled={confirmInFlight || registeringIds.length > 0}
        count={selectedReadyIds.length}
        open={confirmOpen}
        totalAmountYen={selectedTotalAmountYen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmRegister()}
      />
    </Stack>
  );
}
