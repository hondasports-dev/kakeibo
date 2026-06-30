import { Box } from "@mui/material";
import type { Category } from "../hooks/useCategorySettings";
import { CategorySettingsRow } from "./CategorySettingsRow";

type CategorySettingsListProps = {
  categories: Category[];
  editColor: string;
  editName: string;
  editingId: Category["_id"] | null;
  onBeginEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onDeactivate: (categoryId: Category["_id"]) => void;
  onEditColorChange: (color: string) => void;
  onEditNameChange: (name: string) => void;
  onUpdate: () => void;
  savingTarget: string | null;
};

export function CategorySettingsList({
  categories,
  editColor,
  editName,
  editingId,
  onBeginEdit,
  onCancelEdit,
  onDeactivate,
  onEditColorChange,
  onEditNameChange,
  onUpdate,
  savingTarget,
}: CategorySettingsListProps) {
  return (
    <Box component="ul" className="category-settings-list">
      {categories.map((category) => (
        <CategorySettingsRow
          category={category}
          editColor={editColor}
          editName={editName}
          isEditing={editingId === category._id}
          key={category._id}
          onBeginEdit={onBeginEdit}
          onCancelEdit={onCancelEdit}
          onDeactivate={onDeactivate}
          onEditColorChange={onEditColorChange}
          onEditNameChange={onEditNameChange}
          onUpdate={onUpdate}
          savingTarget={savingTarget}
        />
      ))}
    </Box>
  );
}
