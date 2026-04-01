import type { EditorType } from './types';

export type EditorTypeOption = {
  value: EditorType;
  label: string;
  iconClass: string;
};

const LEGACY_EDITOR_TYPE_ALIASES = new Map<string, EditorType>([
  ['story-presentation', 'story-document'],
  ['lore-document', 'story-document'],
  ['map-sketch', 'story-document'],
  ['level-design', 'story-document'],
]);

export const editorTypeOptions: EditorTypeOption[] = [
  { value: 'noteboard', label: 'Noteboard', iconClass: 'fa-regular fa-note-sticky' },
  { value: 'kanban-board', label: 'Kanban Board', iconClass: 'fa-solid fa-table-columns' },
  { value: 'spreadsheet', label: 'Spreadsheet', iconClass: 'fa-solid fa-table-cells' },
  { value: 'story-document', label: 'Document', iconClass: 'fa-solid fa-file-lines' },
  { value: 'steam-achievement-art', label: 'Steam Achievement Art', iconClass: 'fa-brands fa-steam-symbol' },
  { value: 'steam-marketplace-assets', label: 'Steam Marketplace Assets', iconClass: 'fa-brands fa-steam-symbol' },
  { value: 'terminal-command-center', label: 'Terminal Command Center', iconClass: 'fa-solid fa-terminal' },
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

export const coercePersistedEditorType = (value: unknown): EditorType | null => {
  if (isValidEditorType(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  return LEGACY_EDITOR_TYPE_ALIASES.get(value) ?? null;
};
