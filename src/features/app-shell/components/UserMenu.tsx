import { useState } from "react";
import { Link } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { Alert, Avatar, Button, Menu, MenuItem } from "@mui/material";
import { getClerkErrorMessage, getClerkUserFriendlyDisplayName } from "../../auth";

export function UserMenu() {
  const { openUserProfile, signOut } = useClerk();
  const { user } = useUser();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [signOutError, setSignOutError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const open = Boolean(anchorEl);
  const displayName = getClerkUserFriendlyDisplayName(user) ?? "ログイン中";

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
        aria-label="ユーザーメニューを開く"
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
        <MenuItem component={Link} onClick={handleClose} to="/updates">
          更新履歴
        </MenuItem>
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
