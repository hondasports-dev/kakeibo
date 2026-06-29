import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { designTokens } from "../../../designTokens";
import { getConvexErrorMessage } from "../../auth";

type Category = {
  _id: Id<"categories">;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
};

const DEFAULT_NEW_COLOR: string = designTokens.color.category.default;

function getErrorMessage(error: unknown, fallback: string) {
  return getConvexErrorMessage(error, fallback);
}

export function CategorySettingsPanel() {
  const categories = useQuery(api.categories.queries.listForSettings) as Category[] | undefined;
  const createCategory = useMutation(api.categories.mutations.createCategory);
  const updateCategory = useMutation(api.categories.mutations.updateCategory);
  const deactivateCategory = useMutation(api.categories.mutations.deactivateCategory);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_NEW_COLOR);
  const [editingId, setEditingId] = useState<Id<"categories"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string>(DEFAULT_NEW_COLOR);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");

  const beginEdit = (category: Category) => {
    setEditingId(category._id);
    setEditName(category.name);
    setEditColor(category.color);
    setError("");
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSavingTarget("create");
    setError("");
    try {
      await createCategory({ name: newName, color: newColor });
      setNewName("");
      setNewColor(DEFAULT_NEW_COLOR);
      setIsCreateOpen(false);
      setSnackbar("カテゴリを追加しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "カテゴリを追加できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    setSavingTarget(`edit-${editingId}`);
    setError("");
    try {
      await updateCategory({ categoryId: editingId, name: editName, color: editColor });
      setEditingId(null);
      setSnackbar("カテゴリを更新しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "カテゴリを更新できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

  const handleDeactivate = async (categoryId: Id<"categories">) => {
    setSavingTarget(`deactivate-${categoryId}`);
    setError("");
    try {
      await deactivateCategory({ categoryId });
      setSnackbar("カテゴリを無効化しました");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "カテゴリを無効化できませんでした。"));
    } finally {
      setSavingTarget(null);
    }
  };

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
        <Box component="ul" className="category-settings-list">
          {categories.map((category) => {
            const isEditing = editingId === category._id;
            const editSaving = savingTarget === `edit-${category._id}`;
            const deactivateSaving = savingTarget === `deactivate-${category._id}`;

            return (
              <Box
                aria-label={`カテゴリ ${category.name}`}
                className="category-settings-row"
                component="li"
                key={category._id}
              >
                <Box className="category-settings-summary">
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        bgcolor: category.color,
                        border: `1px solid ${designTokens.color.border.subtle}`,
                        borderRadius: "50%",
                        flexShrink: 0,
                        height: 16,
                        width: 16,
                      }}
                    />
                    <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                      {category.name}
                    </Typography>
                  </Stack>
                  <Chip
                    color={category.isActive ? "success" : "default"}
                    label={category.isActive ? "使用中" : "無効"}
                    size="small"
                    variant="outlined"
                  />
                  <Button
                    aria-controls={`category-editor-${category._id}`}
                    aria-expanded={isEditing}
                    aria-label={`${category.name}を編集`}
                    endIcon={<ChevronRightIcon />}
                    onClick={() => (isEditing ? setEditingId(null) : beginEdit(category))}
                    size="small"
                  >
                    編集
                  </Button>
                </Box>

                <Collapse id={`category-editor-${category._id}`} in={isEditing} unmountOnExit>
                  <Stack className="category-settings-editor" spacing={1.5}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                      <TextField
                        disabled={editSaving}
                        fullWidth
                        label="カテゴリ名を編集"
                        name="editCategoryName"
                        onChange={(event) => setEditName(event.target.value)}
                        value={editName}
                      />
                      <TextField
                        disabled={editSaving}
                        label="カテゴリ色を編集"
                        name="editCategoryColor"
                        onChange={(event) => setEditColor(event.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        type="color"
                        value={editColor}
                        sx={{ width: { xs: "100%", md: 160 } }}
                      />
                      <Button disabled={editSaving} onClick={handleUpdate} variant="contained">
                        {editSaving ? "保存中..." : "変更を保存"}
                      </Button>
                      <Button disabled={editSaving} onClick={() => setEditingId(null)}>
                        キャンセル
                      </Button>
                    </Stack>
                    <Box className="category-settings-deactivate">
                      <Button
                        aria-label={`${category.name}を無効化`}
                        color="error"
                        disabled={deactivateSaving || !category.isActive}
                        onClick={() => void handleDeactivate(category._id)}
                        size="small"
                        variant="outlined"
                      >
                        {deactivateSaving ? "無効化中..." : "無効化"}
                      </Button>
                    </Box>
                  </Stack>
                </Collapse>
              </Box>
            );
          })}
        </Box>
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
