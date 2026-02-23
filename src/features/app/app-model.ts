import type {
  AppTheme,
  CardTemplate,
  CategoryNode,
  KanbanCard,
  KanbanColumn,
  KanbanPriority,
  NoteboardBrushType,
  NoteboardCard,
  NoteboardStroke,
  PersistedTreeState,
  ProjectStatusPayload,
  SpreadsheetData,
  SpreadsheetSheet,
  UserSettings,
} from '../../shared/types';
import {
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from '../../shared/noteboard-constants';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  CARD_WIDTH,
  DEFAULT_NOTEBOARD_CARD_COLOR,
  clampCardToWorld,
  type NoteboardView,
} from '../../renderer/noteboard-utils';
import {
  DEFAULT_SPREADSHEET_COLUMN_COUNT,
  DEFAULT_SPREADSHEET_ROW_COUNT,
  MAX_SPREADSHEET_COLUMN_COUNT,
  MAX_SPREADSHEET_ROW_COUNT,
  MIN_SPREADSHEET_COLUMN_COUNT,
  MIN_SPREADSHEET_ROW_COUNT,
  isSpreadsheetCellKey,
} from '../spreadsheet/spreadsheet-addressing';

export type UiState = {
  editingNodeId: string | null;
  editingNameDraft: string;
  pendingDeleteNodeId: string | null;
  pendingCreateParentRef: string | 'root' | null;
  isSettingsDialogOpen: boolean;
  settingsDraftTheme: AppTheme;
  settingsDraftCustomThemeId: string;
  isDrawingMode: boolean;
  cardSelection: {
    nodeId: string | null;
    cardIds: string[];
  };
  contextMenu:
    | {
        nodeId: string;
        screenX: number;
        screenY: number;
        worldX: number;
        worldY: number;
      }
    | null;
  selectionBox:
    | {
        nodeId: string;
        pointerId: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        additive: boolean;
        baseSelectedCardIds: string[];
      }
    | null;
};

export type ProjectStatusUi = {
  status: ProjectStatusPayload['status'];
  message: string;
  at: number;
};

export type HistorySnapshot = {
  state: PersistedTreeState;
  cardSelection: {
    nodeId: string | null;
    cardIds: string[];
  };
};

export type DragState = {
  pointerId: number;
  nodeId: string;
  movingCardIds: string[];
  pointerStartX: number;
  pointerStartY: number;
  startPositions: Record<string, { x: number; y: number }>;
};

export type ResizeState = {
  pointerId: number;
  nodeId: string;
  cardId: string;
  startPointerX: number;
  startPointerY: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
  minWidth: number;
  minHeight: number;
  lastWidth: number;
  lastHeight: number;
};

