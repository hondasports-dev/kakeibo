import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { api } from "../../convex/_generated/api";
import { ReceiptForm } from "../components/ReceiptForm";
import { ReviewMemoPanel } from "../components/ReviewMemoPanel";
import { WeekStatusPanel } from "../components/WeekStatusPanel";

type WeekSession = {
  weekStartDate: string;
  weekEndDate: string;
  status: "draft" | "completed";
  budgetAmountYen?: number;
  reviewMemo?: string;
};

function formatWeekPeriod(weekStartDate: string, weekEndDate: string): string {
  const start = new Date(weekStartDate + "T00:00:00");
  const end = new Date(weekEndDate + "T00:00:00");
  const sy = start.getFullYear();
  const sm = start.getMonth() + 1;
  const sd = start.getDate();
  const em = end.getMonth() + 1;
  const ed = end.getDate();
  return `${sy}年${sm}月${sd}日 - ${em}月${ed}日`;
}

export function InputPage() {
  const theme = useTheme();
  const isPC = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();

  const getOrCreateSession = useMutation(api.weekSessions.getOrCreateCurrentWeekSession);
  const [weekSession, setWeekSession] = useState<WeekSession | null>(null);
  const [sessionError, setSessionError] = useState("");

  // getOrCreateCurrentWeekSession は副作用を持つ mutation のため useQuery ではなく useMutation を使用。
  const initSession = useCallback(() => {
    getOrCreateSession()
      .then(setWeekSession)
      .catch((err: unknown) => {
        console.error("週次セッション初期化失敗:", err);
        setSessionError("週次セッションの初期化に失敗しました。ページをリロードしてください。");
      });
  }, [getOrCreateSession]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const categories = useQuery(api.categories.listActive) ?? [];
  const receipts =
    useQuery(
      api.receipts.getReceiptsByWeek,
      weekSession ? { weekStartDate: weekSession.weekStartDate } : "skip",
    ) ?? [];

  const currentWeekSummary = useQuery(
    api.receipts.getWeekSummary,
    weekSession ? { weekStartDate: weekSession.weekStartDate } : "skip",
  );

  if (!weekSession && !sessionError) {
    return (
      <Box className="app-main">
        <Stack spacing={3} sx={{ alignItems: "center", py: 8 }}>
          <CircularProgress aria-label="データを読み込み中" />
          <Typography color="text.secondary">今週のセッションを準備しています...</Typography>
        </Stack>
      </Box>
    );
  }

  if (sessionError || !weekSession) {
    return (
      <Box className="app-main">
        <Alert severity="error" variant="outlined">
          {sessionError || "週次セッションの読み込みに失敗しました。"}
        </Alert>
      </Box>
    );
  }

  const { weekStartDate, weekEndDate } = weekSession;
  const totalAmountYen =
    currentWeekSummary?.totalAmountYen ?? receipts.reduce((sum, r) => sum + r.amountYen, 0);

  return (
    <Box className="app-main">
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography component="h1" variant="h4">
              今週のレシート入力
            </Typography>
            <Chip
              color={weekSession.status === "completed" ? "success" : "primary"}
              label={weekSession.status === "completed" ? "完了済み" : "入力中"}
              size="small"
              variant={weekSession.status === "completed" ? "filled" : "outlined"}
            />
          </Stack>
          <Typography color="text.secondary">
            {formatWeekPeriod(weekStartDate, weekEndDate)}
          </Typography>
        </Box>

        <Box className={isPC ? "workbench-grid" : undefined}>
          <ReceiptForm
            weekStartDate={weekStartDate}
            weekEndDate={weekEndDate}
            categories={categories}
          />

          {isPC && (
            <Stack spacing={2.5}>
              <ReviewMemoPanel
                weekSession={weekSession}
                totalAmountYen={totalAmountYen}
                prevWeekTotalAmountYen={currentWeekSummary?.prevWeekTotalAmountYen ?? null}
                isSummaryLoading={currentWeekSummary === undefined}
                onSessionUpdated={setWeekSession}
                onShowSummary={() => navigate(`/weeks/${weekStartDate}`)}
              />
              <WeekStatusPanel
                receipts={receipts}
                budgetAmountYen={weekSession.budgetAmountYen}
              />
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
