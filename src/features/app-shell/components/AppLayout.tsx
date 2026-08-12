import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Box, useMediaQuery } from "@mui/material";
import { AnimatePresence } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import { PageTransition } from "../../ui";
import { AppBottomNav } from "./AppBottomNav";
import { AppDrawer } from "./AppDrawer";
import { NavigationPendingOutlet } from "./NavigationPendingOutlet";
import { UserMenu } from "./UserMenu";
import { createNavItems } from "../lib/navigationConfig";

export function AppLayout() {
  const theme = useTheme();
  const isPC = useMediaQuery(theme.breakpoints.up("md"));
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navItems = createNavItems();

  return (
    <Box className="app-layout">
      {isPC ? (
        <AppDrawer
          navItems={navItems}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          sidebarOpen={sidebarOpen}
        />
      ) : null}

      <Box
        className="app-layout-main"
        sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
      >
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <UserMenu />
        </Box>

        <Box component="main" sx={{ flex: 1 }}>
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <NavigationPendingOutlet />
            </PageTransition>
          </AnimatePresence>
        </Box>
      </Box>

      {!isPC ? <AppBottomNav navItems={navItems} /> : null}
    </Box>
  );
}
