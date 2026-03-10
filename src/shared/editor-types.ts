import type { EditorType } from './types';

export type EditorTypeOption = {
  value: EditorType;
  label: string;
  iconClass: string;
};

export const editorTypeOptions: EditorTypeOption[] = [
  { value: 'noteboard', label: 'Noteboard', iconClass: 'fa-regular fa-note-sticky' },
  { value: 'kanban-board', label: 'Kanban Board', iconClass: 'fa-solid fa-table-columns' },
  { value: 'spreadsheet', label: 'Spreadsheet', iconClass: 'fa-solid fa-table-cells' },
  { value: 'story-document', label: 'Document', iconClass: 'fa-solid fa-file-lines' },
];

export const editorTypeMeta = (
  type: EditorType,
): { label: string; iconClass: string } => {
  const found = editorTypeOptions.find((item) => item.value === type);
  return found
    ? { label: found.label, iconClass: found.iconClass }
    : { label: type, iconClass: 'fa-solid fa-circle' };
};

export const isValidEditorType = (value: unknown): value is EditorType =>
  editorTypeOptions.some((option) => option.value === value);
