import { Box, Button, Chip, Collapse, Stack, TextField, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { designTokens } from "../../../designTokens";
import type { Category } from "../hooks/useCategorySettings";
import { MAX_CATEGORY_DESCRIPTION_LENGTH } from "../../../../lib/categoryDescription";

type CategorySettingsRowProps = {
  category: Category;
  editColor: string;
  editDescription: string;
  editName: string;
  isEditing: boolean;
  onBeginEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onDeactivate: (categoryId: Category["_id"]) => void;
  onEditColorChange: (color: string) => void;
  onEditDescriptionChange: (description: string) => void;
  onEditNameChange: (name: string) => void;
  onUpdate: () => void;
  savingTarget: string | null;
};

export function CategorySettingsRow({
  category,
  editColor,
  editDescription,
  editName,
  isEditing,
  onBeginEdit,
  onCancelEdit,
  onDeactivate,
  onEditColorChange,
  onEditDescriptionChange,
  onEditNameChange,
  onUpdate,
  savingTarget,
}: CategorySettingsRowProps) {
  const editSaving = savingTarget === `edit-${category._id}`;
  const deactivateSaving = savingTarget === `deactivate-${category._id}`;

  return (
    <Box aria-label={`カテゴリ ${category.name}`} className="category-settings-row" component="li">
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
          onClick={() => (isEditing ? onCancelEdit() : onBeginEdit(category))}
          size="small"
        >
          編集
        </Button>
      </Box>

      <Collapse id={`category-editor-${category._id}`} in={isEditing} unmountOnExit>
        <Stack className="category-settings-editor" spacing={1.5}>
          <Box className="category-settings-editor-fields">
            <TextField
              className="category-settings-field-name"
              disabled={editSaving}
              fullWidth
              label="カテゴリ名を編集"
              name="editCategoryName"
              onChange={(event) => onEditNameChange(event.target.value)}
              value={editName}
            />
            <TextField
              className="category-settings-field-color"
              disabled={editSaving}
              label="カテゴリ色"
              name="editCategoryColor"
              onChange={(event) => onEditColorChange(event.target.value)}
              slotProps={{
                htmlInput: { "aria-label": "カテゴリ色を編集" },
                inputLabel: { shrink: true },
              }}
              type="color"
              value={editColor}
              sx={{ width: "100%" }}
            />
            <TextField
              className="category-settings-field-description"
              disabled={editSaving}
              fullWidth
              helperText={`${editDescription.length}/${MAX_CATEGORY_DESCRIPTION_LENGTH}`}
              label="カテゴリのAI分類ヒント"
              name="editCategoryDescription"
              multiline
              minRows={4}
              onChange={(event) => onEditDescriptionChange(event.target.value)}
              slotProps={{ htmlInput: { maxLength: MAX_CATEGORY_DESCRIPTION_LENGTH } }}
              value={editDescription}
            />
            <Stack className="category-settings-editor-actions" direction="row" spacing={1}>
              <Button
                disabled={editSaving}
                onClick={onUpdate}
                size="small"
                sx={{ fontSize: "0.8125rem", lineHeight: 1.4, whiteSpace: "nowrap" }}
                variant="contained"
              >
                {editSaving ? "保存中…" : "変更を保存"}
              </Button>
              <Button
                disabled={editSaving}
                onClick={onCancelEdit}
                size="small"
                sx={{ fontSize: "0.8125rem", lineHeight: 1.4, whiteSpace: "nowrap" }}
              >
                キャンセル
              </Button>
            </Stack>
          </Box>
          <Box className="category-settings-deactivate">
            <Button
              aria-label={`${category.name}を無効化`}
              color="error"
              disabled={deactivateSaving || !category.isActive}
              onClick={() => void onDeactivate(category._id)}
              size="small"
              variant="outlined"
            >
              {deactivateSaving ? "無効化中…" : "無効化"}
            </Button>
          </Box>
        </Stack>
      </Collapse>
    </Box>
  );
}