export type PanState = {
  pointerId: number;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

export type DrawState = {
  pointerId: number;
  nodeId: string;
  tool: 'pen' | 'brush' | 'eraser';
  strokeId: string | null;
};

export type QueuedDrawPoint = {
  x: number;
  y: number;
  at: number;
};

export type AppClipboard =
  | {
      kind: 'noteboard-cards';
      cards: Array<{
        text: string;
        color: string;
        dx: number;
        dy: number;
        width: number;
        height: number;
      }>;
    }
  | null;

export type DroppedCanvasPayload = {
  files: File[];
  textPlain: string;
  textUriList: string;
  textHtml: string;
  testoImageAsset: string;
};

export type CardTemplateId =
  | 'blank'
  | 'list'
  | 'checklist'
  | 'table'
  | 'quest-log'
  | 'mechanic-spec';
export const CUSTOM_TEMPLATE_MAX_COUNT = 40;

export const MIN_SIDEBAR_WIDTH = 240;
export const MAX_SIDEBAR_WIDTH = 620;
export const MAX_ZOOM = 2.5;
export const MAX_HISTORY_ENTRIES = 120;
export const MAX_DRAW_SIZE = 64;
export const CARD_MAX_WIDTH = 920;
export const CARD_MAX_HEIGHT = 820;
export const CARD_AUTO_MAX_WIDTH = 420;
export const CONTEXT_MENU_WIDTH = 228;
export const CONTEXT_MENU_HEIGHT = 86;
export const DRAWING_PRESET_COLOR_COUNT = 6;
export const MAX_CUSTOM_THEMES = 24;
export const MAX_THEME_TOKEN_OVERRIDES = 256;
export const DEFAULT_DRAWING_PRESET_COLORS = [
  '#f3f7ff',
  '#ff4dc4',
  '#42d6ff',
  '#a775ff',
  '#ffb347',
  '#67ff7e',
];
export const CARD_COLOR_PRESETS = [
  '#ff7fd1',
  '#c197ff',
  '#78d5ff',
  '#8df5a6',
  '#ffd37b',
];
export const THEME_CARD_COLORS: Record<AppTheme, string> = {
  parchment: '#c197ff',
  midnight: '#78d5ff',
  evergreen: '#d6ebd2',
};
export const CARD_TEMPLATES: Array<{ id: CardTemplateId; label: string; markdown: string }> = [
  {
    id: 'blank',
    label: 'Blank',
    markdown: '',
  },
  {
    id: 'list',
    label: 'Bullet List',
    markdown: '- Item 1\n- Item 2\n- Item 3',
  },
  {
    id: 'checklist',
    label: 'Checklist',
    markdown: '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3',
  },
  {
    id: 'table',
    label: 'Table',
    markdown:
      '| Name | Value | Notes |\n|---|---|---|\n| HP | 100 | Base health |\n| Speed | 6.5 | Units/s |',
  },
  {
    id: 'quest-log',
    label: 'Quest Log',
    markdown:
      '## Quest\n- **Objective:**\n- **NPC:**\n- **Location:**\n\n## Steps\n- [ ] Step 1\n- [ ] Step 2\n\n## Rewards\n- XP:\n- Items:',
  },
  {
    id: 'mechanic-spec',
    label: 'Mechanic Spec',
    markdown:
      '## Mechanic\n- **Name:**\n- **Core Loop Stage:**\n\n## Rules\n- Rule 1\n- Rule 2\n\n## Tuning\n| Param | Default | Range |\n|---|---|---|\n| Cooldown | 1.5 | 0.5-3.0 |\n\n## Edge Cases\n- ',
  },
];

export const defaultState: PersistedTreeState = {
  nodes: [
    {
      id: 'node-1',
      name: 'Untitled Node 1',
      editorType: 'noteboard',
      children: [
        {
          id: 'node-2',
          name: 'Untitled Node 2',
          editorType: 'story-document',
          children: [],
        },
      ],
    },
    {
      id: 'node-3',
      name: 'Untitled Node 3',
      editorType: 'map-sketch',
      children: [],
    },
  ],
  selectedNodeId: 'node-1',
  nextNodeNumber: 4,
  nodeDataById: {},
  sharedKanbanBacklogCards: [],
  sidebarWidth: 320,
  collapsedNodeIds: [],
};

export const defaultSettings: UserSettings = {
  theme: 'parchment',
  drawingTool: 'brush',
  drawingBrush: 'ink',
  drawingSize: 10,
  drawingOpacity: 0.85,
  drawingColor: '#e6ecff',
  drawingPresetColors: [...DEFAULT_DRAWING_PRESET_COLORS],
  cardTemplates: [],
  customThemes: [],
};

export const themeOptions: Array<{ value: AppTheme; label: string }> = [
  { value: 'parchment', label: 'Synthwave' },
  { value: 'midnight', label: 'Studio' },
  { value: 'evergreen', label: 'Fantasy' },
];

export const isAppTheme = (value: unknown): value is AppTheme =>
  value === 'parchment' || value === 'midnight' || value === 'evergreen';

export const getThemeCardColor = (theme: AppTheme): string =>
  THEME_CARD_COLORS[theme] ?? THEME_CARD_COLORS.parchment;

export const clampSidebarWidth = (value: number): number =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

export const isHexColor = (value: string): boolean =>
  /^#[0-9a-f]{6}$/i.test(value.trim());

export const sanitizeDrawingPresetColors = (input: unknown): string[] => {
  const source = Array.isArray(input) ? input : [];
  const normalized = source
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value): value is string => isHexColor(value))
    .slice(0, DRAWING_PRESET_COLOR_COUNT);

  while (normalized.length < DRAWING_PRESET_COLOR_COUNT) {
    normalized.push(DEFAULT_DRAWING_PRESET_COLORS[normalized.length]);
  }

  return normalized;
};

export const sanitizeCardTemplates = (input: unknown): CardTemplate[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const sanitized = input
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }
      const obj = item as { id?: unknown; name?: unknown; markdown?: unknown };
      if (
        typeof obj.id !== 'string' ||
        typeof obj.name !== 'string' ||
        typeof obj.markdown !== 'string'
      ) {
        return null;
      }
      const id = obj.id.trim();
      const name = obj.name.trim();
      if (!id || !name) {
        return null;
      }
      return {
        id,
        name: name.slice(0, 48),
        markdown: obj.markdown.slice(0, 12000),
      } as CardTemplate;
    })
    .filter((template): template is CardTemplate => Boolean(template))
    .slice(0, CUSTOM_TEMPLATE_MAX_COUNT);

  const uniqueById = new Map<string, CardTemplate>();
  sanitized.forEach((template) => {
    if (!uniqueById.has(template.id)) {
      uniqueById.set(template.id, template);
    }
  });

  return [...uniqueById.values()];
};

