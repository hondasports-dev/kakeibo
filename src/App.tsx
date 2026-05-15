import { useState } from 'react'
import {
  AuthenticateWithRedirectCallback,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react'
import { useSignIn } from '@clerk/react/legacy'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useConvexAuth } from 'convex/react'
import { useInitializeUser } from './hooks/useInitializeUser'
import './App.css'

const OAUTH_CALLBACK_PATH = '/sso-callback'

function getClerkErrorMessage(error: unknown, fallbackMessage: string) {
  const clerkError = error as {
    errors?: Array<{ longMessage?: string; message?: string }>
  }

  return (
    clerkError.errors?.[0]?.longMessage ??
    clerkError.errors?.[0]?.message ??
    fallbackMessage
  )
}

const summaryItems = [
  { label: '入力済み', value: '3件', helper: '目安 10件', tone: 'primary' },
  { label: '今週の支出', value: '18,420円', helper: '予算 50,000円', tone: 'secondary' },
  { label: '予算残り', value: '31,580円', helper: '63% 残り', tone: 'success' },
] as const

const receipts = [
  {
    id: 'receipt-super-kitahama-2026-05-12',
    store: 'スーパー北浜',
    category: '食費',
    amount: '4,280円',
    date: '5/12',
  },
  {
    id: 'receipt-drugstore-2026-05-12',
    store: 'ドラッグストア',
    category: '日用品',
    amount: '1,540円',
    date: '5/12',
  },
  {
    id: 'receipt-cafe-2026-05-11',
    store: 'カフェ',
    category: '外食',
    amount: '960円',
    date: '5/11',
  },
] as const

const categories = [
  { label: '食費', color: '#0f766e', selected: true },
  { label: '日用品', color: '#2563eb', selected: false },
  { label: '外食', color: '#b45309', selected: false },
  { label: '交通', color: '#7c3aed', selected: false },
  { label: '医療', color: '#be123c', selected: false },
  { label: '娯楽', color: '#7c3aed', selected: false },
  { label: '衣服', color: '#c2410c', selected: false },
  { label: 'その他', color: '#64748b', selected: false },
] as const

const weekDays = [
  { label: '月', date: '5/11', selected: true },
  { label: '火', date: '5/12', selected: false },
  { label: '水', date: '5/13', selected: false },
  { label: '木', date: '5/14', selected: false },
  { label: '金', date: '5/15', selected: false },
  { label: '土', date: '5/16', selected: false },
  { label: '日', date: '5/17', selected: false },
] as const

function App() {
  if (window.location.pathname === OAUTH_CALLBACK_PATH) {
    return <AuthCallbackScreen />
  }

  return <AuthenticatedApp />
}

function AuthCallbackScreen() {
  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={2.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <CircularProgress aria-label="Googleログイン処理中" />
          <Box>
            <Typography component="h1" variant="h5">
              Googleログインを処理中
            </Typography>
            <Typography color="text.secondary" variant="body2">
              認証が完了したら家計簿画面に戻ります。
            </Typography>
          </Box>
          <AuthenticateWithRedirectCallback
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          />
        </Stack>
      </Paper>
    </Box>
  )
}

function AuthenticatedApp() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } =
    useConvexAuth()

  if (!isLoaded) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Stack spacing={2.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <CircularProgress aria-label="ログイン状態を確認中" />
            <Typography color="text.secondary">ログイン状態を確認しています。</Typography>
          </Stack>
        </Paper>
      </Box>
    )
  }

  if (!isSignedIn) {
    return <SignedOutScreen />
  }

  if (isConvexAuthLoading) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Stack spacing={2.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <CircularProgress aria-label="Convex認証状態を確認中" />
            <Typography color="text.secondary">データ同期の認証状態を確認しています。</Typography>
          </Stack>
        </Paper>
      </Box>
    )
  }

  if (!isConvexAuthenticated) {
    return (
      <Box className="auth-screen">
        <Paper className="auth-panel paper-panel" elevation={0}>
          <Alert severity="error" variant="outlined">
            Clerkログインは完了していますが、Convexで認証できませんでした。
            ClerkのConvex連携とCLERK_JWT_ISSUER_DOMAINを確認してください。
          </Alert>
        </Paper>
      </Box>
    )
  }

  return <KakeiboApp />
}

