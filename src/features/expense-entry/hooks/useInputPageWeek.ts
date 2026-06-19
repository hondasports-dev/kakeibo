import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  addWeeks,
  getCurrentWeekStartDate,
  getWeekEndDate,
  isFutureWeek,
} from "../../../lib/weekNavigation";

export type InputPageWeekSession = {
  weekStartDate: string;
  weekEndDate: string;
  status: "draft" | "completed";
  reviewMemo?: string;
};

/**
 * 入力ページで任意週のセッションを取得または作成するカスタムフック。
 * 前週・次週ナビゲーションもサポートする。
 */
export function useInputPageWeek() {
  const getOrCreateSession = useMutation(api.weekSessions.getOrCreateWeekSession);

  // マウント時点の今週開始日を固定する（毎レンダーで再計算しないよう useMemo を使う）
  const currentWeekStartDate = useMemo(() => getCurrentWeekStartDate(), []);
  const [weekStartDate, setWeekStartDate] = useState(currentWeekStartDate);
  const weekEndDate = getWeekEndDate(weekStartDate);

  const [weekSession, setWeekSession] = useState<InputPageWeekSession | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadSession = useCallback(
    (targetWeekStartDate: string) => {
      setIsLoading(true);
      setWeekSession(null);
      setSessionError("");
      getOrCreateSession({ weekStartDate: targetWeekStartDate })
        .then((session) => {
          setWeekSession(session);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          console.error("週次セッション初期化失敗:", err);
          setSessionError("週次セッションの初期化に失敗しました。ページをリロードしてください。");
          setIsLoading(false);
        });
    },
    [getOrCreateSession],
  );

  useEffect(() => {
    loadSession(weekStartDate);
  }, [weekStartDate, loadSession]);

  const goToPreviousWeek = () => {
    setWeekStartDate((prev) => addWeeks(prev, -1));
  };

  const goToNextWeek = () => {
    const next = addWeeks(weekStartDate, 1);
    if (!isFutureWeek(next, currentWeekStartDate)) {
      setWeekStartDate(next);
    }
  };

  const isCurrentWeek = weekStartDate === currentWeekStartDate;

  return {
    weekStartDate,
    weekEndDate,
    weekSession,
    setWeekSession,
    sessionError,
    isLoading,
    isCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
  };
}