export const createCustomTemplateId = (): string =>
  `custom-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const isThemeTokenName = (value: string): boolean =>
  /^--[a-z0-9-]+$/i.test(value.trim());

const isThemeTokenValue = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) {
    return false;
  }
  if (/[{};]/.test(trimmed)) {
    return false;
  }
  return true;
};

export const sanitizeCustomThemes = (input: unknown): UserSettings['customThemes'] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const next: NonNullable<UserSettings['customThemes']> = [];
  const seenIds = new Set<string>();
  input.forEach((theme) => {
    if (next.length >= MAX_CUSTOM_THEMES) {
      return;
    }
    if (typeof theme !== 'object' || theme === null) {
      return;
    }

    const t = theme as {
      id?: unknown;
      name?: unknown;
      baseTheme?: unknown;
      tokens?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    if (
      typeof t.id !== 'string' ||
      !t.id.trim() ||
      seenIds.has(t.id) ||
      typeof t.name !== 'string' ||
      !t.name.trim() ||
      !isAppTheme(t.baseTheme)
    ) {
      return;
    }
    if (typeof t.tokens !== 'object' || t.tokens === null || Array.isArray(t.tokens)) {
      return;
    }

    const tokenEntries = Object.entries(t.tokens as Record<string, unknown>)
      .flatMap(([name, value]): Array<[string, string]> => {
        if (
          isThemeTokenName(name) &&
          typeof value === 'string' &&
          isThemeTokenValue(value)
        ) {
          return [[name, value.trim()]];
        }
        return [];
      })
      .slice(0, MAX_THEME_TOKEN_OVERRIDES);

    const createdAt =
      typeof t.createdAt === 'number' && Number.isFinite(t.createdAt)
        ? t.createdAt
        : Date.now();
    const updatedAt =
      typeof t.updatedAt === 'number' && Number.isFinite(t.updatedAt)
        ? t.updatedAt
        : createdAt;

    seenIds.add(t.id);
    next.push({
      id: t.id.trim(),
      name: t.name.trim().slice(0, 64),
      baseTheme: t.baseTheme,
      tokens: Object.fromEntries(tokenEntries),
      createdAt,
      updatedAt,
    });
  });

  return next;
};

export const normalizeClipboardText = (value: string): string => value.replace(/\r\n/g, '\n').trim();
export const isTextEntryTargetElement = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const firstUrlFromText = (value: string): string | null => {
  const match = value.match(/https?:\/\/[^\s<>"'`]+/i);
  return match ? match[0] : null;
};

export const firstUrlFromUriList = (value: string): string | null => {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) {
      return line;
    }
  }
  return null;
};

export const firstImageUrlFromHtml = (value: string): string | null => {
  if (!value.trim()) {
    return null;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, 'text/html');
    const image = doc.querySelector('img[src]');
    const src = image?.getAttribute('src')?.trim() ?? '';
    if (/^(https?:\/\/|data:image\/)/i.test(src)) {
      return src;
    }
    return null;
  } catch {
    return null;
  }
};

export const parseDroppedTestoImageAsset = (
  raw: string,
): { assetUrl: string; width?: number; height?: number } | null => {
  if (!raw.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      assetUrl?: unknown;
      width?: unknown;
      height?: unknown;
    };
    if (typeof parsed.assetUrl !== 'string' || !parsed.assetUrl.trim()) {
      return null;
    }
    return {
      assetUrl: parsed.assetUrl.trim(),
      width: typeof parsed.width === 'number' && Number.isFinite(parsed.width) ? parsed.width : undefined,
      height:
        typeof parsed.height === 'number' && Number.isFinite(parsed.height) ? parsed.height : undefined,
    };
  } catch {
    return null;
  }
};

export const estimateCardDimensionsFromText = (
  text: string,
): { width: number; height: number } => {
  const source = text.trim();
  if (!source) {
    return {
      width: CARD_WIDTH,
      height: CARD_MIN_HEIGHT,
    };
  }

  // Ignore markdown URL payloads when sizing so long links do not force oversized cards.
  const sizingSource = source
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '![image:$1]')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '[$1]')
    .replace(/https?:\/\/[^\s<>"'`]+/gi, 'link');

  const lines = sizingSource.split('\n');
  const longestLine = lines.reduce((max, line) => Math.max(max, line.trim().length), 0);
  const lineCount = lines.length;
  const hasTable = sizingSource.includes('|') && sizingSource.includes('---');
  const headingCount = lines.filter((line) => /^#{1,6}\s/.test(line.trim())).length;
  const listCount = lines.filter((line) => /^[-*]\s|\d+\.\s|-\s\[\s?\]\s/.test(line.trim())).length;

  let width = 170 + longestLine * 5.2 + (hasTable ? 70 : 0);
  width = Math.max(CARD_MIN_WIDTH, Math.min(CARD_AUTO_MAX_WIDTH, width));

  const approxCharsPerLine = Math.max(18, Math.floor((width - 28) / 7));
  const wrappedLines = Math.ceil(sizingSource.length / approxCharsPerLine);
  const effectiveLines = Math.max(lineCount, wrappedLines);
  let height =
    54 +
    effectiveLines * 17 +
    headingCount * 6 +
    Math.min(14, listCount * 2);
  height = Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, height));

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

export const fitImageDimensionsToCardBounds = (
  width: number,
  height: number,
): { width: number; height: number } => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : CARD_WIDTH;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : CARD_MIN_HEIGHT;
  const minScale = Math.max(CARD_MIN_WIDTH / safeWidth, CARD_MIN_HEIGHT / safeHeight);
  const maxScale = Math.min(CARD_MAX_WIDTH / safeWidth, CARD_MAX_HEIGHT / safeHeight);
  const scale = Math.min(maxScale, Math.max(minScale, 1));

  return {
    width: Math.round(safeWidth * scale),
    height: Math.round(safeHeight * scale),
  };
};

