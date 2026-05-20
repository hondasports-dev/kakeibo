import { type FormEvent, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

type Category = {
  _id: Id<'categories'>
  name: string
  color: string
  isActive: boolean
  sortOrder: number
}

const DEFAULT_NEW_COLOR = '#2563EB'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function CategorySettingsPanel() {
  const categories = useQuery(api.categories.listForSettings) as Category[] | undefined
  const createCategory = useMutation(api.categories.createCategory)
  const updateCategory = useMutation(api.categories.updateCategory)
  const deactivateCategory = useMutation(api.categories.deactivateCategory)

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR)
  const [editingId, setEditingId] = useState<Id<'categories'> | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_NEW_COLOR)
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState('')
  const [snackbar, setSnackbar] = useState('')

  const beginEdit = (category: Category) => {
    setEditingId(category._id)
    setEditName(category.name)
    setEditColor(category.color)
    setError('')
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('saving')
    setError('')
    try {
      await createCategory({ name: newName, color: newColor })
      setNewName('')
      setNewColor(DEFAULT_NEW_COLOR)
      setSnackbar('カテゴリを追加しました')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'カテゴリを追加できませんでした。'))
    } finally {
      setStatus('idle')
    }
  }

  const handleUpdate = async () => {
    if (editingId === null) return
    setStatus('saving')
    setError('')
    try {
      await updateCategory({
        categoryId: editingId,
        name: editName,
        color: editColor,
      })
      setEditingId(null)
      setSnackbar('カテゴリを更新しました')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'カテゴリを更新できませんでした。'))
    } finally {
      setStatus('idle')
    }
  }

  const handleDeactivate = async (categoryId: Id<'categories'>) => {
    setStatus('saving')
    setError('')
    try {
      await deactivateCategory({ categoryId })
      setSnackbar('カテゴリを無効化しました')
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'カテゴリを無効化できませんでした。'))
    } finally {
      setStatus('idle')
    }
  }

  return (
    <Paper className="paper-panel" elevation={0}>
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography component="h2" variant="h5">
              カテゴリ設定
            </Typography>
            <Typography color="text.secondary" variant="body2">
              新規入力に使うカテゴリを最小限で調整します。
            </Typography>
          </Box>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleCreate}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="新しいカテゴリ名"
                onChange={(event) => setNewName(event.target.value)}
                value={newName}
              />
              <TextField
                label="新しいカテゴリ色"
                onChange={(event) => setNewColor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                type="color"
                value={newColor}
                sx={{ width: { xs: '100%', sm: 160 } }}
              />
              <Button
                disabled={status === 'saving'}
                startIcon={status === 'saving' ? <CircularProgress size={16} /> : undefined}
                type="submit"
                variant="contained"
              >
                カテゴリを追加
              </Button>
            </Stack>
          </Box>

          <Divider />

          {categories === undefined ? (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <CircularProgress size={20} />
              <Typography color="text.secondary" variant="body2">
                カテゴリを読み込んでいます。
              </Typography>
            </Stack>
          ) : (
            <Box component="ul" className="category-settings-list">
              {categories.map((category) => {
                const isEditing = editingId === category._id
                return (
                  <Box
                    aria-label={`カテゴリ ${category.name}`}
                    className="category-settings-row"
                    component="li"
                    key={category._id}
                  >
                    {isEditing ? (
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        sx={{ alignItems: { xs: 'stretch', md: 'center' }, width: '100%' }}
                      >
                        <TextField
                          fullWidth
                          label="カテゴリ名を編集"
                          onChange={(event) => setEditName(event.target.value)}
                          value={editName}
                        />
                        <TextField
                          label="カテゴリ色を編集"
                          onChange={(event) => setEditColor(event.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                          type="color"
                          value={editColor}
                          sx={{ width: { xs: '100%', md: 160 } }}
                        />
                        <Button disabled={status === 'saving'} onClick={handleUpdate} variant="contained">
                          変更を保存
                        </Button>
                        <Button
                          disabled={status === 'saving'}
                          onClick={() => setEditingId(null)}
                          variant="outlined"
                        >
                          キャンセル
                        </Button>
                      </Stack>
                    ) : (
                      <>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                          <Box
                            aria-hidden="true"
                            sx={{
                              bgcolor: category.color,
                              borderRadius: '50%',
                              flexShrink: 0,
                              height: 14,
                              width: 14,
                            }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {category.name}
                            </Typography>
                            <Typography color="text.secondary" variant="caption">
                              表示順 {category.sortOrder}
                            </Typography>
                          </Box>
                          <Chip
                            color={category.isActive ? 'success' : 'secondary'}
                            label={category.isActive ? '有効' : '無効'}
                            size="small"
                            variant={category.isActive ? 'outlined' : 'filled'}
                          />
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Button
                            aria-label={`${category.name}を編集`}
                            disabled={status === 'saving'}
                            onClick={() => beginEdit(category)}
                            size="small"
                            variant="outlined"
                          >
                            編集
                          </Button>
                          <Button
                            aria-label={`${category.name}を無効化`}
                            color="error"
                            disabled={status === 'saving' || !category.isActive}
                            onClick={() => handleDeactivate(category._id)}
                            size="small"
                            variant="outlined"
                          >
                            無効化
                          </Button>
                        </Stack>
                      </>
                    )}
                  </Box>
                )
              })}
            </Box>
          )}
        </Stack>
      </Box>

      <Snackbar
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        autoHideDuration={3000}
        onClose={() => setSnackbar('')}
        open={snackbar !== ''}
      >
        <Alert onClose={() => setSnackbar('')} severity="success" variant="filled">
          {snackbar}
        </Alert>
      </Snackbar>
    </Paper>
  )
}
