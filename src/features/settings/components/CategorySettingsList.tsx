import { Box } from "@mui/material";
import type { Category } from "../hooks/useCategorySettings";
import { CategorySettingsRow } from "./CategorySettingsRow";

type CategorySettingsListProps = {
  categories: Category[];
  editColor: string;
  editDescription: string;
  editName: string;
  editingId: Category["_id"] | null;
  onBeginEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onDeactivate: (categoryId: Category["_id"]) => void;
  onEditColorChange: (color: string) => void;
  onEditDescriptionChange: (description: string) => void;
  onEditNameChange: (name: string) => void;
  onUpdate: () => void;
  savingTarget: string | null;
};

export function CategorySettingsList({
  categories,
  editColor,
  editDescription,
  editName,
  editingId,
  onBeginEdit,
  onCancelEdit,
  onDeactivate,
  onEditColorChange,
  onEditDescriptionChange,
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
          editDescription={editDescription}
          editName={editName}
          isEditing={editingId === category._id}
          key={category._id}
          onBeginEdit={onBeginEdit}
          onCancelEdit={onCancelEdit}
          onDeactivate={onDeactivate}
          onEditColorChange={onEditColorChange}
          onEditDescriptionChange={onEditDescriptionChange}
          onEditNameChange={onEditNameChange}
          onUpdate={onUpdate}
          savingTarget={savingTarget}
        />
      ))}
    </Box>
  );
}
