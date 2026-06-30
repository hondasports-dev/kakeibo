import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useCategorySettings } from "../hooks/useCategorySettings";
import { CategorySettingsList } from "./CategorySettingsList";

export function CategorySettingsPanel() {
  const {
    beginEdit,
    categories,
    editColor,
    editName,
    editingId,
    error,
    handleCreate,
    handleDeactivate,
    handleUpdate,
    isCreateOpen,
    newColor,
    newName,
    savingTarget,
    setEditColor,
    setEditName,
    setEditingId,
    setIsCreateOpen,
    setNewColor,
    setNewName,
    setSnackbar,
    snackbar,
  } = useCategorySettings();

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography component="h2" variant="h5">
          カテゴリ
        </Typography>
        <Typography color="text.secondary" variant="body2">
          支出入力に使うカテゴリと利用状態を確認します。
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      ) : null}

      {categories === undefined ? (
        <Stack aria-label="カテゴリを読み込んでいます" spacing={1}>
          <Skeleton height={48} variant="rounded" />
          <Skeleton height={48} variant="rounded" />
        </Stack>
      ) : categories.length === 0 ? (
        <Alert
          action={
            <Button color="inherit" onClick={() => setIsCreateOpen(true)} size="small">
              最初のカテゴリを追加
            </Button>
          }
          severity="info"
          variant="outlined"
        >
          カテゴリがまだありません。
        </Alert>
      ) : (
        <CategorySettingsList
          categories={categories}
          editColor={editColor}
          editName={editName}
          editingId={editingId}
          onBeginEdit={beginEdit}
          onCancelEdit={() => setEditingId(null)}
          onDeactivate={(categoryId) => void handleDeactivate(categoryId)}
          onEditColorChange={setEditColor}
          onEditNameChange={setEditName}
          onUpdate={() => void handleUpdate()}
          savingTarget={savingTarget}
        />
      )}

      <Box>
        <Button
          aria-controls="category-create-form"
          aria-expanded={isCreateOpen}
          onClick={() => setIsCreateOpen((open) => !open)}
          startIcon={<AddIcon />}
          variant="text"
        >
          カテゴリを追加
        </Button>
        <Collapse id="category-create-form" in={isCreateOpen} unmountOnExit>
          <Box component="form" onSubmit={handleCreate} sx={{ mt: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                disabled={savingTarget === "create"}
                fullWidth
                label="新しいカテゴリ名"
                name="newCategoryName"
                onChange={(event) => setNewName(event.target.value)}
                value={newName}
              />
              <TextField
                disabled={savingTarget === "create"}
                label="新しいカテゴリ色"
                name="newCategoryColor"
                onChange={(event) => setNewColor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                type="color"
                value={newColor}
                sx={{ width: { xs: "100%", sm: 160 } }}
              />
              <Button
                disabled={savingTarget === "create"}
                startIcon={savingTarget === "create" ? <CircularProgress size={16} /> : undefined}
                type="submit"
                variant="contained"
              >
                追加する
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </Box>

      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={3000}
        onClose={() => setSnackbar("")}
        open={snackbar !== ""}
      >
        <Alert onClose={() => setSnackbar("")} severity="success" variant="filled">
          {snackbar}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