export const isUserSettings = (value: unknown): value is UserSettings => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    theme?: unknown;
    activeCustomThemeId?: unknown;
    drawingTool?: unknown;
    drawingBrush?: unknown;
    drawingSize?: unknown;
    drawingOpacity?: unknown;
    drawingColor?: unknown;
    drawingPresetColors?: unknown;
    cardTemplates?: unknown;
    customThemes?: unknown;
  };
  return (
    (obj.theme === undefined || isAppTheme(obj.theme)) &&
    (obj.activeCustomThemeId === undefined ||
      (typeof obj.activeCustomThemeId === 'string' && obj.activeCustomThemeId.trim().length > 0)) &&
    (obj.drawingTool === undefined ||
      obj.drawingTool === 'pen' ||
      obj.drawingTool === 'brush' ||
      obj.drawingTool === 'eraser') &&
    (obj.drawingBrush === undefined ||
      obj.drawingBrush === 'pen' ||
      obj.drawingBrush === 'ink' ||
      obj.drawingBrush === 'marker' ||
      obj.drawingBrush === 'charcoal') &&
    (obj.drawingSize === undefined ||
      (typeof obj.drawingSize === 'number' &&
        Number.isFinite(obj.drawingSize) &&
        obj.drawingSize >= 2 &&
        obj.drawingSize <= MAX_DRAW_SIZE)) &&
    (obj.drawingOpacity === undefined ||
      (typeof obj.drawingOpacity === 'number' &&
        Number.isFinite(obj.drawingOpacity) &&
        obj.drawingOpacity >= 0.05 &&
        obj.drawingOpacity <= 1)) &&
    (obj.drawingColor === undefined || typeof obj.drawingColor === 'string') &&
    (obj.drawingPresetColors === undefined ||
      (Array.isArray(obj.drawingPresetColors) &&
        obj.drawingPresetColors.length <= DRAWING_PRESET_COLOR_COUNT &&
        obj.drawingPresetColors.every(
          (color) => typeof color === 'string' && isHexColor(color),
        ))) &&
    (obj.cardTemplates === undefined ||
      (Array.isArray(obj.cardTemplates) &&
        obj.cardTemplates.length <= CUSTOM_TEMPLATE_MAX_COUNT &&
        obj.cardTemplates.every((template) => {
          if (typeof template !== 'object' || template === null) {
            return false;
          }
          const t = template as { id?: unknown; name?: unknown; markdown?: unknown };
          return (
            typeof t.id === 'string' &&
            t.id.trim().length > 0 &&
            typeof t.name === 'string' &&
            t.name.trim().length > 0 &&
            typeof t.markdown === 'string'
          );
        }))) &&
    (obj.customThemes === undefined ||
      (Array.isArray(obj.customThemes) &&
        obj.customThemes.length <= MAX_CUSTOM_THEMES &&
        obj.customThemes.every((theme) => {
          if (typeof theme !== 'object' || theme === null) {
            return false;
          }
          const t = theme as {
            id?: unknown;
            name?: unknown;
            baseTheme?: unknown;
            tokens?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
          };
          return (
            typeof t.id === 'string' &&
            t.id.trim().length > 0 &&
            typeof t.name === 'string' &&
            t.name.trim().length > 0 &&
            isAppTheme(t.baseTheme) &&
            typeof t.tokens === 'object' &&
            t.tokens !== null &&
            !Array.isArray(t.tokens) &&
            Object.keys(t.tokens as Record<string, unknown>).length <= MAX_THEME_TOKEN_OVERRIDES &&
            Object.entries(t.tokens as Record<string, unknown>).every(
              ([name, tokenValue]) =>
                isThemeTokenName(name) &&
                typeof tokenValue === 'string' &&
                isThemeTokenValue(tokenValue),
            ) &&
            typeof t.createdAt === 'number' &&
            Number.isFinite(t.createdAt) &&
            typeof t.updatedAt === 'number' &&
            Number.isFinite(t.updatedAt)
          );
        })))
  );
};

export const collectSubtreeIds = (root: CategoryNode): string[] => {
  const ids = [root.id];
  root.children.forEach((child) => {
    ids.push(...collectSubtreeIds(child));
  });
  return ids;
};

export const getCardsForNode = (state: PersistedTreeState, nodeId: string): NoteboardCard[] =>
  state.nodeDataById[nodeId]?.noteboard?.cards ?? [];

export const getStrokesForNode = (state: PersistedTreeState, nodeId: string): NoteboardStroke[] =>
  state.nodeDataById[nodeId]?.noteboard?.strokes ?? [];

export const getViewForNode = (state: PersistedTreeState, nodeId: string): NoteboardView =>
  state.nodeDataById[nodeId]?.noteboard?.view ?? {
    zoom: 1,
    offsetX: NOTEBOARD_WORLD_MIN_X + 180,
    offsetY: NOTEBOARD_WORLD_MIN_Y + 120,
  };

export const getDocumentMarkdownForNode = (state: PersistedTreeState, nodeId: string): string =>
  state.nodeDataById[nodeId]?.document?.markdown ?? '';

export const KANBAN_DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#5f6f8a' },
  { id: 'todo', name: 'To Do', color: '#4e6d91' },
  { id: 'doing', name: 'Doing', color: '#d4b63a' },
  { id: 'done', name: 'Done', color: '#5b9a5b' },
];

export const KANBAN_PRIORITY_ORDER: KanbanPriority[] = ['none', 'low', 'medium', 'high'];

const DEFAULT_SPREADSHEET_SHEET: SpreadsheetSheet = {
  id: 'sheet-1',
  name: 'Sheet 1',
  cells: {},
};

