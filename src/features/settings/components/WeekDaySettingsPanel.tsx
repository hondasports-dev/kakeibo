import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "../../../../convex/_generated/api";

const DAY_OPTIONS = [
  { value: 0, label: "日曜日" },
  { value: 1, label: "月曜日" },
  { value: 2, label: "火曜日" },
  { value: 3, label: "水曜日" },
  { value: 4, label: "木曜日" },
  { value: 5, label: "金曜日" },
  { value: 6, label: "土曜日" },
];

export function WeekDaySettingsPanel() {
  const userProfile = useQuery(api.users.queries.getUserProfile);
  const updateWeeklyDays = useMutation(api.users.mutations.updateWeeklyDays);

  const [startDay, setStartDay] = useState<number>(1);
  const [endDay, setEndDay] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState("");

  useEffect(() => {
    if (userProfile) {
      setStartDay(userProfile.weeklyStartDay ?? 1);
      setEndDay(userProfile.weeklyEndDay ?? 0);
    }
  }, [userProfile]);

  if (userProfile === undefined) {
    return (
      <Paper className="paper-panel" elevation={0}>
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              設定を読み込んでいます。
            </Typography>
          </Stack>
        </Box>
      </Paper>
    );
  }

  const handleStartDayChange = (event: SelectChangeEvent<number>) => {
    setStartDay(Number(event.target.value));
  };

  const handleEndDayChange = (event: SelectChangeEvent<number>) => {
    setEndDay(Number(event.target.value));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateWeeklyDays({ weeklyStartDay: startDay, weeklyEndDay: endDay });
      setSnackbar("週の設定を保存しました");
    } catch {
      setSnackbar("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography component="h2" variant="h5">
              週の設定
            </Typography>
            <Typography color="text.secondary" variant="body2">
              週の始まりと終わりの曜日を調整します。
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="week-start-day-label">週の始まり</InputLabel>
              <Select
                labelId="week-start-day-label"
                id="week-start-day"
                value={startDay}
                label="週の始まり"
                onChange={handleStartDayChange}
              >
                {DAY_OPTIONS.map((day) => (
                  <MenuItem key={day.value} value={day.value}>
                    {day.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="week-end-day-label">週の終わり</InputLabel>
              <Select
                labelId="week-end-day-label"
                id="week-end-day"
                value={endDay}
                label="週の終わり"
                onChange={handleEndDayChange}
              >
                {DAY_OPTIONS.map((day) => (
                  <MenuItem key={day.value} value={day.value}>
                    {day.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Button
            disabled={isSaving}
            onClick={handleSave}
            startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
            variant="contained"
          >
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </Stack>
      </Box>

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={3000}
        onClose={() => setSnackbar("")}
        open={snackbar.length > 0}
      >
        <Alert onClose={() => setSnackbar("")} severity="success" sx={{ width: "100%" }}>
          {snackbar}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
