import { Outlet, useNavigation } from "react-router-dom";
import { MonthlySummaryRouteFallback } from "./MonthlySummaryRouteFallback";

export function NavigationPendingOutlet() {
  const navigation = useNavigation();
  const isMonthlyNavigationPending =
    navigation.state !== "idle" && navigation.location?.pathname.startsWith("/months/");

  return isMonthlyNavigationPending ? <MonthlySummaryRouteFallback /> : <Outlet />;
}