const DEFAULT_SPREADSHEET_DATA: SpreadsheetData = {
  sheets: [DEFAULT_SPREADSHEET_SHEET],
  activeSheetId: DEFAULT_SPREADSHEET_SHEET.id,
  activeCellKey: 'A1',
  rowCount: DEFAULT_SPREADSHEET_ROW_COUNT,
  columnCount: DEFAULT_SPREADSHEET_COLUMN_COUNT,
  rowHeights: {},
  columnWidths: {},
};

export const getKanbanBoardForNode = (
  state: PersistedTreeState,
  nodeId: string,
): {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  nextTaskNumber: number;
  collapsedColumnIds: string[];
} => {
  const kanban = state.nodeDataById[nodeId]?.kanban;
  return {
    columns: kanban?.columns ?? KANBAN_DEFAULT_COLUMNS,
    cards: kanban?.cards ?? [],
    nextTaskNumber: kanban?.nextTaskNumber ?? 1,
    collapsedColumnIds: kanban?.collapsedColumnIds ?? [],
  };
};

export const getSharedKanbanBacklogCards = (state: PersistedTreeState): KanbanCard[] =>
  state.sharedKanbanBacklogCards ?? [];

export const getSpreadsheetForNode = (
  state: PersistedTreeState,
  nodeId: string,
): SpreadsheetData => {
  const spreadsheet = state.nodeDataById[nodeId]?.spreadsheet;
  if (!spreadsheet || !Array.isArray(spreadsheet.sheets) || spreadsheet.sheets.length === 0) {
    return DEFAULT_SPREADSHEET_DATA;
  }

  return spreadsheet;
};

export const ensureKanbanData = (
  state: PersistedTreeState,
  nodeId: string,
): PersistedTreeState => {
  const workspace = state.nodeDataById[nodeId];
  const kanban = workspace?.kanban;

  const sourceColumns = Array.isArray(kanban?.columns) ? kanban.columns : KANBAN_DEFAULT_COLUMNS;
  const seenColumnIds = new Set<string>();
  const legacyToNormalizedColumnId = new Map<string, string>();
  const columns = sourceColumns
    .filter((column) => typeof column?.id === 'string' && typeof column?.name === 'string')
    .map((column) => {
      const rawId = column.id.trim();
      const normalizedName = column.name.trim() || 'Column';
      const isBacklogByName = normalizedName.toLowerCase() === 'backlog';
      const normalizedIdBase =
        rawId.toLowerCase().replace(/[^a-z0-9-_]+/g, '-') || 'column';
      const normalizedId = isBacklogByName ? 'backlog' : normalizedIdBase;
      let nextId = normalizedId;
      let suffix = 2;
      while (seenColumnIds.has(nextId)) {
        nextId = `${normalizedId}-${suffix}`;
        suffix += 1;
      }
      seenColumnIds.add(nextId);
      if (rawId) {
        legacyToNormalizedColumnId.set(rawId, nextId);
      }
      return {
        id: nextId,
        name: isBacklogByName ? 'Backlog' : normalizedName,
        color:
          typeof (column as Partial<KanbanColumn>).color === 'string' &&
          isHexColor((column as Partial<KanbanColumn>).color as string)
            ? ((column as Partial<KanbanColumn>).color as string)
            : '#5f6f8a',
      } as KanbanColumn;
    });

  const hasBacklog = columns.some((column) => column.id === 'backlog');
  if (!hasBacklog) {
    columns.unshift({ id: 'backlog', name: 'Backlog', color: '#5f6f8a' });
  }

  const cards = Array.isArray(kanban?.cards)
    ? kanban.cards
        .filter((card) => card && typeof card.id === 'string' && typeof card.title === 'string')
        .map((card) => {
          const rawColumnId =
            typeof card.columnId === 'string' && card.columnId.trim() ? card.columnId.trim() : 'todo';
          const mappedColumnId = legacyToNormalizedColumnId.get(rawColumnId) ?? rawColumnId;
          const hasMappedColumn = columns.some((column) => column.id === mappedColumnId);
          const fallbackColumnId =
            columns.find((column) => column.id === 'todo')?.id ??
            columns.find((column) => column.id !== 'backlog')?.id ??
            'backlog';

          return {
            ...card,
            markdown: typeof card.markdown === 'string' ? card.markdown : '',
            priority: KANBAN_PRIORITY_ORDER.includes(card.priority) ? card.priority : 'none',
            columnId: hasMappedColumn ? mappedColumnId : fallbackColumnId,
            collaboration:
              typeof card.collaboration === 'object' && card.collaboration !== null
                ? {
                    assigneeId:
                      typeof card.collaboration.assigneeId === 'string' ||
                      card.collaboration.assigneeId === null
                        ? card.collaboration.assigneeId
                        : undefined,
                    createdById:
                      typeof card.collaboration.createdById === 'string' ||
                      card.collaboration.createdById === null
                        ? card.collaboration.createdById
                        : undefined,
                    watcherIds: Array.isArray(card.collaboration.watcherIds)
                      ? card.collaboration.watcherIds.filter(
                          (watcherId): watcherId is string => typeof watcherId === 'string',
                        )
                      : undefined,
                  }
                : undefined,
            taskNumber:
              typeof card.taskNumber === 'number' &&
              Number.isInteger(card.taskNumber) &&
              card.taskNumber >= 1
                ? card.taskNumber
                : 1,
          };
        })
    : [];

  const sharedBacklog = Array.isArray(state.sharedKanbanBacklogCards)
    ? state.sharedKanbanBacklogCards
        .filter((card) => card && typeof card.id === 'string' && typeof card.title === 'string')
        .map((card) => ({
          ...card,
          markdown: typeof card.markdown === 'string' ? card.markdown : '',
          priority: KANBAN_PRIORITY_ORDER.includes(card.priority) ? card.priority : 'none',
          columnId: 'backlog',
          collaboration:
            typeof card.collaboration === 'object' && card.collaboration !== null
              ? {
                  assigneeId:
                    typeof card.collaboration.assigneeId === 'string' ||
                    card.collaboration.assigneeId === null
                      ? card.collaboration.assigneeId
                      : undefined,
                  createdById:
                    typeof card.collaboration.createdById === 'string' ||
                    card.collaboration.createdById === null
                      ? card.collaboration.createdById
                      : undefined,
                  watcherIds: Array.isArray(card.collaboration.watcherIds)
                    ? card.collaboration.watcherIds.filter(
                        (watcherId): watcherId is string => typeof watcherId === 'string',
                      )
                    : undefined,
                }
              : undefined,
          taskNumber:
            typeof card.taskNumber === 'number' && Number.isInteger(card.taskNumber) && card.taskNumber >= 1
              ? card.taskNumber
              : 1,
        }))
    : [];

  const maxKnownTaskNumber = Math.max(
    0,
    ...cards.map((card) => card.taskNumber),
    ...sharedBacklog.map((card) => card.taskNumber),
  );
  const collapsedColumnIds = Array.isArray(kanban?.collapsedColumnIds)
    ? [...new Set(kanban.collapsedColumnIds.filter((id): id is string => typeof id === 'string'))].filter(
        (id) => columns.some((column) => column.id === id),
      )
    : [];
  const nextTaskNumber =
    typeof kanban?.nextTaskNumber === 'number' &&
    Number.isInteger(kanban.nextTaskNumber) &&
    kanban.nextTaskNumber >= 1
      ? Math.max(kanban.nextTaskNumber, maxKnownTaskNumber + 1)
      : Math.max(1, maxKnownTaskNumber + 1);

  return {
    ...state,
    nodeDataById: {
      ...state.nodeDataById,
      [nodeId]: {
        ...(workspace ?? {}),
        kanban: {
          columns,
          cards,
          nextTaskNumber,
          collapsedColumnIds,
        },
      },
    },
    sharedKanbanBacklogCards: sharedBacklog,
  };
};

