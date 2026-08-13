import { Outlet, useNavigation } from "react-router-dom";
import { MonthlySummaryRouteFallback } from "./MonthlySummaryRouteFallback";
import { YearlySummaryRouteFallback } from "./YearlySummaryRouteFallback";

export function NavigationPendingOutlet() {
  const navigation = useNavigation();
  const pendingPath = navigation.location?.pathname ?? "";
  const isMonthlyNavigationPending =
    navigation.state !== "idle" && pendingPath.startsWith("/months/");
  const isYearlyNavigationPending =
    navigation.state !== "idle" && pendingPath.startsWith("/years/");

  if (isMonthlyNavigationPending) {
    return <MonthlySummaryRouteFallback />;
  }
  if (isYearlyNavigationPending) {
    return <YearlySummaryRouteFallback />;
  }
  return <Outlet />;
}