function SignedOutScreen() {
  const { isLoaded, signIn } = useSignIn()
  const [error, setError] = useState('')
  const [isRedirecting, setIsRedirecting] = useState(false)

  const handleGoogleSignIn = async () => {
    if (!isLoaded) {
      return
    }

    setError('')
    setIsRedirecting(true)

    try {
      await signIn.authenticateWithRedirect({
        redirectUrl: OAUTH_CALLBACK_PATH,
        redirectUrlComplete: '/',
        strategy: 'oauth_google',
      })
    } catch (caughtError) {
      setError(
        getClerkErrorMessage(
          caughtError,
          'Googleログインを開始できませんでした。Clerk DashboardのGoogle OAuth設定を確認してください。',
        ),
      )
      setIsRedirecting(false)
    }
  }

  return (
    <Box className="auth-screen">
      <Paper className="auth-panel paper-panel" elevation={0}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              家計簿にログイン
            </Typography>
            <Typography color="text.secondary">
              実在するGoogleアカウントでログインすると、レシート入力画面を確認できます。
            </Typography>
          </Box>

          <Alert severity="info" variant="outlined">
            Clerkの開発用テストユーザーではGoogle OAuthにログインできません。
            Googleの認証画面では、実際に使えるGoogleアカウントを入力してください。
          </Alert>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Button
            disabled={!isLoaded || isRedirecting}
            onClick={handleGoogleSignIn}
            size="large"
            variant="contained"
          >
            {isRedirecting ? 'Googleへ移動しています' : 'Googleでログイン'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}

function UserMenu() {
  const { openUserProfile, signOut } = useClerk()
  const { user } = useUser()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [signOutError, setSignOutError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const open = Boolean(anchorEl)
  const displayName =
    user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'ログイン中'

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleOpenProfile = () => {
    handleClose()
    openUserProfile()
  }

  const handleSignOut = async () => {
    if (isSigningOut) {
      return
    }

    handleClose()
    setSignOutError('')
    setIsSigningOut(true)

    try {
      await signOut({ redirectUrl: '/' })
    } catch (caughtError) {
      setSignOutError(
        getClerkErrorMessage(
          caughtError,
          'ログアウトできませんでした。通信状態を確認して、もう一度お試しください。',
        ),
      )
      setIsSigningOut(false)
    }
  }

  return (
    <>
      {signOutError ? (
        <Alert
          onClose={() => setSignOutError('')}
          severity="error"
          sx={{ width: { xs: '100%', sm: 360 } }}
          variant="outlined"
        >
          {signOutError}
        </Alert>
      ) : null}
      <Button
        aria-controls={open ? 'user-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
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
        <span>{isSigningOut ? 'ログアウト中' : displayName}</span>
      </Button>
      <Menu
        anchorEl={anchorEl}
        id="user-menu"
        onClose={handleClose}
        open={open}
      >
        <MenuItem disabled={isSigningOut} onClick={handleOpenProfile}>
          アカウント設定
        </MenuItem>
        <MenuItem disabled={isSigningOut} onClick={handleSignOut}>
          ログアウト
        </MenuItem>
      </Menu>
    </>
  )
}

function KakeiboApp() {
  useInitializeUser()

  return (
    <Box className="app-shell">
      <Box component="main" className="app-main">
        <Stack spacing={3}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography component="h1" variant="h4">
                今週のレシート入力
              </Typography>
              <Typography color="text.secondary">
                2026年5月11日 - 5月17日
              </Typography>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{
                alignItems: { xs: 'stretch', sm: 'center' },
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <Button
                aria-label="週次サマリーを見る"
                size="large"
                variant="contained"
              >
                週次サマリーを見る
              </Button>
              <UserMenu />
            </Stack>
          </Stack>

          <Box className="summary-grid">
            {summaryItems.map((item) => (
              <Paper className="paper-panel" elevation={0} key={item.label}>
                <Box sx={{ p: 2.5 }}>
                  <Stack spacing={1}>
                    <Chip color={item.tone} label={item.label} size="small" />
                    <Typography variant="h4">{item.value}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {item.helper}
                    </Typography>
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Box>

          <Box className="workbench-grid">
            <Paper className="paper-panel" elevation={0}>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography component="h2" variant="h5">
                      レシートを追加
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      保存後は店名と金額だけ空にして、次の入力へ進みます。
                    </Typography>
                  </Box>

                  <Alert severity="info" variant="outlined">
                    前回の日付とカテゴリを引き継いで、次のレシートを続けて入力できます。
                  </Alert>

                  <Box className="week-day-grid" aria-label="週内の日付候補" role="list">
                    {weekDays.map((day) => (
                      <Box
                        aria-label={`${day.label}曜日 ${day.date}${
                          day.selected ? ' 選択中' : ''
                        }`}
                        className="week-day-button"
                        key={day.label}
                        role="listitem"
                        sx={{
                          border: '1px solid',
                          borderColor: day.selected ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          bgcolor: day.selected ? 'primary.main' : 'background.paper',
                          color: day.selected ? 'primary.contrastText' : 'text.primary',
                          px: 1,
                          py: 1,
                          textAlign: 'center',
                        }}
                      >
                        <span>{day.label}</span>
                        <small>{day.date}</small>
                      </Box>
                    ))}
                  </Box>

                  <TextField
                    defaultValue="2026-05-11"
                    fullWidth
                    id="receipt-date"
                    label="日付"
                    name="date"
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: {
                        max: '2026-05-17',
                        min: '2026-05-11',
                      },
                    }}
                    type="date"
                  />
                  <TextField
                    autoComplete="organization"
                    fullWidth
                    id="receipt-shop-name"
                    label="店舗名"
                    name="shopName"
                    placeholder="例: スーパー北浜"
                  />
                  <TextField
                    fullWidth
                    id="receipt-amount-yen"
                    label="合計金額"
                    name="amountYen"
                    placeholder="例: 4280"
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                      },
                    }}
                  />

                  <Stack spacing={1}>
                    <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
                      カテゴリ
                    </Typography>
                    <Box className="category-grid" aria-label="カテゴリ候補" role="list">
                      {categories.map((category) => (
                        <Box
                          aria-label={`${category.label}${
                            category.selected ? ' 選択中' : ''
                          }`}
                          className="category-button"
                          key={category.label}
                          role="listitem"
                          sx={
                            category.selected
                              ? {
                                  border: '1px solid',
                                  borderColor: 'primary.main',
                                  borderRadius: 1,
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  px: 1,
                                  py: 0.75,
                                  textAlign: 'center',
                                }
                              : {
                                  border: '1px solid',
                                  borderColor: category.color,
                                  borderRadius: 1,
                                  color: category.color,
                                  px: 1,
                                  py: 0.75,
                                  textAlign: 'center',
                                }
                          }
                        >
                          {category.label}
                        </Box>
                      ))}
                    </Box>
                  </Stack>

                  <TextField
                    fullWidth
                    id="receipt-memo"
                    label="メモ"
                    minRows={3}
                    multiline
                    name="memo"
                    placeholder="任意"
                  />

                  <Divider />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button className="primary-action" variant="contained">
                      保存して次へ
                    </Button>
                    <Button variant="outlined">保存して完了</Button>
                  </Stack>
                </Stack>
              </Box>
            </Paper>

            <Stack spacing={2.5}>
              <Paper className="paper-panel" elevation={0}>
                <Box sx={{ p: 2.5 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                      <Typography component="h2" variant="h6">
                        今週の進捗
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        3 / 10件
                      </Typography>
                    </Stack>
                    <LinearProgress
                      aria-label="今週の入力進捗"
                      value={30}
                      variant="determinate"
                    />
                    <Box className="budget-strip">
                      <span>予算消化</span>
                      <strong>36.8%</strong>
                    </Box>
                  </Stack>
                </Box>
              </Paper>

              <Paper className="paper-panel" elevation={0}>
                <Box sx={{ p: 2.5 }}>
                  <Stack spacing={2.5}>
                    <Typography component="h2" variant="h6">
                      直近の入力
                    </Typography>
                    <Box className="receipt-list">
                      {receipts.map((receipt) => (
                        <Box className="receipt-row" key={receipt.id}>
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>
                              {receipt.store}
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                              {receipt.date} / {receipt.category}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {receipt.amount}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    <Divider />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button variant="outlined">直前を複製</Button>
                      <Button color="secondary" variant="outlined">
                        直前を取り消す
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Paper>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default App