export const ensureNoteboardData = (
  state: PersistedTreeState,
  nodeId: string,
): PersistedTreeState => {
  const workspace = state.nodeDataById[nodeId];
  const noteboard = workspace?.noteboard;
  const cards = noteboard?.cards ?? [];
  let cardsChanged = !noteboard || !Array.isArray(noteboard.cards);
  const nextCards = cards.map((card, index) => {
    const next = { ...card };
    if (typeof next.x !== 'number' || !Number.isFinite(next.x)) {
      next.x = (index % 3) * 260 - 260;
      cardsChanged = true;
    }
    if (typeof next.y !== 'number' || !Number.isFinite(next.y)) {
      next.y = Math.floor(index / 3) * 220 - 220;
      cardsChanged = true;
    }
    const widthValue =
      typeof (next as Partial<NoteboardCard>).width === 'number' &&
      Number.isFinite((next as Partial<NoteboardCard>).width)
        ? ((next as Partial<NoteboardCard>).width as number)
        : CARD_WIDTH;
    const heightValue =
      typeof (next as Partial<NoteboardCard>).height === 'number' &&
      Number.isFinite((next as Partial<NoteboardCard>).height)
        ? ((next as Partial<NoteboardCard>).height as number)
        : CARD_MIN_HEIGHT;
    next.width = Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, widthValue));
    next.height = Math.max(CARD_MIN_HEIGHT, Math.min(CARD_MAX_HEIGHT, heightValue));
    next.color =
      typeof (next as Partial<NoteboardCard>).color === 'string' &&
      isHexColor((next as Partial<NoteboardCard>).color as string)
        ? ((next as Partial<NoteboardCard>).color as string)
        : DEFAULT_NOTEBOARD_CARD_COLOR;

    const estimated = estimateCardDimensionsFromText(next.text);
    next.width = Math.max(next.width, estimated.width);
    next.height = Math.max(next.height, estimated.height);

    const clamped = clampCardToWorld(next.x, next.y, next.width, next.height);
    if (clamped.x !== next.x || clamped.y !== next.y) {
      next.x = clamped.x;
      next.y = clamped.y;
      cardsChanged = true;
    }

    if (
      next.x !== card.x ||
      next.y !== card.y ||
      next.width !== (card as Partial<NoteboardCard>).width ||
      next.height !== (card as Partial<NoteboardCard>).height
    ) {
      cardsChanged = true;
    }
    return next;
  });

  const strokes = noteboard?.strokes ?? [];
  let strokesChanged = !noteboard || !Array.isArray(noteboard.strokes);
  const nextStrokes = strokes.flatMap((stroke): NoteboardStroke[] => {
      if (
        typeof stroke !== 'object' ||
        stroke === null ||
        typeof stroke.id !== 'string' ||
        !Array.isArray(stroke.points)
      ) {
        strokesChanged = true;
        return [];
      }

      const points = stroke.points
        .filter(
          (point) =>
            point &&
            typeof point.x === 'number' &&
            Number.isFinite(point.x) &&
            typeof point.y === 'number' &&
            Number.isFinite(point.y),
        )
        .map((point) => ({
          x: point.x,
          y: point.y,
          pressure:
            typeof point.pressure === 'number' && Number.isFinite(point.pressure)
              ? Math.max(0.15, Math.min(1, point.pressure))
              : undefined,
          t:
            typeof point.t === 'number' && Number.isFinite(point.t)
              ? point.t
              : undefined,
        }));

      if (points.length !== stroke.points.length) {
        strokesChanged = true;
      }

      const size =
        typeof stroke.size === 'number' && Number.isFinite(stroke.size)
          ? Math.max(2, Math.min(MAX_DRAW_SIZE, stroke.size))
          : 10;
      const opacity =
        typeof stroke.opacity === 'number' && Number.isFinite(stroke.opacity)
          ? Math.max(0.05, Math.min(1, stroke.opacity))
          : 0.85;
      const color = typeof stroke.color === 'string' && stroke.color.trim() ? stroke.color : '#000000';
      const brush: NoteboardBrushType =
        stroke.brush === 'pen' ||
        stroke.brush === 'ink' ||
        stroke.brush === 'marker' ||
        stroke.brush === 'charcoal'
          ? stroke.brush
          : 'pen';
      const createdAt =
        typeof stroke.createdAt === 'number' && Number.isFinite(stroke.createdAt)
          ? stroke.createdAt
          : Date.now();

      if (
        size !== stroke.size ||
        opacity !== stroke.opacity ||
        color !== stroke.color ||
        brush !== stroke.brush ||
        createdAt !== stroke.createdAt
      ) {
        strokesChanged = true;
      }

      return [{
        id: stroke.id,
        createdAt,
        brush,
        color,
        size,
        opacity,
        points,
      }];
    });

  let viewChanged = !noteboard || !noteboard.view;
  const nextView = noteboard?.view
    ? { ...noteboard.view }
    : {
        zoom: 1,
        offsetX: NOTEBOARD_WORLD_MIN_X + 180,
        offsetY: NOTEBOARD_WORLD_MIN_Y + 120,
      };

  if (
    Math.abs(nextView.offsetX - 180) < 1 &&
    Math.abs(nextView.offsetY - 120) < 1
  ) {
    nextView.offsetX += NOTEBOARD_WORLD_MIN_X;
    nextView.offsetY += NOTEBOARD_WORLD_MIN_Y;
    viewChanged = true;
  }

  if (
    noteboard?.view &&
    (nextView.zoom !== noteboard.view.zoom ||
      nextView.offsetX !== noteboard.view.offsetX ||
      nextView.offsetY !== noteboard.view.offsetY)
  ) {
    viewChanged = true;
  }

  if (!cardsChanged && !strokesChanged && !viewChanged && workspace && noteboard) {
    return state;
  }

  return {
    ...state,
    nodeDataById: {
      ...state.nodeDataById,
      [nodeId]: {
        ...(workspace ?? {}),
        noteboard: {
          ...(noteboard ?? {}),
          cards: cardsChanged ? nextCards : cards,
          strokes: strokesChanged ? nextStrokes : strokes,
          view: nextView,
        },
      },
    },
  };
};

