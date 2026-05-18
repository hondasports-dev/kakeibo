import { useCallback, useEffect, useState } from 'react'
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
  Collapse,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useInitializeUser } from './hooks/useInitializeUser'
import { ReceiptForm } from './components/ReceiptForm'
import { ReviewMemoPanel } from './components/ReviewMemoPanel'
import { WeekStatusPanel } from './components/WeekStatusPanel'
import { WeeklySummaryPanel } from './components/WeeklySummaryPanel'
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

function formatWeekPeriod(weekStartDate: string, weekEndDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00')
  const end = new Date(weekEndDate + 'T00:00:00')
  const sy = start.getFullYear()
  const sm = start.getMonth() + 1
  const sd = start.getDate()
  const em = end.getMonth() + 1
  const ed = end.getDate()
  return `${sy}年${sm}月${sd}日 - ${em}月${ed}日`
}

function KakeiboApp() {
  useInitializeUser()

  const getOrCreateSession = useMutation(api.weekSessions.getOrCreateCurrentWeekSession)
  const [weekSession, setWeekSession] = useState<{
    weekStartDate: string
    weekEndDate: string
    status: 'draft' | 'completed'
    budgetAmountYen?: number
    reviewMemo?: string
  } | null>(null)
  const [sessionError, setSessionError] = useState('')

  // getOrCreateCurrentWeekSession は副作用を持つ mutation のため useQuery ではなく useMutation を使用。
  // useEffect + useCallback でマウント時に一度だけ実行し、結果を local state に保持する。
  // Strict Mode での二重実行については、mutation の冪等性（同じ週のセッションは1回のみ作成）で担保している。
  const initSession = useCallback(() => {
    getOrCreateSession()
      .then(setWeekSession)
      .catch((err: unknown) => {
        console.error('週次セッション初期化失敗:', err)
        setSessionError('週次セッションの初期化に失敗しました。ページをリロードしてください。')
      })
  }, [getOrCreateSession])

  useEffect(() => {
    initSession()
  }, [initSession])

  const categories = useQuery(api.categories.listActive) ?? []
  const receipts = useQuery(
    api.receipts.getReceiptsByWeek,
    weekSession ? { weekStartDate: weekSession.weekStartDate } : 'skip',
  ) ?? []

  // 前週の weekStartDate を計算（今週の月曜 - 7日）
  const prevWeekStartDate = weekSession
    ? (() => {
        const d = new Date(weekSession.weekStartDate + 'T00:00:00')
        d.setDate(d.getDate() - 7)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dy = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dy}`
      })()
    : null

  const prevWeekSummary = useQuery(
    api.receipts.getWeekSummary,
    prevWeekStartDate ? { weekStartDate: prevWeekStartDate } : 'skip',
  )

  const weeklySummary = useQuery(
    api.receipts.getWeekSummaryWithCategories,
    weekSession
      ? {
          weekStartDate: weekSession.weekStartDate,
          prevWeekTotalAmountYen: prevWeekSummary?.totalAmountYen,
        }
      : 'skip',
  )

  const [showSummary, setShowSummary] = useState(false)

  const totalAmountYen = receipts.reduce((sum, r) => sum + r.amountYen, 0)
  const count = receipts.length
  const budgetAmountYen = weekSession?.budgetAmountYen
  const budgetRemaining =
    budgetAmountYen !== undefined ? budgetAmountYen - totalAmountYen : undefined

  // ローディング中
  if (!weekSession && !sessionError) {
    return (
      <Box className="app-shell">
        <Box component="main" className="app-main">
          <Stack spacing={3} sx={{ alignItems: 'center', py: 8 }}>
            <CircularProgress aria-label="データを読み込み中" />
            <Typography color="text.secondary">今週のセッションを準備しています...</Typography>
          </Stack>
        </Box>
      </Box>
    )
  }

  // セッション初期化エラー
  if (sessionError || !weekSession) {
    return (
      <Box className="app-shell">
        <Box component="main" className="app-main">
          <Alert severity="error" variant="outlined">
            {sessionError || '週次セッションの読み込みに失敗しました。'}
          </Alert>
        </Box>
      </Box>
    )
  }

  const { weekStartDate, weekEndDate } = weekSession

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
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography component="h1" variant="h4">
                  今週のレシート入力
                </Typography>
                <Chip
                  color={weekSession.status === 'completed' ? 'success' : 'primary'}
                  label={weekSession.status === 'completed' ? '完了済み' : '入力中'}
                  size="small"
                  variant={weekSession.status === 'completed' ? 'filled' : 'outlined'}
                />
              </Stack>
              <Typography color="text.secondary">
                {formatWeekPeriod(weekStartDate, weekEndDate)}
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
                aria-label={showSummary ? 'サマリーを閉じる' : '週次サマリーを見る'}
                size="large"
                variant={showSummary ? 'outlined' : 'contained'}
                onClick={() => setShowSummary((prev) => !prev)}
              >
                {showSummary ? 'サマリーを閉じる' : '週次サマリーを見る'}
              </Button>
              <UserMenu />
            </Stack>
          </Stack>

          <Box className="summary-grid">
            {[
              {
                label: '入力済み',
                value: `${count}件`,
                helper: '目安 10件',
                tone: 'primary' as const,
              },
              {
                label: '今週の支出',
                value: `${totalAmountYen.toLocaleString()}円`,
                helper:
                  budgetAmountYen !== undefined
                    ? `予算 ${budgetAmountYen.toLocaleString()}円`
                    : '予算未設定',
                tone: 'secondary' as const,
              },
              {
                label: '予算残り',
                value:
                  budgetRemaining !== undefined
                    ? `${budgetRemaining.toLocaleString()}円`
                    : '--',
                helper:
                  budgetRemaining !== undefined && budgetAmountYen
                    ? `${Math.round((budgetRemaining / budgetAmountYen) * 100)}% 残り`
                    : '',
                tone: 'success' as const,
              },
            ].map((item) => (
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

          <Collapse in={showSummary} unmountOnExit>
            <WeeklySummaryPanel
              count={weeklySummary?.count ?? 0}
              totalAmountYen={weeklySummary?.totalAmountYen ?? 0}
              byCategory={weeklySummary?.byCategory ?? []}
              prevWeekTotalAmountYen={weeklySummary?.prevWeekTotalAmountYen ?? null}
              receipts={weeklySummary?.receipts ?? []}
              budgetAmountYen={weekSession.budgetAmountYen}
              isLoading={weeklySummary === undefined}
            />
          </Collapse>

          <Box className="workbench-grid">
            <ReceiptForm
              weekStartDate={weekStartDate}
              weekEndDate={weekEndDate}
              categories={categories}
            />

            <Stack spacing={2.5}>
              <ReviewMemoPanel
                weekSession={weekSession}
                onSessionUpdated={setWeekSession}
                onShowSummary={() => setShowSummary(true)}
              />
              <WeekStatusPanel
                receipts={receipts}
                budgetAmountYen={weekSession.budgetAmountYen}
              />
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default App
