import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import {
  Alert,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { normalizeWeekStartDate } from "../lib/weekNavigation";

const DRAWER_WIDTH = 220;

function getClerkErrorMessage(error: unknown, fallbackMessage: string) {
  const clerkError = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
  };
  return clerkError.errors?.[0]?.longMessage ?? clerkError.errors?.[0]?.message ?? fallbackMessage;
}

function getCurrentWeekStartDate(): string {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return normalizeWeekStartDate(iso) ?? iso;
}

function UserMenu() {
  const { openUserProfile, signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const open = Boolean(anchorEl);
  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "ログイン中";

  const handleClose = () => setAnchorEl(null);

  const handleOpenProfile = () => {
    handleClose();
    openUserProfile();
  };

  const handleOpenUserSettings = () => {
    handleClose();
    navigate("/settings");
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    handleClose();
    setSignOutError("");
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: "/" });
    } catch (caughtError) {
      setSignOutError(
        getClerkErrorMessage(
          caughtError,
          "ログアウトできませんでした。通信状態を確認して、もう一度お試しください。",
        ),
      );
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {signOutError ? (
        <Alert
          onClose={() => setSignOutError("")}
          severity="error"
          sx={{ width: { xs: "100%", sm: 360 } }}
          variant="outlined"
        >
          {signOutError}
        </Alert>
      ) : null}
      <Button
        aria-controls={open ? "user-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="menu"
        className="user-menu-button"
        color="secondary"
        disabled={isSigningOut}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="outlined"
      >
        <Avatar alt={displayName} src={user?.imageUrl} sx={{ height: 24, width: 24 }}>
          {displayName.slice(0, 1)}
        </Avatar>
        <span>{isSigningOut ? "ログアウト中" : displayName}</span>
      </Button>
      <Menu anchorEl={anchorEl} id="user-menu" onClose={handleClose} open={open}>
        <MenuItem disabled={isSigningOut} onClick={handleOpenProfile}>
          アカウント設定
        </MenuItem>
        <MenuItem disabled={isSigningOut} onClick={handleOpenUserSettings}>
          ユーザー設定
        </MenuItem>
        <MenuItem disabled={isSigningOut} onClick={handleSignOut}>
          ログアウト
        </MenuItem>
      </Menu>
    </>
  );
}

export function AppLayout() {
  const theme = useTheme();
  const isPC = useMediaQuery(theme.breakpoints.up("md"));
  const location = useLocation();
  const navigate = useNavigate();

  const currentWeekStartDate = getCurrentWeekStartDate();

  const navItems = [
    { label: "ホーム", path: "/" },
    { label: "入力", path: "/weeks/current/input" },
    { label: "履歴", path: `/weeks/${currentWeekStartDate}` },
    { label: "設定", path: "/settings" },
  ];

  const getBottomNavValue = () => {
    if (location.pathname === "/") return 0;
    if (location.pathname === "/weeks/current/input") return 1;
    if (location.pathname.startsWith("/weeks/")) return 2;
    if (location.pathname === "/settings") return 3;
    return 0;
  };

  const isNavItemSelected = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/weeks/current/input") return location.pathname === "/weeks/current/input";
    if (path.startsWith("/weeks/"))
      return (
        location.pathname.startsWith("/weeks/") && location.pathname !== "/weeks/current/input"
      );
    return location.pathname === path;
  };

  return (
    <Box className="app-layout">
      {isPC && (
        <Drawer
          aria-label="サイドメニュー"
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar>
            <Typography
              component={Link}
              to="/"
              variant="h6"
              sx={{ textDecoration: "none", color: "inherit", fontWeight: 700 }}
            >
              家計簿
            </Typography>
          </Toolbar>
          <Divider />
          <List>
            {navItems.map((item) => (
              <ListItemButton
                key={item.path}
                selected={isNavItemSelected(item.path)}
                onClick={() => navigate(item.path)}
                component={Link}
                to={item.path}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

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
          <Outlet />
        </Box>
      </Box>

      {!isPC && (
        <Paper
          aria-label="ボトムナビゲーション"
          component="nav"
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1200 }}
          elevation={3}
        >
          <BottomNavigation
            value={getBottomNavValue()}
            onChange={(_event, newValue: number) => {
              navigate(navItems[newValue].path);
            }}
          >
            {navItems.map((item) => (
              <BottomNavigationAction
                key={item.path}
                label={item.label}
                component={Link}
                to={item.path}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