export const ensureSpreadsheetData = (
  state: PersistedTreeState,
  nodeId: string,
): PersistedTreeState => {
  const workspace = state.nodeDataById[nodeId];
  const spreadsheet = workspace?.spreadsheet;

  const sourceSheets = Array.isArray(spreadsheet?.sheets) ? spreadsheet.sheets : [];
  const nextSheets = sourceSheets
    .filter((sheet) => typeof sheet?.id === 'string' && typeof sheet?.name === 'string')
    .map((sheet, index) => {
      const trimmedId = sheet.id.trim();
      const sheetId = trimmedId || `sheet-${index + 1}`;
      const sheetName = sheet.name.trim() || `Sheet ${index + 1}`;
      const sourceCells =
        typeof sheet.cells === 'object' && sheet.cells !== null && !Array.isArray(sheet.cells)
          ? sheet.cells
          : {};
      const nextCells = Object.entries(sourceCells as Record<string, { raw?: unknown }>).reduce<
        Record<string, { raw: string }>
      >((acc, [cellKey, cell]) => {
        const normalizedKey = cellKey.trim().toUpperCase();
        if (!isSpreadsheetCellKey(normalizedKey)) {
          return acc;
        }
        if (!cell || typeof cell.raw !== 'string') {
          return acc;
        }
        acc[normalizedKey] = { raw: cell.raw };
        return acc;
      }, {});

      return {
        id: sheetId,
        name: sheetName,
        cells: nextCells,
      };
    });

  if (nextSheets.length === 0) {
    nextSheets.push({ ...DEFAULT_SPREADSHEET_SHEET, cells: {} });
  }

  const knownSheetIds = new Set(nextSheets.map((sheet) => sheet.id));
  const activeSheetId =
    typeof spreadsheet?.activeSheetId === 'string' && knownSheetIds.has(spreadsheet.activeSheetId)
      ? spreadsheet.activeSheetId
      : nextSheets[0].id;
  const activeCellKey =
    typeof spreadsheet?.activeCellKey === 'string' && isSpreadsheetCellKey(spreadsheet.activeCellKey)
      ? spreadsheet.activeCellKey.trim().toUpperCase()
      : 'A1';

  const rowCountSource = typeof spreadsheet?.rowCount === 'number' ? spreadsheet.rowCount : DEFAULT_SPREADSHEET_ROW_COUNT;
  const rowCount = Math.min(
    MAX_SPREADSHEET_ROW_COUNT,
    Math.max(MIN_SPREADSHEET_ROW_COUNT, Math.floor(rowCountSource)),
  );
  const columnCountSource =
    typeof spreadsheet?.columnCount === 'number' ? spreadsheet.columnCount : DEFAULT_SPREADSHEET_COLUMN_COUNT;
  const columnCount = Math.min(
    MAX_SPREADSHEET_COLUMN_COUNT,
    Math.max(MIN_SPREADSHEET_COLUMN_COUNT, Math.floor(columnCountSource)),
  );

  const nextSpreadsheet: SpreadsheetData = {
    sheets: nextSheets,
    activeSheetId,
    activeCellKey,
    rowCount,
    columnCount,
    rowHeights:
      typeof spreadsheet?.rowHeights === 'object' &&
      spreadsheet.rowHeights !== null &&
      !Array.isArray(spreadsheet.rowHeights)
        ? Object.entries(spreadsheet.rowHeights as Record<string, unknown>).reduce<
            Record<string, number>
          >((acc, [key, value]) => {
            const index = Number(key);
            if (!Number.isInteger(index) || index < 0 || index >= rowCount) {
              return acc;
            }
            if (typeof value !== 'number' || !Number.isFinite(value)) {
              return acc;
            }
            acc[String(index)] = Math.min(120, Math.max(22, Math.round(value)));
            return acc;
          }, {})
        : {},
    columnWidths:
      typeof spreadsheet?.columnWidths === 'object' &&
      spreadsheet.columnWidths !== null &&
      !Array.isArray(spreadsheet.columnWidths)
        ? Object.entries(spreadsheet.columnWidths as Record<string, unknown>).reduce<
            Record<string, number>
          >((acc, [key, value]) => {
            const index = Number(key);
            if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
              return acc;
            }
            if (typeof value !== 'number' || !Number.isFinite(value)) {
              return acc;
            }
            acc[String(index)] = Math.min(320, Math.max(72, Math.round(value)));
            return acc;
          }, {})
        : {},
  };

  const spreadsheetUnchanged =
    spreadsheet &&
    spreadsheet.sheets === nextSpreadsheet.sheets &&
    spreadsheet.activeSheetId === nextSpreadsheet.activeSheetId &&
    spreadsheet.activeCellKey === nextSpreadsheet.activeCellKey &&
    spreadsheet.rowCount === nextSpreadsheet.rowCount &&
    spreadsheet.columnCount === nextSpreadsheet.columnCount;
  if (workspace && spreadsheetUnchanged) {
    return state;
  }

  const hasEffectiveChange =
    !spreadsheet ||
    spreadsheet.activeSheetId !== nextSpreadsheet.activeSheetId ||
    spreadsheet.activeCellKey !== nextSpreadsheet.activeCellKey ||
    spreadsheet.rowCount !== nextSpreadsheet.rowCount ||
    spreadsheet.columnCount !== nextSpreadsheet.columnCount ||
    Object.keys(spreadsheet.rowHeights ?? {}).length !==
      Object.keys(nextSpreadsheet.rowHeights ?? {}).length ||
    Object.keys(spreadsheet.columnWidths ?? {}).length !==
      Object.keys(nextSpreadsheet.columnWidths ?? {}).length ||
    Object.entries(nextSpreadsheet.rowHeights ?? {}).some(
      ([key, value]) => (spreadsheet.rowHeights ?? {})[key] !== value,
    ) ||
    Object.entries(nextSpreadsheet.columnWidths ?? {}).some(
      ([key, value]) => (spreadsheet.columnWidths ?? {})[key] !== value,
    ) ||
    spreadsheet.sheets.length !== nextSpreadsheet.sheets.length ||
    spreadsheet.sheets.some((sheet, index) => {
      const nextSheet = nextSpreadsheet.sheets[index];
      if (!nextSheet) {
        return true;
      }
      if (sheet.id !== nextSheet.id || sheet.name !== nextSheet.name) {
        return true;
      }
      const keys = Object.keys(sheet.cells ?? {});
      const nextKeys = Object.keys(nextSheet.cells);
      if (keys.length !== nextKeys.length) {
        return true;
      }
      return nextKeys.some((key) => (sheet.cells as Record<string, { raw?: string }>)[key]?.raw !== nextSheet.cells[key]?.raw);
    });

  if (!hasEffectiveChange && workspace) {
    return state;
  }

  return {
    ...state,
    nodeDataById: {
      ...state.nodeDataById,
      [nodeId]: {
        ...(workspace ?? {}),
        spreadsheet: nextSpreadsheet,
      },
    },
  };
};
