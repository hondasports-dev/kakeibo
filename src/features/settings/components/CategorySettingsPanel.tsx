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
import { MAX_CATEGORY_DESCRIPTION_LENGTH } from "../../../../lib/categoryDescription";

export function CategorySettingsPanel() {
  const {
    beginEdit,
    categories,
    editDescription,
    editColor,
    editName,
    editingId,
    error,
    handleCreate,
    handleDeactivate,
    handleUpdate,
    isCreateOpen,
    newColor,
    newDescription,
    newName,
    savingTarget,
    setEditColor,
    setEditDescription,
    setEditName,
    setEditingId,
    setIsCreateOpen,
    setNewColor,
    setNewDescription,
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
          支出入力に使うカテゴリと利用状態を確認します。分類ヒントは、レシート明細をカテゴリー分類するときのAI判断に使用します。
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
          editDescription={editDescription}
          editName={editName}
          editingId={editingId}
          onBeginEdit={beginEdit}
          onCancelEdit={() => setEditingId(null)}
          onDeactivate={(categoryId) => void handleDeactivate(categoryId)}
          onEditColorChange={setEditColor}
          onEditDescriptionChange={setEditDescription}
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
            <Box className="category-settings-create-fields">
              <TextField
                className="category-settings-field-name"
                disabled={savingTarget === "create"}
                fullWidth
                label="新しいカテゴリ名"
                name="newCategoryName"
                onChange={(event) => setNewName(event.target.value)}
                value={newName}
              />
              <TextField
                className="category-settings-field-description"
                disabled={savingTarget === "create"}
                fullWidth
                helperText={`${newDescription.length}/${MAX_CATEGORY_DESCRIPTION_LENGTH}`}
                label="新しいカテゴリのAI分類ヒント"
                name="newCategoryDescription"
                multiline
                minRows={4}
                onChange={(event) => setNewDescription(event.target.value)}
                slotProps={{ htmlInput: { maxLength: MAX_CATEGORY_DESCRIPTION_LENGTH } }}
                value={newDescription}
              />
              <TextField
                className="category-settings-field-color"
                disabled={savingTarget === "create"}
                label="新しいカテゴリ色"
                name="newCategoryColor"
                onChange={(event) => setNewColor(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                type="color"
                value={newColor}
                sx={{ width: "100%" }}
              />
              <Button
                className="category-settings-create-action"
                disabled={savingTarget === "create"}
                startIcon={savingTarget === "create" ? <CircularProgress size={16} /> : undefined}
                type="submit"
                variant="contained"
              >
                追加する
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={3000}
        onClose={() => setSnackbar("")}
        open={snackbar !== ""}
      >
        <Alert
          aria-live="polite"
          onClose={() => setSnackbar("")}
          severity="success"
          variant="filled"
        >
          {snackbar}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
