import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  validateReceiptForm,
  type ReceiptFormErrors,
} from '../validation/receipt'

interface ReceiptFormProps {
  weekStartDate: string
  weekEndDate: string
  categories: Array<{ _id: string; name: string; color: string }>
}

/**
 * 週の日付リストを生成する。weekStartDate から weekEndDate まで。
 */
function generateWeekDays(weekStartDate: string, weekEndDate: string) {
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土']
  const days: Array<{ label: string; date: string; isoDate: string }> = []
  const start = new Date(weekStartDate + 'T00:00:00')
  const end = new Date(weekEndDate + 'T00:00:00')

  const current = new Date(start)
  while (current <= end) {
    const m = current.getMonth() + 1
    const d = current.getDate()
    const y = current.getFullYear()
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    days.push({
      label: dayLabels[current.getDay()],
      date: `${m}/${d}`,
      isoDate: `${y}-${mm}-${dd}`,
    })
    current.setDate(current.getDate() + 1)
  }
  return days
}

export function ReceiptForm({ weekStartDate, weekEndDate, categories }: ReceiptFormProps) {
  const [formValues, setFormValues] = useState({
    date: weekStartDate,
    shopName: '',
    amountYen: '',
    categoryId: categories[0]?._id ?? '',
    memo: '',
  })
  const [errors, setErrors] = useState<ReceiptFormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [apiError, setApiError] = useState('')

  const createReceipt = useMutation(api.receipts.createReceipt)

  const weekDays = generateWeekDays(weekStartDate, weekEndDate)

  const handleFieldChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
    // フィールド変更時にそのフィールドのエラーをクリア
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateReceiptForm(formValues)
    if (!validation.success) {
      setErrors(validation.errors)
      return
    }
    setStatus('submitting')
    setApiError('')
    try {
      await createReceipt({
        date: validation.data.date,
        shopName: validation.data.shopName,
        amountYen: validation.data.amountYen,
        categoryId: validation.data.categoryId as Id<'categories'>,
        memo: validation.data.memo,
      })
      // 保存成功 → 店名・金額・メモをクリア、日付・カテゴリを引き継ぐ
      setFormValues((prev) => ({ ...prev, shopName: '', amountYen: '', memo: '' }))
      setErrors({})
      setStatus('success')
      // 2秒後にsuccessをidleに戻す
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setStatus('error')
      setApiError(
        err instanceof Error ? err.message : '保存に失敗しました。もう一度お試しください。',
      )
    }
  }

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <Box>
              <Typography component="h2" variant="h5">
                レシートを追加
              </Typography>
              <Typography color="text.secondary" variant="body2">
                保存後は店名と金額だけ空にして、次の入力へ進みます。
              </Typography>
            </Box>

            {status === 'success' && (
              <Alert severity="success" variant="outlined">
                レシートを保存しました
              </Alert>
            )}

            {status === 'error' && apiError && (
              <Alert severity="error" variant="outlined">
                {apiError}
              </Alert>
            )}

            <Alert severity="info" variant="outlined">
              前回の日付とカテゴリを引き継いで、次のレシートを続けて入力できます。
            </Alert>

            <Box className="week-day-grid" aria-label="週内の日付候補" role="list">
              {weekDays.map((day) => {
                const isSelected = formValues.date === day.isoDate
                return (
                  <Box
                    aria-label={`${day.label}曜日 ${day.date}${isSelected ? ' 選択中' : ''}`}
                    className="week-day-button"
                    key={day.isoDate}
                    onClick={() => handleFieldChange('date', day.isoDate)}
                    role="listitem"
                    sx={{
                      border: '1px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      bgcolor: isSelected ? 'primary.main' : 'background.paper',
                      color: isSelected ? 'primary.contrastText' : 'text.primary',
                      px: 1,
                      py: 1,
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{day.label}</span>
                    <small>{day.date}</small>
                  </Box>
                )
              })}
            </Box>

            <TextField
              error={!!errors.date}
              fullWidth
              helperText={errors.date}
              id="receipt-date"
              label="日付"
              name="date"
              onChange={(e) => handleFieldChange('date', e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: {
                  max: weekEndDate,
                  min: weekStartDate,
                },
              }}
              type="date"
              value={formValues.date}
            />

            <TextField
              autoComplete="organization"
              error={!!errors.shopName}
              fullWidth
              helperText={errors.shopName}
              id="receipt-shop-name"
              label="店舗名"
              name="shopName"
              onChange={(e) => handleFieldChange('shopName', e.target.value)}
              placeholder="例: スーパー北浜"
              value={formValues.shopName}
            />

            <TextField
              error={!!errors.amountYen}
              fullWidth
              helperText={errors.amountYen}
              id="receipt-amount-yen"
              label="合計金額"
              name="amountYen"
              onChange={(e) => handleFieldChange('amountYen', e.target.value)}
              placeholder="例: 4280"
              slotProps={{
                htmlInput: {
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                },
              }}
              value={formValues.amountYen}
            />

            <Stack spacing={1}>
              <Typography component="p" variant="body2" sx={{ fontWeight: 700 }}>
                カテゴリ
              </Typography>
              {errors.categoryId && (
                <Typography color="error" variant="caption">
                  {errors.categoryId}
                </Typography>
              )}
              <Box className="category-grid" aria-label="カテゴリ候補" role="list">
                {categories.map((category) => {
                  const isSelected = formValues.categoryId === category._id
                  return (
                    <Box
                      aria-label={`${category.name}${isSelected ? ' 選択中' : ''}`}
                      className="category-button"
                      key={category._id}
                      onClick={() => handleFieldChange('categoryId', category._id)}
                      role="listitem"
                      sx={
                        isSelected
                          ? {
                              border: '1px solid',
                              borderColor: 'primary.main',
                              borderRadius: 1,
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              px: 1,
                              py: 0.75,
                              textAlign: 'center',
                              cursor: 'pointer',
                            }
                          : {
                              border: '1px solid',
                              borderColor: category.color,
                              borderRadius: 1,
                              color: category.color,
                              px: 1,
                              py: 0.75,
                              textAlign: 'center',
                              cursor: 'pointer',
                            }
                      }
                    >
                      {category.name}
                    </Box>
                  )
                })}
              </Box>
            </Stack>

            <TextField
              error={!!errors.memo}
              fullWidth
              helperText={errors.memo}
              id="receipt-memo"
              label="メモ"
              minRows={3}
              multiline
              name="memo"
              onChange={(e) => handleFieldChange('memo', e.target.value)}
              placeholder="任意"
              value={formValues.memo}
            />

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                className="primary-action"
                disabled={status === 'submitting'}
                startIcon={status === 'submitting' ? <CircularProgress size={16} /> : undefined}
                type="submit"
                variant="contained"
              >
                {status === 'submitting' ? '保存中...' : '保存して次へ'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Box>
    </Paper>
  )
}
