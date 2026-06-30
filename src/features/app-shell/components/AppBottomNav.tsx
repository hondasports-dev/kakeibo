import { Link, useLocation, useNavigate } from "react-router-dom";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { getBottomNavValue, type NavItem } from "../lib/navigationConfig";

type AppBottomNavProps = {
  navItems: NavItem[];
};

export function AppBottomNav({ navItems }: AppBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Paper
      aria-label="ボトムナビゲーション"
      component="nav"
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        borderTop: "1px solid",
        borderColor: "divider",
        borderRadius: 0,
        pb: "env(safe-area-inset-bottom)",
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={getBottomNavValue(location.pathname, navItems)}
        onChange={(_event, newValue: number) => {
          navigate(navItems[newValue].path);
        }}
        sx={{
          height: "var(--size-bottom-nav-height)",
          backgroundColor: "background.paper",
          "& .MuiBottomNavigationAction-root": {
            my: 0.5,
            mx: 0.25,
            minWidth: 64,
            borderRadius: 1,
            color: "secondary.dark",
            opacity: 1,
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.75rem",
              fontWeight: 700,
              opacity: 1,
            },
            "& .MuiSvgIcon-root": {
              fontSize: 24,
            },
          },
          "& .Mui-selected": {
            backgroundColor: "primary.light",
            color: "primary.dark",
          },
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
            component={Link}
            to={item.path}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
