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
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CategoryIcon from "@mui/icons-material/Category";
import HomeIcon from "@mui/icons-material/Home";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import { AnimatePresence } from "framer-motion";
import { useTheme } from "@mui/material/styles";
import { getCurrentWeekStartDate } from "../lib/weekNavigation";
import { getClerkErrorMessage } from "../lib/clerkError";
import { PageTransition } from "./PageTransition";

const DRAWER_WIDTH = 220;
const DRAWER_WIDTH_MINI = 56;

function UserMenu() {
  const { openUserProfile, signOut } = useClerk();
  const { user } = useUser();
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentWeekStartDate = getCurrentWeekStartDate();

  const navItems = [
    { label: "ホーム", path: "/", icon: <HomeIcon /> },
    { label: "入力", path: "/weeks/current/input", icon: <EditIcon /> },
    { label: "履歴", path: `/weeks/${currentWeekStartDate}`, icon: <HistoryIcon /> },
    { label: "カテゴリ", path: "/categories", icon: <CategoryIcon /> },
  ];

  const getBottomNavValue = () => {
    if (location.pathname === "/") return 0;
    if (location.pathname === "/weeks/current/input") return 1;
    if (location.pathname.startsWith("/weeks/")) return 2;
    if (location.pathname === "/categories") return 3;
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

  const drawerWidth = sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_MINI;

  return (
    <Box className="app-layout">
      {isPC && (
        <Drawer
          aria-label="サイドメニュー"
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: sidebarOpen
                  ? theme.transitions.duration.enteringScreen
                  : theme.transitions.duration.leavingScreen,
              }),
            },
          }}
        >
          <Toolbar
            sx={{
              justifyContent: sidebarOpen ? "space-between" : "center",
              px: sidebarOpen ? 2 : 0,
            }}
          >
            {sidebarOpen && (
              <Typography
                component={Link}
                to="/"
                variant="h6"
                sx={{ textDecoration: "none", color: "inherit", fontWeight: 700 }}
              >
                家計簿
              </Typography>
            )}
            <IconButton
              aria-label={sidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
              onClick={() => setSidebarOpen((prev) => !prev)}
              size="small"
            >
              {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Toolbar>
          <Divider />
          <List>
            {navItems.map((item) => (
              <Tooltip
                key={item.path}
                title={sidebarOpen ? "" : item.label}
                placement="right"
                arrow
              >
                <ListItemButton
                  selected={isNavItemSelected(item.path)}
                  onClick={() => navigate(item.path)}
                  component={Link}
                  to={item.path}
                  sx={{ justifyContent: sidebarOpen ? "flex-start" : "center", px: 1.5 }}
                >
                  <ListItemIcon
                    sx={{ minWidth: 0, mr: sidebarOpen ? 1.5 : 0, justifyContent: "center" }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {sidebarOpen && <ListItemText primary={item.label} />}
                </ListItemButton>
              </Tooltip>
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
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </Box>
      </Box>

      {!isPC && (
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
            value={getBottomNavValue()}
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
      )}
    </Box>
  );
}
