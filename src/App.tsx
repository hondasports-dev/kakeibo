import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import './App.css'

const summaryItems = [
  { label: '今週の支出', value: '18,420円', tone: 'primary' },
  { label: '未分類レシート', value: '4件', tone: 'warning' },
  { label: '予算残り', value: '31,580円', tone: 'success' },
] as const

const receipts = [
  { store: 'スーパー北浜', category: '食費', amount: '4,280円' },
  { store: 'ドラッグストア', category: '日用品', amount: '1,540円' },
  { store: 'カフェ', category: '外食', amount: '960円' },
]

function App() {
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
              <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
                週1レシート入力
              </Typography>
              <Typography color="text.secondary">
                レシートをまとめて入力し、支出の流れを週単位で確認します。
              </Typography>
            </Box>
            <Button variant="contained" size="large">
              レシートを追加
            </Button>
          </Stack>

          <Box className="summary-grid">
            {summaryItems.map((item) => (
              <Paper className="paper-panel" elevation={0} key={item.label}>
                <Box sx={{ p: 2.5 }}>
                  <Stack spacing={1}>
                    <Chip color={item.tone} label={item.label} size="small" />
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {item.value}
                    </Typography>
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Box>

          <Box className="entry-grid">
            <Paper className="paper-panel" elevation={0}>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2.5}>
                  <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
                    最近のレシート
                  </Typography>
                  <Box className="receipt-list">
                    {receipts.map((receipt) => (
                      <Box className="receipt-row" key={receipt.store}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {receipt.store}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            {receipt.category}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {receipt.amount}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              </Box>
            </Paper>

            <Paper className="paper-panel" elevation={0}>
              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2.5}>
                  <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
                    手入力
                  </Typography>
                  <TextField label="店舗名" fullWidth />
                  <TextField label="合計金額" fullWidth inputMode="numeric" />
                  <TextField label="メモ" fullWidth multiline minRows={3} />
                  <Divider />
                  <Button variant="contained">下書き保存</Button>
                </Stack>
              </Box>
            </Paper>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default App
