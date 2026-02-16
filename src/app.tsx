import React from 'react';
import type {
  AppTheme,
  CardTemplate,
  CategoryNode,
  EditorType,
  NoteboardBrushType,
  NoteboardCard,
  NoteboardStroke,
  PersistedTreeState,
  ProjectImageAsset,
  UserSettings,
} from './shared/types';
import {
  NOTEBOARD_WORLD_MAX_X,
  NOTEBOARD_WORLD_MAX_Y,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from './shared/noteboard-constants';
import {
  countDescendants,
  createNode,
  findFirstNodeId,
  findNodeById,
  removeNodeById,
} from './shared/tree-utils';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  CARD_WIDTH,
  CANVAS_PADDING,
  clampCardToWorld,
  clampViewOffsets,
  createNoteboardCard,
  DEFAULT_NOTEBOARD_CARD_COLOR,
  getMinZoomForCanvas,
  getWorldPoint,
  type NoteboardView,
} from './renderer/noteboard-utils';
import { buildLinkPreviews } from './renderer/noteboard-link-preview';
import { appendPointWithPressure, createBrushStroke } from './renderer/noteboard-drawing';
import { createHistoryStack } from './renderer/history-stack';
import { isPersistedTreeState } from './renderer/persistence-guards';
import { NodeTree } from './components/node-tree';
import { CreateNodeDialog, DeleteNodeDialog, SettingsDialog } from './components/dialogs';
import { EditorPanel } from './components/editor-panel';
import { NoteboardCanvas } from './components/noteboard-canvas';
import { DocumentEditor } from './components/document-editor';

type UiState = {
  editingNodeId: string | null;
  editingNameDraft: string;
  pendingDeleteNodeId: string | null;
  pendingCreateParentRef: string | 'root' | null;
  isSettingsDialogOpen: boolean;
  settingsDraftSidebarWidth: string;
  settingsDraftTheme: AppTheme;
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

type HistorySnapshot = {
  state: PersistedTreeState;
  cardSelection: {
    nodeId: string | null;
    cardIds: string[];
  };
};

type DragState = {
  pointerId: number;
  nodeId: string;
  movingCardIds: string[];
  pointerStartX: number;
  pointerStartY: number;
  startPositions: Record<string, { x: number; y: number }>;
};

type ResizeState = {
  pointerId: number;
  nodeId: string;
  cardId: string;
  startPointerX: number;
  startPointerY: number;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
};

type PanState = {
  pointerId: number;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};

type DrawState = {
  pointerId: number;
  nodeId: string;
  tool: 'pen' | 'brush' | 'eraser';
  strokeId: string | null;
};

type QueuedDrawPoint = {
  x: number;
  y: number;
  at: number;
};

type AppClipboard =
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

type DroppedCanvasPayload = {
  files: File[];
  textPlain: string;
  textUriList: string;
  textHtml: string;
  testoImageAsset: string;
};

type CardTemplateId =
  | 'blank'
  | 'list'
  | 'checklist'
  | 'table'
  | 'quest-log'
  | 'mechanic-spec';
const CUSTOM_TEMPLATE_MAX_COUNT = 40;

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 620;
const MAX_ZOOM = 2.5;
const MAX_HISTORY_ENTRIES = 120;
const MAX_DRAW_SIZE = 64;
const CARD_MAX_WIDTH = 560;
const CARD_MAX_HEIGHT = 520;
const CARD_AUTO_MAX_WIDTH = 420;
const CONTEXT_MENU_WIDTH = 228;
const CONTEXT_MENU_HEIGHT = 86;
const DRAWING_PRESET_COLOR_COUNT = 6;
const DEFAULT_DRAWING_PRESET_COLORS = [
  '#1e1f24',
  '#ff6b6b',
  '#4dabf7',
  '#51cf66',
  '#ffd43b',
  '#f783ac',
];
const CARD_COLOR_PRESETS = [
  '#ffd8a8',
  '#ffc9de',
  '#c5f6d0',
  '#cfe8ff',
  '#e5dbff',
];
const THEME_CARD_COLORS: Record<AppTheme, string> = {
  parchment: '#fff1a8',
  midnight: '#2b3f57',
  evergreen: '#d6ebd2',
};
const CARD_TEMPLATES: Array<{ id: CardTemplateId; label: string; markdown: string }> = [
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

const defaultState: PersistedTreeState = {
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
};

const defaultSettings: UserSettings = {
  sidebarWidth: 320,
  theme: 'parchment',
  drawingTool: 'brush',
  drawingBrush: 'ink',
  drawingSize: 10,
  drawingOpacity: 0.85,
  drawingColor: '#1e1f24',
  drawingPresetColors: [...DEFAULT_DRAWING_PRESET_COLORS],
  cardTemplates: [],
};

const themeOptions: Array<{ value: AppTheme; label: string }> = [
  { value: 'parchment', label: 'Parchment' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'evergreen', label: 'Evergreen' },
];

const isAppTheme = (value: unknown): value is AppTheme =>
  value === 'parchment' || value === 'midnight' || value === 'evergreen';

const getThemeCardColor = (theme: AppTheme): string =>
  THEME_CARD_COLORS[theme] ?? THEME_CARD_COLORS.parchment;

const clampSidebarWidth = (value: number): number =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));

const isHexColor = (value: string): boolean =>
  /^#[0-9a-f]{6}$/i.test(value.trim());

const sanitizeDrawingPresetColors = (input: unknown): string[] => {
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

const sanitizeCardTemplates = (input: unknown): CardTemplate[] => {
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

const createCustomTemplateId = (): string =>
  `custom-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const normalizeClipboardText = (value: string): string => value.replace(/\r\n/g, '\n').trim();
const isTextEntryTargetElement = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const firstUrlFromText = (value: string): string | null => {
  const match = value.match(/https?:\/\/[^\s<>"'`]+/i);
  return match ? match[0] : null;
};

const firstUrlFromUriList = (value: string): string | null => {
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

const firstImageUrlFromHtml = (value: string): string | null => {
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

const parseDroppedTestoImageAsset = (
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

const estimateCardDimensionsFromText = (
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

const fitImageDimensionsToCardBounds = (
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

const isUserSettings = (value: unknown): value is UserSettings => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    sidebarWidth?: unknown;
    theme?: unknown;
    drawingTool?: unknown;
    drawingBrush?: unknown;
    drawingSize?: unknown;
    drawingOpacity?: unknown;
    drawingColor?: unknown;
    drawingPresetColors?: unknown;
    cardTemplates?: unknown;
  };
  return (
    typeof obj.sidebarWidth === 'number' &&
    Number.isFinite(obj.sidebarWidth) &&
    obj.sidebarWidth >= MIN_SIDEBAR_WIDTH &&
    obj.sidebarWidth <= MAX_SIDEBAR_WIDTH &&
    (obj.theme === undefined || isAppTheme(obj.theme)) &&
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
        })))
  );
};

const collectSubtreeIds = (root: CategoryNode): string[] => {
  const ids = [root.id];
  root.children.forEach((child) => {
    ids.push(...collectSubtreeIds(child));
  });
  return ids;
};

const getCardsForNode = (state: PersistedTreeState, nodeId: string): NoteboardCard[] =>
  state.nodeDataById[nodeId]?.noteboard?.cards ?? [];

const getStrokesForNode = (state: PersistedTreeState, nodeId: string): NoteboardStroke[] =>
  state.nodeDataById[nodeId]?.noteboard?.strokes ?? [];

const getViewForNode = (state: PersistedTreeState, nodeId: string): NoteboardView =>
  state.nodeDataById[nodeId]?.noteboard?.view ?? {
    zoom: 1,
    offsetX: NOTEBOARD_WORLD_MIN_X + 180,
    offsetY: NOTEBOARD_WORLD_MIN_Y + 120,
  };

const getDocumentMarkdownForNode = (state: PersistedTreeState, nodeId: string): string =>
  state.nodeDataById[nodeId]?.document?.markdown ?? '';

const ensureNoteboardData = (
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

export const App = (): React.ReactElement => {
  const [state, setState] = React.useState<PersistedTreeState>(defaultState);
  const [settings, setSettings] = React.useState<UserSettings>(defaultSettings);
  const [imageAssets, setImageAssets] = React.useState<ProjectImageAsset[]>([]);
  const [uiState, setUiState] = React.useState<UiState>({
    editingNodeId: null,
    editingNameDraft: '',
    pendingDeleteNodeId: null,
    pendingCreateParentRef: null,
    isSettingsDialogOpen: false,
    settingsDraftSidebarWidth: String(defaultSettings.sidebarWidth),
    settingsDraftTheme: defaultSettings.theme,
    isDrawingMode: false,
    cardSelection: {
      nodeId: null,
      cardIds: [],
    },
    contextMenu: null,
    selectionBox: null,
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const [isBootstrapped, setIsBootstrapped] = React.useState(false);
  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const resizeRef = React.useRef<ResizeState | null>(null);
  const panRef = React.useRef<PanState | null>(null);
  const drawRef = React.useRef<DrawState | null>(null);
  const drawPointQueueRef = React.useRef<QueuedDrawPoint[]>([]);
  const drawRafRef = React.useRef<number | null>(null);
  const clipboardRef = React.useRef<AppClipboard>(null);
  const textEditSessionsRef = React.useRef<Set<string>>(new Set<string>());
  const documentEditSessionsRef = React.useRef<Set<string>>(new Set<string>());
  const historyStackRef = React.useRef(createHistoryStack<HistorySnapshot>(MAX_HISTORY_ENTRIES));
  const stateRef = React.useRef<PersistedTreeState>(state);
  const settingsRef = React.useRef<UserSettings>(settings);
  const uiStateRef = React.useRef<UiState>(uiState);
  const stateSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    uiStateRef.current = uiState;
  }, [uiState]);

  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  React.useEffect(() => {
    const unsubscribe = window.testoApi?.onOpenSettings(() => {
      setUiState((prev) => ({
        ...prev,
        isSettingsDialogOpen: true,
        settingsDraftSidebarWidth: String(settingsRef.current.sidebarWidth),
        settingsDraftTheme: settingsRef.current.theme,
      }));
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const getBrushColor = React.useCallback((): string => {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-text')
      .trim();
    if (!resolved) {
      return '#1e1f24';
    }
    if (resolved.startsWith('#')) {
      return resolved;
    }

    const match = resolved.match(
      /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)/i,
    );
    if (!match) {
      return '#1e1f24';
    }

    const [r, g, b] = match.slice(1, 4).map((value) =>
      Math.max(0, Math.min(255, Number(value))),
    );
    return `#${[r, g, b]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')}`;
  }, []);

  const refreshImageAssets = React.useCallback(async (): Promise<void> => {
    if (!window.testoApi?.listImageAssets) {
      return;
    }

    try {
      const assets = await window.testoApi.listImageAssets();
      setImageAssets(assets);
    } catch {
      // Keep current list if image asset listing fails.
    }
  }, []);

  const eraseStrokesAtPoint = React.useCallback(
    (
      prev: PersistedTreeState,
      nodeId: string,
      x: number,
      y: number,
      screenRadius: number,
      viewZoom: number,
    ): PersistedTreeState => {
      const next = ensureNoteboardData(prev, nodeId);
      const strokes = getStrokesForNode(next, nodeId);
      if (strokes.length === 0) {
        return prev;
      }

      const zoomScale = Math.max(0.05, viewZoom);
      const worldRadius = screenRadius / zoomScale;
      const kept = strokes.filter(
        (stroke) =>
          !stroke.points.some(
            (point) =>
              Math.hypot(point.x - x, point.y - y) <= worldRadius + stroke.size * 0.5 / zoomScale,
          ),
      );
      if (kept.length === strokes.length) {
        return prev;
      }

      return {
        ...next,
        nodeDataById: {
          ...next.nodeDataById,
          [nodeId]: {
            ...(next.nodeDataById[nodeId] ?? {}),
            noteboard: {
              ...(next.nodeDataById[nodeId]?.noteboard ?? { cards: [] }),
              cards: [...getCardsForNode(next, nodeId)],
              strokes: kept,
              view: { ...getViewForNode(next, nodeId) },
            },
          },
        },
      };
    },
    [],
  );

  const flushQueuedDrawPoints = React.useCallback((): void => {
    drawRafRef.current = null;
    const draw = drawRef.current;
    if (!draw) {
      drawPointQueueRef.current = [];
      return;
    }

    const queued = drawPointQueueRef.current;
    if (queued.length === 0) {
      return;
    }
    drawPointQueueRef.current = [];

    if (draw.tool === 'eraser') {
      setState((prev) => {
        let nextState = prev;
        const eraserRadiusPx = Math.max(
          6,
          settingsRef.current.drawingSize ?? defaultSettings.drawingSize ?? 10,
        );

        queued.forEach((point) => {
          const currentView = getViewForNode(nextState, draw.nodeId);
          nextState = eraseStrokesAtPoint(
            nextState,
            draw.nodeId,
            point.x,
            point.y,
            eraserRadiusPx,
            currentView.zoom,
          );
        });

        return nextState;
      });
      return;
    }

    setState((prev) => {
      const next = ensureNoteboardData(prev, draw.nodeId);
      const currentStrokes = getStrokesForNode(next, draw.nodeId);
      let hasStrokeChange = false;

      const strokes = currentStrokes.map((stroke) => {
        if (stroke.id !== draw.strokeId) {
          return stroke;
        }

        let points = stroke.points;
        queued.forEach((point) => {
          points = appendPointWithPressure(points, { x: point.x, y: point.y }, point.at);
        });

        if (points === stroke.points) {
          return stroke;
        }

        hasStrokeChange = true;
        return {
          ...stroke,
          points,
        };
      });

      if (!hasStrokeChange) {
        return prev;
      }

      const view = getViewForNode(next, draw.nodeId);
      return {
        ...next,
        nodeDataById: {
          ...next.nodeDataById,
          [draw.nodeId]: {
            ...(next.nodeDataById[draw.nodeId] ?? {}),
            noteboard: {
              ...(next.nodeDataById[draw.nodeId]?.noteboard ?? { cards: [] }),
              cards: [...getCardsForNode(next, draw.nodeId)],
              strokes,
              view: { ...view },
            },
          },
        },
      };
    });
  }, [eraseStrokesAtPoint]);

  const deepCloneState = (input: PersistedTreeState): PersistedTreeState =>
    JSON.parse(JSON.stringify(input)) as PersistedTreeState;

  const captureHistorySnapshot = React.useCallback((): HistorySnapshot => {
    const currentState = stateRef.current;
    const currentUi = uiStateRef.current;

    return {
      state: deepCloneState(currentState),
      cardSelection: {
        nodeId: currentUi.cardSelection.nodeId,
        cardIds: [...currentUi.cardSelection.cardIds],
      },
    };
  }, []);

  const pushHistory = React.useCallback(() => {
    historyStackRef.current.push(captureHistorySnapshot());
  }, [captureHistorySnapshot]);

  const applyHistorySnapshot = React.useCallback((snapshot: HistorySnapshot) => {
    setState(snapshot.state);
    setUiState((prev) => ({
      ...prev,
      cardSelection: {
        nodeId: snapshot.cardSelection.nodeId,
        cardIds: [...snapshot.cardSelection.cardIds],
      },
      contextMenu: null,
      selectionBox: null,
    }));
    dragRef.current = null;
    resizeRef.current = null;
    panRef.current = null;
    drawRef.current = null;
    drawPointQueueRef.current = [];
    if (drawRafRef.current !== null) {
      window.cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
    textEditSessionsRef.current.clear();
    documentEditSessionsRef.current.clear();
    document.body.classList.remove('is-dragging-card');
    document.body.classList.remove('is-resizing-card');
    document.body.classList.remove('is-panning-canvas');
    document.body.classList.remove('is-drawing-canvas');
  }, []);

  const undoHistory = React.useCallback(() => {
    const previous = historyStackRef.current.undo(captureHistorySnapshot());
    if (!previous) {
      return;
    }
    applyHistorySnapshot(previous);
  }, [applyHistorySnapshot, captureHistorySnapshot]);

  const redoHistory = React.useCallback(() => {
    const next = historyStackRef.current.redo(captureHistorySnapshot());
    if (!next) {
      return;
    }
    applyHistorySnapshot(next);
  }, [applyHistorySnapshot, captureHistorySnapshot]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!window.testoApi) {
        return;
      }

      try {
        const [loadedState, loadedSettings, loadedImageAssets] = await Promise.all([
          window.testoApi.loadTreeState(),
          window.testoApi.loadUserSettings(),
          window.testoApi.listImageAssets ? window.testoApi.listImageAssets() : Promise.resolve([]),
        ]);

        if (!cancelled && loadedState && isPersistedTreeState(loadedState)) {
          setState({
            nodes: loadedState.nodes,
            selectedNodeId: loadedState.selectedNodeId,
            nextNodeNumber: loadedState.nextNodeNumber,
            nodeDataById: loadedState.nodeDataById ?? {},
          });
        }

        if (!cancelled && loadedSettings && isUserSettings(loadedSettings)) {
          setSettings({
            sidebarWidth: clampSidebarWidth(loadedSettings.sidebarWidth),
            theme: loadedSettings.theme ?? defaultSettings.theme,
            drawingTool: loadedSettings.drawingTool ?? defaultSettings.drawingTool,
            drawingBrush: loadedSettings.drawingBrush ?? defaultSettings.drawingBrush,
            drawingSize: loadedSettings.drawingSize ?? defaultSettings.drawingSize,
            drawingOpacity: loadedSettings.drawingOpacity ?? defaultSettings.drawingOpacity,
            drawingColor: loadedSettings.drawingColor ?? defaultSettings.drawingColor,
            drawingPresetColors: sanitizeDrawingPresetColors(loadedSettings.drawingPresetColors),
            cardTemplates: sanitizeCardTemplates(loadedSettings.cardTemplates),
          });
        }

        if (!cancelled) {
          setImageAssets(loadedImageAssets);
        }
      } catch {
        // Keep in-memory defaults if persisted state/settings fail to load.
      } finally {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    if (!window.testoApi) {
      return;
    }

    if (stateSaveTimerRef.current) {
      clearTimeout(stateSaveTimerRef.current);
    }

    stateSaveTimerRef.current = setTimeout(() => {
      void window.testoApi?.saveTreeState(state);
    }, 180);

    return () => {
      if (stateSaveTimerRef.current) {
        clearTimeout(stateSaveTimerRef.current);
      }
    };
  }, [isBootstrapped, state]);

  React.useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    if (!window.testoApi) {
      return;
    }

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = setTimeout(() => {
      void window.testoApi?.saveUserSettings(settings);
    }, 220);

    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
      }
    };
  }, [isBootstrapped, settings]);

  const onBeginResize = React.useCallback(() => {
    setIsResizing(true);
  }, []);

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }

    const onPointerMove = (event: PointerEvent): void => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      setSettings((prev) => ({
        ...prev,
        sidebarWidth: clampSidebarWidth(event.clientX - shellRect.left),
      }));
    };

    const onPointerUp = (): void => {
      setIsResizing(false);
    };

    document.body.classList.add('is-resizing-sidebar');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.body.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isResizing]);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const selectionBox = uiStateRef.current.selectionBox;
      if (selectionBox && event.pointerId === selectionBox.pointerId) {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        const next = ensureNoteboardData(stateRef.current, selectionBox.nodeId);
        const view = getViewForNode(next, selectionBox.nodeId);
        const world = getWorldPoint(canvas, view, event.clientX, event.clientY);
        const minX = Math.min(selectionBox.startX, world.x);
        const maxX = Math.max(selectionBox.startX, world.x);
        const minY = Math.min(selectionBox.startY, world.y);
        const maxY = Math.max(selectionBox.startY, world.y);
        const hits = getCardsForNode(next, selectionBox.nodeId)
          .filter((card) => {
            const cardMinX = card.x;
            const cardMaxX = card.x + card.width;
            const cardMinY = card.y;
            const cardMaxY = card.y + card.height;
            return !(
              cardMaxX < minX ||
              cardMinX > maxX ||
              cardMaxY < minY ||
              cardMinY > maxY
            );
          })
          .map((card) => card.id);

        const merged = selectionBox.additive
          ? Array.from(new Set([...selectionBox.baseSelectedCardIds, ...hits]))
          : hits;

        setUiState((prev) => ({
          ...prev,
          selectionBox: {
            ...selectionBox,
            currentX: world.x,
            currentY: world.y,
          },
          cardSelection: {
            nodeId: selectionBox.nodeId,
            cardIds: merged,
          },
        }));
        event.preventDefault();
        return;
      }

      const pan = panRef.current;
      if (pan && event.pointerId === pan.pointerId) {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        setState((prev) => {
          const next = ensureNoteboardData(prev, pan.nodeId);
          const view = { ...getViewForNode(next, pan.nodeId) };
          view.offsetX = pan.startOffsetX + (event.clientX - pan.startClientX);
          view.offsetY = pan.startOffsetY + (event.clientY - pan.startClientY);
          clampViewOffsets(canvas, view);

          return {
            ...next,
            nodeDataById: {
              ...next.nodeDataById,
              [pan.nodeId]: {
                ...(next.nodeDataById[pan.nodeId] ?? {}),
                noteboard: {
                  ...(next.nodeDataById[pan.nodeId]?.noteboard ?? { cards: [] }),
                  cards: [...getCardsForNode(next, pan.nodeId)],
                  view,
                },
              },
            },
          };
        });
        event.preventDefault();
        return;
      }

      const draw = drawRef.current;
      if (draw && event.pointerId === draw.pointerId) {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const sourceState = ensureNoteboardData(stateRef.current, draw.nodeId);
        const view = getViewForNode(sourceState, draw.nodeId);
        const coalesced =
          typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
        const samples = coalesced.length > 0 ? coalesced : [event];

        samples.forEach((sample) => {
          const world = getWorldPoint(canvas, view, sample.clientX, sample.clientY);
          drawPointQueueRef.current.push({
            x: world.x,
            y: world.y,
            at: Date.now(),
          });
        });

        if (drawRafRef.current === null) {
          drawRafRef.current = window.requestAnimationFrame(() => {
            flushQueuedDrawPoints();
          });
        }

        event.preventDefault();
        return;
      }

      const resize = resizeRef.current;
      if (resize && event.pointerId === resize.pointerId) {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        setState((prev) => {
          const next = ensureNoteboardData(prev, resize.nodeId);
          const view = getViewForNode(next, resize.nodeId);
          const world = getWorldPoint(canvas, view, event.clientX, event.clientY);
          const deltaX = world.x - resize.startPointerX;
          const deltaY = world.y - resize.startPointerY;
          const resizedCard = getCardsForNode(next, resize.nodeId).find(
            (card) => card.id === resize.cardId,
          );
          const contentMin = estimateCardDimensionsFromText(resizedCard?.text ?? '');
          const maxWidthByWorld = NOTEBOARD_WORLD_MAX_X - CANVAS_PADDING - resize.startX;
          const maxHeightByWorld = NOTEBOARD_WORLD_MAX_Y - CANVAS_PADDING - resize.startY;
          const nextWidth = Math.max(
            Math.max(CARD_MIN_WIDTH, contentMin.width),
            Math.min(CARD_MAX_WIDTH, maxWidthByWorld, resize.startWidth + deltaX),
          );
          const nextHeight = Math.max(
            Math.max(CARD_MIN_HEIGHT, contentMin.height),
            Math.min(CARD_MAX_HEIGHT, maxHeightByWorld, resize.startHeight + deltaY),
          );

          const cards = getCardsForNode(next, resize.nodeId).map((card) =>
            card.id === resize.cardId
              ? {
                  ...card,
                  width: nextWidth,
                  height: nextHeight,
                }
              : card,
          );

          return {
            ...next,
            nodeDataById: {
              ...next.nodeDataById,
              [resize.nodeId]: {
                ...(next.nodeDataById[resize.nodeId] ?? {}),
                noteboard: {
                  ...(next.nodeDataById[resize.nodeId]?.noteboard ?? { cards: [] }),
                  cards,
                  view: { ...view },
                },
              },
            },
          };
        });
        event.preventDefault();
        return;
      }

      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setState((prev) => {
        const next = ensureNoteboardData(prev, drag.nodeId);
        const view = getViewForNode(next, drag.nodeId);
        const pointer = getWorldPoint(canvas, view, event.clientX, event.clientY);
        let deltaX = pointer.x - drag.pointerStartX;
        let deltaY = pointer.y - drag.pointerStartY;

        const starts = Object.values(drag.startPositions);
        const minStartX = Math.min(...starts.map((p) => p.x));
        const maxStartX = Math.max(
          ...Object.entries(drag.startPositions).map(([cardId, p]) => {
            const card = getCardsForNode(next, drag.nodeId).find((item) => item.id === cardId);
            const width = card?.width ?? CARD_WIDTH;
            return p.x + width;
          }),
        );
        const minStartY = Math.min(...starts.map((p) => p.y));
        const maxStartY = Math.max(
          ...Object.entries(drag.startPositions).map(([cardId, p]) => {
            const card = getCardsForNode(next, drag.nodeId).find((item) => item.id === cardId);
            const height = card?.height ?? CARD_MIN_HEIGHT;
            return p.y + height;
          }),
        );
        const minAllowedDeltaX = NOTEBOARD_WORLD_MIN_X + CANVAS_PADDING - minStartX;
        const maxAllowedDeltaX = NOTEBOARD_WORLD_MAX_X - CANVAS_PADDING - maxStartX;
        const minAllowedDeltaY = NOTEBOARD_WORLD_MIN_Y + CANVAS_PADDING - minStartY;
        const maxAllowedDeltaY = NOTEBOARD_WORLD_MAX_Y - CANVAS_PADDING - maxStartY;

        deltaX = Math.min(maxAllowedDeltaX, Math.max(minAllowedDeltaX, deltaX));
        deltaY = Math.min(maxAllowedDeltaY, Math.max(minAllowedDeltaY, deltaY));

        const cards = getCardsForNode(next, drag.nodeId).map((card) => {
          const start = drag.startPositions[card.id];
          if (!start) {
            return card;
          }
          return {
            ...card,
            x: start.x + deltaX,
            y: start.y + deltaY,
          };
        });

        return {
          ...next,
          nodeDataById: {
            ...next.nodeDataById,
            [drag.nodeId]: {
              ...(next.nodeDataById[drag.nodeId] ?? {}),
              noteboard: {
                ...(next.nodeDataById[drag.nodeId]?.noteboard ?? { cards: [] }),
                cards,
                view: { ...view },
              },
            },
          },
        };
      });
    };

    const onPointerUp = (event: PointerEvent): void => {
      const selectionBox = uiStateRef.current.selectionBox;
      if (selectionBox && event.pointerId === selectionBox.pointerId) {
        setUiState((prev) => ({
          ...prev,
          selectionBox: null,
        }));
        return;
      }

      if (dragRef.current && event.pointerId === dragRef.current.pointerId) {
        dragRef.current = null;
        document.body.classList.remove('is-dragging-card');
      }

      if (resizeRef.current && event.pointerId === resizeRef.current.pointerId) {
        resizeRef.current = null;
        document.body.classList.remove('is-resizing-card');
      }

      if (panRef.current && event.pointerId === panRef.current.pointerId) {
        panRef.current = null;
        document.body.classList.remove('is-panning-canvas');
      }

      if (drawRef.current && event.pointerId === drawRef.current.pointerId) {
        flushQueuedDrawPoints();
        drawRef.current = null;
        drawPointQueueRef.current = [];
        if (drawRafRef.current !== null) {
          window.cancelAnimationFrame(drawRafRef.current);
          drawRafRef.current = null;
        }
        document.body.classList.remove('is-drawing-canvas');
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      drawRef.current = null;
      resizeRef.current = null;
      drawPointQueueRef.current = [];
      if (drawRafRef.current !== null) {
        window.cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
      document.body.classList.remove('is-resizing-card');
      document.body.classList.remove('is-drawing-canvas');
    };
  }, [flushQueuedDrawPoints]);

  const getCanvasCenterWorldPoint = React.useCallback(
    (nodeId: string): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }
      const view = getViewForNode(stateRef.current, nodeId);
      return {
        x: (canvas.clientWidth / 2 - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X,
        y: (canvas.clientHeight / 2 - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y,
      };
    },
    [],
  );

  const readClipboardText = React.useCallback(async (): Promise<string | null> => {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      const normalized = normalizeClipboardText(text);
      return normalized || null;
    } catch {
      return null;
    }
  }, []);

  const readClipboardImage = React.useCallback(async (): Promise<Blob | null> => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      return null;
    }

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.toLowerCase().startsWith('image/'));
        if (!imageType) {
          continue;
        }
        return await item.getType(imageType);
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const extractImageBlobFromClipboardData = React.useCallback(
    (clipboardData: DataTransfer | null): Blob | null => {
      if (!clipboardData) {
        return null;
      }

      for (const item of Array.from(clipboardData.items)) {
        if (item.kind !== 'file' || !item.type.toLowerCase().startsWith('image/')) {
          continue;
        }
        const file = item.getAsFile();
        if (file) {
          return file;
        }
      }

      return null;
    },
    [],
  );

  const fetchImageBlobFromUrl = React.useCallback(async (url: string): Promise<Blob | null> => {
    const source = url.trim();
    if (!source || !/^(https?:\/\/|data:image\/)/i.test(source)) {
      return null;
    }

    try {
      const response = await fetch(source, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      });
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.startsWith('image/')) {
        return null;
      }
      return await response.blob();
    } catch {
      return null;
    }
  }, []);

  const extractImageBlobFromDroppedPayload = React.useCallback(
    async (payload: DroppedCanvasPayload): Promise<Blob | null> => {
      const droppedFile = payload.files.find((file) => file.type.toLowerCase().startsWith('image/'));
      if (droppedFile) {
        return droppedFile;
      }

      const imageUrlCandidate =
        firstImageUrlFromHtml(payload.textHtml) ??
        firstUrlFromUriList(payload.textUriList) ??
        firstUrlFromText(payload.textPlain);

      if (!imageUrlCandidate) {
        return null;
      }

      return fetchImageBlobFromUrl(imageUrlCandidate);
    },
    [fetchImageBlobFromUrl],
  );

  const createTextCardAtWorldPoint = React.useCallback(
    (
      nodeId: string,
      worldX: number,
      worldY: number,
      text: string,
      options?: {
        preferredSize?: { width: number; height: number };
      },
    ): boolean => {
      const normalized = normalizeClipboardText(text);
      if (!normalized) {
        return false;
      }

      const size = estimateCardDimensionsFromText(normalized);
      if (options?.preferredSize) {
        size.width = Math.max(
          CARD_MIN_WIDTH,
          Math.min(CARD_MAX_WIDTH, Math.round(options.preferredSize.width)),
        );
        size.height = Math.max(
          CARD_MIN_HEIGHT,
          Math.min(CARD_MAX_HEIGHT, Math.round(options.preferredSize.height)),
        );
      }
      if (buildLinkPreviews(normalized, 1).length > 0) {
        size.width = Math.max(size.width, 300);
        size.height = Math.max(size.height, 240);
      }
      const pos = clampCardToWorld(
        worldX - size.width / 2,
        worldY - Math.min(40, size.height / 2),
        size.width,
        size.height,
      );
      const created = createNoteboardCard(pos.x, pos.y);
      created.text = normalized;
      created.width = size.width;
      created.height = size.height;
      created.color = getThemeCardColor(settingsRef.current.theme);

      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [created, ...getCardsForNode(next, nodeId)];
        return {
          ...next,
          nodeDataById: {
            ...next.nodeDataById,
            [nodeId]: {
              ...(next.nodeDataById[nodeId] ?? {}),
              noteboard: {
                ...(next.nodeDataById[nodeId]?.noteboard ?? { cards: [] }),
                cards,
                view: { ...getViewForNode(next, nodeId) },
              },
            },
          },
        };
      });

      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
        selectionBox: null,
        cardSelection: {
          nodeId,
          cardIds: [created.id],
        },
      }));

      return true;
    },
    [pushHistory],
  );

  const createImageCardAtWorldPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number, blob: Blob): Promise<boolean> => {
      if (!window.testoApi?.saveImageAsset) {
        return false;
      }

      const buffer = new Uint8Array(await blob.arrayBuffer());
      if (buffer.length === 0) {
        return false;
      }

      const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      let saved;
      try {
        saved = await window.testoApi.saveImageAsset({
          bytes: buffer,
          mimeType,
        });
      } catch {
        return false;
      }
      void refreshImageAssets();

      let imageSize: { width: number; height: number } | undefined;
      try {
        const bitmap = await createImageBitmap(blob);
        imageSize = fitImageDimensionsToCardBounds(bitmap.width, bitmap.height);
        bitmap.close();
      } catch {
        imageSize = undefined;
      }

      const markdown = `![Pasted image](${saved.assetUrl})\n\n[Open image file](${saved.assetUrl})`;
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, markdown, {
        preferredSize: imageSize,
      });
    },
    [createTextCardAtWorldPoint, refreshImageAssets],
  );

  const createImageCardFromAssetUrlAtWorldPoint = React.useCallback(
    (
      nodeId: string,
      worldX: number,
      worldY: number,
      assetUrl: string,
      dimensions?: { width?: number; height?: number },
    ): boolean => {
      const safeAssetUrl = assetUrl.trim();
      if (!safeAssetUrl) {
        return false;
      }

      const preferredSize =
        typeof dimensions?.width === 'number' &&
        typeof dimensions?.height === 'number' &&
        dimensions.width > 0 &&
        dimensions.height > 0
          ? fitImageDimensionsToCardBounds(dimensions.width, dimensions.height)
          : undefined;
      const markdown = `![Pasted image](${safeAssetUrl})\n\n[Open image file](${safeAssetUrl})`;
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, markdown, {
        preferredSize,
      });
    },
    [createTextCardAtWorldPoint],
  );

  const pasteCopiedCardsAtCanvasCenter = React.useCallback(
    (nodeId: string): boolean => {
      if (clipboardRef.current?.kind !== 'noteboard-cards') {
        return false;
      }

      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [...getCardsForNode(next, nodeId)];
        const view = getViewForNode(next, nodeId);
        const canvas = canvasRef.current;
        let anchorX = 0;
        let anchorY = 0;

        if (canvas) {
          anchorX = (canvas.clientWidth / 2 - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
          anchorY = (canvas.clientHeight / 2 - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;
        }

        const newIds: string[] = [];
        clipboardRef.current?.cards.forEach((item) => {
          const pos = clampCardToWorld(anchorX + item.dx, anchorY + item.dy, item.width, item.height);
          const created = createNoteboardCard(pos.x, pos.y);
          created.text = item.text;
          created.color = item.color;
          created.width = item.width;
          created.height = item.height;
          cards.unshift(created);
          newIds.push(created.id);
        });

        setUiState((prevUi) => ({
          ...prevUi,
          cardSelection: {
            nodeId,
            cardIds: newIds,
          },
        }));

        return {
          ...next,
          nodeDataById: {
            ...next.nodeDataById,
            [nodeId]: {
              ...(next.nodeDataById[nodeId] ?? {}),
              noteboard: {
                ...(next.nodeDataById[nodeId]?.noteboard ?? { cards: [] }),
                cards,
                view: { ...view },
              },
            },
          },
        };
      });

      return true;
    },
    [pushHistory],
  );

  const pasteClipboardTextAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      const text = await readClipboardText();
      if (!text) {
        return false;
      }
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, text);
    },
    [createTextCardAtWorldPoint, readClipboardText],
  );

  const pasteClipboardImageAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      const image = await readClipboardImage();
      if (!image) {
        return false;
      }
      return createImageCardAtWorldPoint(nodeId, worldX, worldY, image);
    },
    [createImageCardAtWorldPoint, readClipboardImage],
  );

  const pasteSystemClipboardAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      if (await pasteClipboardImageAtPoint(nodeId, worldX, worldY)) {
        return true;
      }
      return pasteClipboardTextAtPoint(nodeId, worldX, worldY);
    },
    [pasteClipboardImageAtPoint, pasteClipboardTextAtPoint],
  );

  const handleCanvasDrop = React.useCallback(
    async (
      nodeId: string,
      worldX: number,
      worldY: number,
      payload: DroppedCanvasPayload,
    ): Promise<void> => {
      const droppedAsset = parseDroppedTestoImageAsset(payload.testoImageAsset);
      if (droppedAsset) {
        createImageCardFromAssetUrlAtWorldPoint(nodeId, worldX, worldY, droppedAsset.assetUrl, {
          width: droppedAsset.width,
          height: droppedAsset.height,
        });
        return;
      }

      const droppedImage = await extractImageBlobFromDroppedPayload(payload);
      if (droppedImage) {
        await createImageCardAtWorldPoint(nodeId, worldX, worldY, droppedImage);
        return;
      }

      const fallbackText = normalizeClipboardText(
        payload.textPlain || payload.textUriList || payload.textHtml,
      );
      if (fallbackText) {
        createTextCardAtWorldPoint(nodeId, worldX, worldY, fallbackText);
      }
    },
    [
      createImageCardAtWorldPoint,
      createImageCardFromAssetUrlAtWorldPoint,
      createTextCardAtWorldPoint,
      extractImageBlobFromDroppedPayload,
    ],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isTextEntryTarget = isTextEntryTargetElement(event.target);
      const activeNode = findNodeById(stateRef.current.nodes, stateRef.current.selectedNodeId);

      if (event.key === 'Tab' && !isTextEntryTarget) {
        if (activeNode?.editorType === 'noteboard') {
          drawRef.current = null;
          drawPointQueueRef.current = [];
          if (drawRafRef.current !== null) {
            window.cancelAnimationFrame(drawRafRef.current);
            drawRafRef.current = null;
          }
          document.body.classList.remove('is-drawing-canvas');
          setUiState((prev) => ({
            ...prev,
            isDrawingMode: !prev.isDrawingMode,
            contextMenu: null,
            selectionBox: null,
          }));
          event.preventDefault();
        }
        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      if (mod && !isTextEntryTarget) {
        const key = event.key.toLowerCase();
        if (key === 'z') {
          if (event.shiftKey) {
            redoHistory();
          } else {
            undoHistory();
          }
          event.preventDefault();
          return;
        }

        if (key === 'y') {
          redoHistory();
          event.preventDefault();
          return;
        }
      }

      if (!activeNode || activeNode.editorType !== 'noteboard') {
        return;
      }

      const selectedIds =
        uiStateRef.current.cardSelection.nodeId === activeNode.id
          ? uiStateRef.current.cardSelection.cardIds
          : [];

      if (event.key === 'Delete' && !isTextEntryTarget && selectedIds.length > 0) {
        pushHistory();
        setState((prev) => {
          const next = ensureNoteboardData(prev, activeNode.id);
          const cards = getCardsForNode(next, activeNode.id).filter(
            (card) => !selectedIds.includes(card.id),
          );
          return {
            ...next,
            nodeDataById: {
              ...next.nodeDataById,
              [activeNode.id]: {
                ...(next.nodeDataById[activeNode.id] ?? {}),
                noteboard: {
                  ...(next.nodeDataById[activeNode.id]?.noteboard ?? { cards: [] }),
                  cards,
                  view: { ...getViewForNode(next, activeNode.id) },
                },
              },
            },
          };
        });
        setUiState((prev) => ({
          ...prev,
          cardSelection: {
            nodeId: null,
            cardIds: [],
          },
        }));
        event.preventDefault();
        return;
      }

      if (!mod || isTextEntryTarget) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c' && selectedIds.length > 0) {
        const cards = getCardsForNode(stateRef.current, activeNode.id).filter((card) =>
          selectedIds.includes(card.id),
        );
        if (cards.length > 0) {
          const anchorX = Math.min(...cards.map((card) => card.x));
          const anchorY = Math.min(...cards.map((card) => card.y));
          clipboardRef.current = {
            kind: 'noteboard-cards',
            cards: cards.map((card) => ({
              text: card.text,
              color: card.color,
              dx: card.x - anchorX,
              dy: card.y - anchorY,
              width: card.width,
              height: card.height,
            })),
          };
        }
        event.preventDefault();
        return;
      }

    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pushHistory, redoHistory, undoHistory]);

  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      const activeNode = findNodeById(stateRef.current.nodes, stateRef.current.selectedNodeId);
      if (!activeNode || activeNode.editorType !== 'noteboard') {
        return;
      }

      if (isTextEntryTargetElement(event.target)) {
        return;
      }

      const center = getCanvasCenterWorldPoint(activeNode.id);
      if (!center) {
        return;
      }

      const imageBlob = extractImageBlobFromClipboardData(event.clipboardData);
      if (imageBlob) {
        event.preventDefault();
        void createImageCardAtWorldPoint(activeNode.id, center.x, center.y, imageBlob);
        return;
      }

      const clipboardText = normalizeClipboardText(event.clipboardData?.getData('text/plain') ?? '');
      if (clipboardText) {
        event.preventDefault();
        createTextCardAtWorldPoint(activeNode.id, center.x, center.y, clipboardText);
        return;
      }

      if (clipboardRef.current?.kind === 'noteboard-cards') {
        event.preventDefault();
        pasteCopiedCardsAtCanvasCenter(activeNode.id);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [
    createImageCardAtWorldPoint,
    createTextCardAtWorldPoint,
    extractImageBlobFromClipboardData,
    getCanvasCenterWorldPoint,
    pasteCopiedCardsAtCanvasCenter,
  ]);

  React.useEffect(() => {
    const onGlobalPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (uiStateRef.current.contextMenu && !target.closest('.canvas-context-menu')) {
        setUiState((prev) => ({
          ...prev,
          contextMenu: null,
        }));
      }
    };

    window.addEventListener('pointerdown', onGlobalPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onGlobalPointerDown, true);
    };
  }, []);

  const selectedNode = React.useMemo(
    () => findNodeById(state.nodes, state.selectedNodeId),
    [state.nodes, state.selectedNodeId],
  );

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'noteboard') {
      return;
    }

    setState((prev) => ensureNoteboardData(prev, selectedNode.id));
  }, [selectedNode]);

  const pendingDeleteNode = React.useMemo(
    () => findNodeById(state.nodes, uiState.pendingDeleteNodeId),
    [state.nodes, uiState.pendingDeleteNodeId],
  );
  const deleteDescendantCount = pendingDeleteNode ? countDescendants(pendingDeleteNode) : 0;
  const createTargetLabel =
    uiState.pendingCreateParentRef === 'root'
      ? 'Create root node'
      : uiState.pendingCreateParentRef
        ? `Create child node under ${findNodeById(state.nodes, uiState.pendingCreateParentRef)?.name ?? 'selected parent'}`
        : '';

  const selectedCards =
    selectedNode && selectedNode.editorType === 'noteboard'
      ? getCardsForNode(state, selectedNode.id)
      : [];
  const selectedStrokes =
    selectedNode && selectedNode.editorType === 'noteboard'
      ? getStrokesForNode(state, selectedNode.id)
      : [];
  const selectedView =
    selectedNode && selectedNode.editorType === 'noteboard'
      ? getViewForNode(state, selectedNode.id)
      : {
          zoom: 1,
          offsetX: NOTEBOARD_WORLD_MIN_X + 180,
          offsetY: NOTEBOARD_WORLD_MIN_Y + 120,
        };
  const selectedCardIds =
    selectedNode && selectedNode.editorType === 'noteboard'
      ? uiState.cardSelection.nodeId === selectedNode.id
        ? uiState.cardSelection.cardIds
        : []
      : [];
  const selectedDocumentMarkdown =
    selectedNode && selectedNode.editorType !== 'noteboard'
      ? getDocumentMarkdownForNode(state, selectedNode.id)
      : '';
  const selectionRect =
    uiState.selectionBox &&
    selectedNode &&
    selectedNode.editorType === 'noteboard' &&
    uiState.selectionBox.nodeId === selectedNode.id
      ? {
          left: Math.min(uiState.selectionBox.startX, uiState.selectionBox.currentX) - NOTEBOARD_WORLD_MIN_X,
          top: Math.min(uiState.selectionBox.startY, uiState.selectionBox.currentY) - NOTEBOARD_WORLD_MIN_Y,
          width: Math.abs(uiState.selectionBox.currentX - uiState.selectionBox.startX),
          height: Math.abs(uiState.selectionBox.currentY - uiState.selectionBox.startY),
        }
      : null;

  const availableCardTemplates = React.useMemo(
    () => [
      ...CARD_TEMPLATES.map((template) => ({
        id: template.id,
        label: template.label,
        markdown: template.markdown,
        isCustom: false,
      })),
      ...sanitizeCardTemplates(settings.cardTemplates).map((template) => ({
        id: template.id,
        label: template.name,
        markdown: template.markdown,
        isCustom: true,
      })),
    ],
    [settings.cardTemplates],
  );
  const themeCardColor = getThemeCardColor(settings.theme);
  const cardColorPresets = React.useMemo(
    () => [themeCardColor, ...CARD_COLOR_PRESETS.filter((color) => color !== themeCardColor)],
    [themeCardColor],
  );

  const stopDrawingSession = React.useCallback((): void => {
    drawRef.current = null;
    drawPointQueueRef.current = [];
    if (drawRafRef.current !== null) {
      window.cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
    document.body.classList.remove('is-drawing-canvas');
  }, []);

  const toggleDrawingMode = React.useCallback((): void => {
    stopDrawingSession();
    setUiState((prev) => ({
      ...prev,
      isDrawingMode: !prev.isDrawingMode,
      contextMenu: null,
      selectionBox: null,
    }));
  }, [stopDrawingSession]);

  const closeDrawingMode = React.useCallback((): void => {
    stopDrawingSession();
    setUiState((prev) => ({
      ...prev,
      isDrawingMode: false,
      contextMenu: null,
      selectionBox: null,
    }));
  }, [stopDrawingSession]);

  const onSelectNode = (nodeId: string): void => {
    if (uiState.editingNodeId) {
      return;
    }

    const node = findNodeById(state.nodes, nodeId);
    if (!node) {
      return;
    }

    setState((prev) => ({
      ...prev,
      selectedNodeId: node.id,
    }));
    setUiState((prev) => ({
      ...prev,
      cardSelection: {
        nodeId: null,
        cardIds: [],
      },
      contextMenu: null,
      selectionBox: null,
    }));
  };

  const onBeginRename = (nodeId: string): void => {
    const node = findNodeById(state.nodes, nodeId);
    if (!node) {
      return;
    }

    setUiState((prev) => ({
      ...prev,
      editingNodeId: node.id,
      editingNameDraft: node.name,
    }));
  };

  const onRenameCommit = (): void => {
    if (!uiState.editingNodeId) {
      return;
    }

    const nextName = uiState.editingNameDraft.trim();
    if (!nextName) {
      setUiState((prev) => ({
        ...prev,
        editingNodeId: null,
        editingNameDraft: '',
      }));
      return;
    }

    setState((prev) => {
      const node = findNodeById(prev.nodes, uiState.editingNodeId);
      if (!node) {
        return prev;
      }

      if (node.name !== nextName) {
        pushHistory();
      }
      node.name = nextName;
      return { ...prev, nodes: [...prev.nodes] };
    });

    setUiState((prev) => ({
      ...prev,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  };

  const onRenameCancel = (): void => {
    setUiState((prev) => ({
      ...prev,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  };

  const onSelectCreateType = (type: EditorType): void => {
    pushHistory();
    setState((prev) => {
      const nextNode = createNode(`Untitled Node ${prev.nextNodeNumber}`, type);
      const nextNodes = [...prev.nodes];
      const nextNodeData = { ...prev.nodeDataById, [nextNode.id]: {} };
      const parentRef = uiState.pendingCreateParentRef;

      if (parentRef === 'root') {
        nextNodes.push(nextNode);
      } else {
        const parent = findNodeById(nextNodes, parentRef);
        if (!parent) {
          return prev;
        }
        parent.children.push(nextNode);
      }

      return {
        ...prev,
        nodes: nextNodes,
        selectedNodeId: nextNode.id,
        nextNodeNumber: prev.nextNodeNumber + 1,
        nodeDataById: nextNodeData,
      };
    });

    setUiState((prev) => ({
      ...prev,
      pendingCreateParentRef: null,
    }));
  };

  const onConfirmDelete = (): void => {
    if (!uiState.pendingDeleteNodeId) {
      return;
    }

    const nodeBeforeDelete = findNodeById(state.nodes, uiState.pendingDeleteNodeId);
    if (nodeBeforeDelete) {
      pushHistory();
    }
    setState((prev) => {
      const nodeBeforeDelete = findNodeById(prev.nodes, uiState.pendingDeleteNodeId);
      if (!nodeBeforeDelete) {
        return prev;
      }

      const subtreeIds = collectSubtreeIds(nodeBeforeDelete);
      const nextNodes = [...prev.nodes];
      const wasRemoved = removeNodeById(nextNodes, uiState.pendingDeleteNodeId);
      if (!wasRemoved) {
        return prev;
      }

      const nextNodeData = { ...prev.nodeDataById };
      subtreeIds.forEach((nodeId) => {
        delete nextNodeData[nodeId];
      });

      const nextSelectedNodeId =
        prev.selectedNodeId === uiState.pendingDeleteNodeId ||
        !findNodeById(nextNodes, prev.selectedNodeId)
          ? findFirstNodeId(nextNodes)
          : prev.selectedNodeId;

      return {
        ...prev,
        nodes: nextNodes,
        selectedNodeId: nextSelectedNodeId,
        nodeDataById: nextNodeData,
      };
    });

    setUiState((prev) => ({
      ...prev,
      pendingDeleteNodeId: null,
      editingNodeId: null,
      editingNameDraft: '',
    }));
  };

  const onSaveSettings = (): void => {
    const parsed = Number(uiState.settingsDraftSidebarWidth);
    const nextSidebarWidth = Number.isFinite(parsed)
      ? clampSidebarWidth(parsed)
      : settings.sidebarWidth;
    const nextTheme = isAppTheme(uiState.settingsDraftTheme)
      ? uiState.settingsDraftTheme
      : settings.theme;

    setSettings((prev) => ({
      ...prev,
      sidebarWidth: nextSidebarWidth,
      theme: nextTheme,
    }));
    setUiState((prev) => ({
      ...prev,
      isSettingsDialogOpen: false,
      settingsDraftSidebarWidth: String(nextSidebarWidth),
      settingsDraftTheme: nextTheme,
    }));
  };

  return (
    <div
      ref={shellRef}
      className="app-shell"
      style={{ '--sidebar-width': `${settings.sidebarWidth}px` } as React.CSSProperties}
    >
      <aside className="sidebar">
        <h1 className="brand">TestoDesignSuite</h1>

        <section className="tree-section">
          <div className="section-header">
            <h2 className="section-title">Structure</h2>
            <button
              onClick={() =>
                setUiState((prev) => ({
                  ...prev,
                  pendingCreateParentRef: 'root',
                }))
              }
            >
              + Root Node
            </button>
          </div>
          <div className="tree-scroll">
            <ul className="tree-list">
              <NodeTree
                nodes={state.nodes}
                viewState={{
                  selectedNodeId: state.selectedNodeId,
                  editingNodeId: uiState.editingNodeId,
                  editingNameDraft: uiState.editingNameDraft,
                }}
                onSelectNode={onSelectNode}
                onBeginRename={onBeginRename}
                onRenameDraftChange={(value) =>
                  setUiState((prev) => ({
                    ...prev,
                    editingNameDraft: value,
                  }))
                }
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
                onAddChildNode={(nodeId) =>
                  setUiState((prev) => ({
                    ...prev,
                    pendingCreateParentRef: nodeId,
                  }))
                }
                onRequestDeleteNode={(nodeId) =>
                  setUiState((prev) => ({
                    ...prev,
                    pendingDeleteNodeId: nodeId,
                  }))
                }
              />
            </ul>
          </div>
        </section>
      </aside>
      <div
        className="sidebar-resizer"
        title="Resize sidebar"
        aria-label="Resize sidebar"
        onPointerDown={onBeginResize}
      ></div>

      <main className="main-panel">
        {selectedNode && selectedNode.editorType === 'noteboard' ? (
          <NoteboardCanvas
            nodeId={selectedNode.id}
            cards={selectedCards}
            strokes={selectedStrokes}
            view={selectedView}
            isDrawingMode={uiState.isDrawingMode}
            drawingTool={settings.drawingTool ?? defaultSettings.drawingTool ?? 'brush'}
            drawingBrush={settings.drawingBrush ?? defaultSettings.drawingBrush ?? 'ink'}
            drawingSize={settings.drawingSize ?? defaultSettings.drawingSize ?? 10}
            drawingOpacity={settings.drawingOpacity ?? defaultSettings.drawingOpacity ?? 0.85}
            drawingColor={settings.drawingColor ?? defaultSettings.drawingColor ?? '#1e1f24'}
            drawingPresetColors={sanitizeDrawingPresetColors(settings.drawingPresetColors)}
            cardColorPresets={cardColorPresets}
            selectedCardIds={selectedCardIds}
            selectionRect={selectionRect}
            contextMenu={
              uiState.contextMenu && uiState.contextMenu.nodeId === selectedNode.id
                ? {
                    screenX: uiState.contextMenu.screenX,
                    screenY: uiState.contextMenu.screenY,
                  }
                : null
            }
            canvasRef={canvasRef}
            onCanvasPointerDown={(event) => {
              const target = event.target;
              if (!(target instanceof Element)) {
                return;
              }

              if (uiState.contextMenu && !target.closest('.canvas-context-menu')) {
                setUiState((prev) => ({
                  ...prev,
                  contextMenu: null,
                }));
              }

              if (event.button === 1) {
                panRef.current = {
                  pointerId: event.pointerId,
                  nodeId: selectedNode.id,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startOffsetX: selectedView.offsetX,
                  startOffsetY: selectedView.offsetY,
                };
                document.body.classList.add('is-panning-canvas');
                event.preventDefault();
                return;
              }

              if (
                uiState.isDrawingMode &&
                event.button === 0 &&
                target.closest('.noteboard-canvas') &&
                !target.closest(
                  '.noteboard-card, .noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .color-quick-menu',
                )
              ) {
                const canvas = canvasRef.current;
                if (!canvas) {
                  return;
                }

                const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
                pushHistory();

                const currentTool = settings.drawingTool ?? defaultSettings.drawingTool ?? 'brush';
                const activeTool =
                  event.shiftKey && currentTool !== 'eraser' ? 'eraser' : currentTool;
                if (activeTool === 'eraser') {
                  const eraserRadiusPx = Math.max(
                    6,
                    settings.drawingSize ?? defaultSettings.drawingSize ?? 10,
                  );
                  setState((prev) =>
                    eraseStrokesAtPoint(
                      prev,
                      selectedNode.id,
                      world.x,
                      world.y,
                      eraserRadiusPx,
                      selectedView.zoom,
                    ),
                  );
                  drawRef.current = {
                    pointerId: event.pointerId,
                    nodeId: selectedNode.id,
                    tool: 'eraser',
                    strokeId: null,
                  };
                  document.body.classList.add('is-drawing-canvas');
                } else {
                  const color =
                    (settings.drawingColor ?? defaultSettings.drawingColor ?? '#1e1f24').trim() ||
                    getBrushColor();
                  const size = Math.max(
                    2,
                    Math.min(
                      MAX_DRAW_SIZE,
                      settings.drawingSize ?? defaultSettings.drawingSize ?? 10,
                    ),
                  );
                  const opacity = Math.max(
                    0.05,
                    Math.min(1, settings.drawingOpacity ?? defaultSettings.drawingOpacity ?? 0.85),
                  );
                  const activeBrush: NoteboardBrushType =
                    currentTool === 'pen'
                      ? 'pen'
                      : (settings.drawingBrush ?? defaultSettings.drawingBrush ?? 'ink') === 'pen'
                        ? 'ink'
                        : settings.drawingBrush ?? defaultSettings.drawingBrush ?? 'ink';

                  setState((prev) => {
                    const next = ensureNoteboardData(prev, selectedNode.id);
                    const view = getViewForNode(next, selectedNode.id);
                    const stroke = createBrushStroke(
                      world.x,
                      world.y,
                      activeBrush,
                      color,
                      size,
                      opacity,
                    );
                    const strokes = [...getStrokesForNode(next, selectedNode.id), stroke];

                    drawRef.current = {
                      pointerId: event.pointerId,
                      nodeId: selectedNode.id,
                      tool: activeTool,
                      strokeId: stroke.id,
                    };
                    document.body.classList.add('is-drawing-canvas');

                    return {
                      ...next,
                      nodeDataById: {
                        ...next.nodeDataById,
                        [selectedNode.id]: {
                          ...(next.nodeDataById[selectedNode.id] ?? {}),
                          noteboard: {
                            ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                            cards: [...getCardsForNode(next, selectedNode.id)],
                            strokes,
                            view: { ...view },
                          },
                        },
                      },
                    };
                  });
                }

                setUiState((prev) => ({
                  ...prev,
                  contextMenu: null,
                  selectionBox: null,
                  cardSelection: {
                    nodeId: selectedNode.id,
                    cardIds: [],
                  },
                }));
                event.preventDefault();
                return;
              }

              if (
                event.button === 0 &&
                target.closest('.noteboard-canvas') &&
                !target.closest(
                  '.noteboard-card, .noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .color-quick-menu',
                )
              ) {
                if (uiState.isDrawingMode) {
                  return;
                }
                const canvas = canvasRef.current;
                if (!canvas) {
                  return;
                }

                const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
                setUiState((prev) => ({
                  ...prev,
                  contextMenu: null,
                  cardSelection: {
                    nodeId: selectedNode.id,
                    cardIds: [],
                  },
                  selectionBox: {
                    nodeId: selectedNode.id,
                    pointerId: event.pointerId,
                    startX: world.x,
                    startY: world.y,
                    currentX: world.x,
                    currentY: world.y,
                    additive: event.ctrlKey || event.metaKey,
                    baseSelectedCardIds:
                      prev.cardSelection.nodeId === selectedNode.id
                        ? prev.cardSelection.cardIds
                        : [],
                  },
                }));
                event.preventDefault();
              }
            }}
            onCanvasWheel={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest('.card-textarea')) {
                return;
              }

              if (uiState.isDrawingMode && event.shiftKey) {
                const direction = event.deltaY < 0 ? 1 : -1;
                const wheelSteps = Math.max(1, Math.round(Math.abs(event.deltaY) / 100));
                const sizeDelta = direction * wheelSteps * 3;
                setSettings((prev) => ({
                  ...prev,
                  drawingSize: Math.max(
                    2,
                    Math.min(
                      MAX_DRAW_SIZE,
                      (prev.drawingSize ?? defaultSettings.drawingSize ?? 10) + sizeDelta,
                    ),
                  ),
                }));
                event.preventDefault();
                return;
              }

              const canvas = canvasRef.current;
              if (!canvas) {
                return;
              }

              const view = selectedView;
              const minZoom = getMinZoomForCanvas(canvas);
              const zoomDelta = event.deltaY < 0 ? 1.12 : 0.88;
              const nextZoom = Math.min(MAX_ZOOM, Math.max(minZoom, view.zoom * zoomDelta));
              if (nextZoom === view.zoom) {
                return;
              }

              const rect = canvas.getBoundingClientRect();
              const worldElement =
                (canvas.querySelector(':scope > .noteboard-world') as HTMLElement | null) ||
                (canvas.querySelector('.noteboard-world') as HTMLElement | null);
              const layoutOffsetX = worldElement?.offsetLeft ?? 0;
              const layoutOffsetY = worldElement?.offsetTop ?? 0;
              const pointerX = event.clientX - rect.left - layoutOffsetX;
              const pointerY = event.clientY - rect.top - layoutOffsetY;
              const worldX = (pointerX - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
              const worldY = (pointerY - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;

              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const nextView = { ...getViewForNode(next, selectedNode.id) };
                nextView.zoom = nextZoom;
                nextView.offsetX = pointerX - (worldX - NOTEBOARD_WORLD_MIN_X) * nextZoom;
                nextView.offsetY = pointerY - (worldY - NOTEBOARD_WORLD_MIN_Y) * nextZoom;
                clampViewOffsets(canvas, nextView);
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards: [...getCardsForNode(next, selectedNode.id)],
                        view: nextView,
                      },
                    },
                  },
                };
              });

              event.preventDefault();
            }}
            onCanvasContextMenu={(event) => {
              if (uiState.isDrawingMode) {
                event.preventDefault();
                return;
              }

              const target = event.target;
              if (!(target instanceof Element)) {
                return;
              }
              if (target.closest('.card-textarea, .noteboard-card, .noteboard-template-sidebar')) {
                return;
              }

              const canvas = canvasRef.current;
              if (!canvas) {
                return;
              }

              const rect = canvas.getBoundingClientRect();
              const worldX =
                (event.clientX - rect.left - selectedView.offsetX) / selectedView.zoom +
                NOTEBOARD_WORLD_MIN_X;
              const worldY =
                (event.clientY - rect.top - selectedView.offsetY) / selectedView.zoom +
                NOTEBOARD_WORLD_MIN_Y;
              const screenX = Math.min(
                window.innerWidth - CONTEXT_MENU_WIDTH - 8,
                Math.max(8, event.clientX),
              );
              const screenY = Math.min(
                window.innerHeight - CONTEXT_MENU_HEIGHT - 8,
                Math.max(8, event.clientY),
              );

              setUiState((prev) => ({
                ...prev,
                contextMenu: {
                  nodeId: selectedNode.id,
                  screenX,
                  screenY,
                  worldX,
                  worldY,
                },
              }));
              event.preventDefault();
            }}
            onCanvasDrop={(event) => {
              if (uiState.isDrawingMode) {
                return;
              }

              event.preventDefault();
              const canvas = canvasRef.current;
              if (!canvas) {
                return;
              }

              const payload: DroppedCanvasPayload = {
                files: Array.from(event.dataTransfer.files),
                textPlain: event.dataTransfer.getData('text/plain') ?? '',
                textUriList: event.dataTransfer.getData('text/uri-list') ?? '',
                textHtml: event.dataTransfer.getData('text/html') ?? '',
                testoImageAsset:
                  event.dataTransfer.getData('application/x-testo-image-asset') ?? '',
              };

              const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
              void handleCanvasDrop(selectedNode.id, world.x, world.y, payload);
            }}
            cardTemplates={availableCardTemplates.map((template) => ({
              id: template.id,
              label: template.label,
              isCustom: template.isCustom,
            }))}
            imageAssets={imageAssets}
            onAddCardFromTemplateAt={(templateId, clientX, clientY) => {
              const template = availableCardTemplates.find((item) => item.id === templateId);
              const canvas = canvasRef.current;
              if (!canvas) {
                return;
              }
              const view = selectedView;
              const world = getWorldPoint(canvas, view, clientX, clientY);
              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [...getCardsForNode(next, selectedNode.id)];
                const pos = clampCardToWorld(
                  world.x - CARD_WIDTH / 2,
                  world.y - CARD_MIN_HEIGHT / 2,
                );
                const card = createNoteboardCard(pos.x, pos.y);
                card.color = themeCardColor;
                card.text = template?.markdown ?? '';
                const templateSize = estimateCardDimensionsFromText(card.text);
                card.width = templateSize.width;
                card.height = templateSize.height;
                const clamped = clampCardToWorld(card.x, card.y, card.width, card.height);
                card.x = clamped.x;
                card.y = clamped.y;
                cards.unshift(card);

                setUiState((prevUi) => ({
                  ...prevUi,
                  cardSelection: {
                    nodeId: selectedNode.id,
                    cardIds: [card.id],
                  },
                }));

                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });
            }}
            onRenameCardTemplate={(templateId, name) =>
              setSettings((prev) => {
                const nextTemplates = sanitizeCardTemplates(prev.cardTemplates).map((template) =>
                  template.id === templateId
                    ? {
                        ...template,
                        name: name.trim().slice(0, 48) || template.name,
                      }
                    : template,
                );
                return {
                  ...prev,
                  cardTemplates: nextTemplates,
                };
              })
            }
            onSaveCardTemplate={(name, markdown) =>
              setSettings((prev) => {
                const cleanName = name.trim();
                if (!cleanName) {
                  return prev;
                }
                const nextTemplates = sanitizeCardTemplates(prev.cardTemplates);
                nextTemplates.unshift({
                  id: createCustomTemplateId(),
                  name: cleanName.slice(0, 48),
                  markdown: markdown.slice(0, 12000),
                });
                return {
                  ...prev,
                  cardTemplates: nextTemplates.slice(0, CUSTOM_TEMPLATE_MAX_COUNT),
                };
              })
            }
            onDeleteCardTemplate={(templateId) =>
              setSettings((prev) => {
                const nextTemplates = sanitizeCardTemplates(prev.cardTemplates).filter(
                  (template) => template.id !== templateId,
                );
                if (nextTemplates.length === sanitizeCardTemplates(prev.cardTemplates).length) {
                  return prev;
                }
                return {
                  ...prev,
                  cardTemplates: nextTemplates,
                };
              })
            }
            onDeleteImageAsset={(relativePath) => {
              void (async () => {
                try {
                  await window.testoApi?.deleteImageAsset(relativePath);
                } catch {
                  return;
                }
                await refreshImageAssets();
              })();
            }}
            onToggleDrawingMode={toggleDrawingMode}
            onCloseDrawingSidebar={closeDrawingMode}
            onDrawingToolChange={(tool) =>
              setSettings((prev) => ({
                ...prev,
                drawingTool: tool,
              }))
            }
            onDrawingBrushChange={(brush) =>
              setSettings((prev) => ({
                ...prev,
                drawingBrush: brush,
              }))
            }
            onDrawingSizeChange={(size) =>
              setSettings((prev) => ({
                ...prev,
                drawingSize: Math.max(2, Math.min(MAX_DRAW_SIZE, size)),
              }))
            }
            onDrawingOpacityChange={(opacity) =>
              setSettings((prev) => ({
                ...prev,
                drawingOpacity: Math.max(0.05, Math.min(1, opacity)),
              }))
            }
            onDrawingColorChange={(color) =>
              setSettings((prev) => ({
                ...prev,
                drawingColor: color,
              }))
            }
            onDrawingPresetColorChange={(index, color) =>
              setSettings((prev) => {
                const nextPresets = sanitizeDrawingPresetColors(prev.drawingPresetColors);
                if (index < 0 || index >= nextPresets.length || !/^#[0-9a-f]{6}$/i.test(color)) {
                  return prev;
                }
                nextPresets[index] = color;
                return {
                  ...prev,
                  drawingPresetColors: nextPresets,
                };
              })
            }
            onClearDrawing={() => {
              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const strokes = getStrokesForNode(next, selectedNode.id);
                if (strokes.length === 0) {
                  return prev;
                }

                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards: [...getCardsForNode(next, selectedNode.id)],
                        strokes: [],
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });
            }}
            onDuplicateSelected={() => {
              if (selectedCardIds.length === 0) {
                return;
              }

              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [...getCardsForNode(next, selectedNode.id)];
                const selectedCardsForDup = cards.filter((card) =>
                  selectedCardIds.includes(card.id),
                );
                if (selectedCardsForDup.length === 0) {
                  return prev;
                }

                const duplicates = selectedCardsForDup.map((card) =>
                  createNoteboardCard(card.x + 28, card.y + 28),
                );
                duplicates.forEach((dup, index) => {
                  dup.text = selectedCardsForDup[index].text;
                  dup.color = selectedCardsForDup[index].color;
                  dup.width = selectedCardsForDup[index].width;
                  dup.height = selectedCardsForDup[index].height;
                });
                cards.unshift(...duplicates);

                setUiState((prevUi) => ({
                  ...prevUi,
                  cardSelection: {
                    nodeId: selectedNode.id,
                    cardIds: duplicates.map((card) => card.id),
                  },
                }));

                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });
            }}
            onSelectCard={(cardId, additive) => {
              if (uiStateRef.current.isDrawingMode) {
                return;
              }
              setUiState((prev) => {
                const current =
                  prev.cardSelection.nodeId === selectedNode.id ? prev.cardSelection.cardIds : [];
                const nextCardIds = additive
                  ? current.includes(cardId)
                    ? current.filter((id) => id !== cardId)
                    : [...current, cardId]
                  : [cardId];

                return {
                  ...prev,
                  contextMenu: null,
                  cardSelection: {
                    nodeId: selectedNode.id,
                    cardIds: nextCardIds,
                  },
                };
              });
            }}
            onStartDragCard={(cardId, event) => {
              if (uiStateRef.current.isDrawingMode) {
                return;
              }
              const cards = getCardsForNode(stateRef.current, selectedNode.id);
              const card = cards.find((item) => item.id === cardId);
              const canvas = canvasRef.current;
              if (!card || !canvas) {
                return;
              }

              const current =
                uiStateRef.current.cardSelection.nodeId === selectedNode.id
                  ? uiStateRef.current.cardSelection.cardIds
                  : [];
              const movingCardIds =
                current.includes(cardId) && current.length > 0 ? current : [cardId];

              const startPositions: Record<string, { x: number; y: number }> = {};
              movingCardIds.forEach((id) => {
                const selectedCard = cards.find((item) => item.id === id);
                if (selectedCard) {
                  startPositions[id] = { x: selectedCard.x, y: selectedCard.y };
                }
              });

              const pointer = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
              pushHistory();
              dragRef.current = {
                pointerId: event.pointerId,
                nodeId: selectedNode.id,
                movingCardIds: Object.keys(startPositions),
                pointerStartX: pointer.x,
                pointerStartY: pointer.y,
                startPositions,
              };
              document.body.classList.add('is-dragging-card');

              setUiState((prev) => ({
                ...prev,
                cardSelection: {
                  nodeId: selectedNode.id,
                  cardIds: movingCardIds,
                },
              }));
              event.preventDefault();
              event.stopPropagation();
            }}
            onStartResizeCard={(cardId, event) => {
              if (uiStateRef.current.isDrawingMode) {
                return;
              }
              const cards = getCardsForNode(stateRef.current, selectedNode.id);
              const card = cards.find((item) => item.id === cardId);
              const canvas = canvasRef.current;
              if (!card || !canvas) {
                return;
              }

              const pointer = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
              const minSize = estimateCardDimensionsFromText(card.text);
              pushHistory();
              resizeRef.current = {
                pointerId: event.pointerId,
                nodeId: selectedNode.id,
                cardId: card.id,
                startPointerX: pointer.x,
                startPointerY: pointer.y,
                startWidth: Math.max(card.width, minSize.width),
                startHeight: Math.max(card.height, minSize.height),
                startX: card.x,
                startY: card.y,
              };
              document.body.classList.add('is-resizing-card');
              event.preventDefault();
              event.stopPropagation();
            }}
            onDeleteCard={(cardId) => {
              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [...getCardsForNode(next, selectedNode.id)];
                const index = cards.findIndex((card) => card.id === cardId);
                if (index < 0) {
                  return prev;
                }

                cards.splice(index, 1);
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });

              setUiState((prev) => ({
                ...prev,
                cardSelection: {
                  nodeId: selectedNode.id,
                  cardIds: selectedCardIds.filter((id) => id !== cardId),
                },
              }));
            }}
            onCardTextChange={(cardId, value) => {
              const sessionKey = `${selectedNode.id}:${cardId}`;
              if (!textEditSessionsRef.current.has(sessionKey)) {
                pushHistory();
                textEditSessionsRef.current.add(sessionKey);
              }

              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = getCardsForNode(next, selectedNode.id).map((card) => {
                  if (card.id !== cardId) {
                    return card;
                  }
                  const nextSize = estimateCardDimensionsFromText(value);
                  const grownWidth = Math.max(card.width, nextSize.width);
                  const grownHeight = Math.max(card.height, nextSize.height);
                  const clampedPos = clampCardToWorld(
                    card.x,
                    card.y,
                    grownWidth,
                    grownHeight,
                  );
                  return {
                    ...card,
                    text: value,
                    width: grownWidth,
                    height: grownHeight,
                    x: clampedPos.x,
                    y: clampedPos.y,
                  };
                });
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });
            }}
            onCardColorChange={(cardId, color) => {
              if (!isHexColor(color)) {
                return;
              }
              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = getCardsForNode(next, selectedNode.id).map((card) =>
                  card.id === cardId ? { ...card, color } : card,
                );
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });
            }}
            onCardTextEditStart={(cardId) => {
              textEditSessionsRef.current.delete(`${selectedNode.id}:${cardId}`);
            }}
            onCardTextEditEnd={(cardId) => {
              textEditSessionsRef.current.delete(`${selectedNode.id}:${cardId}`);
            }}
            onCreateCardAtContextMenu={() => {
              const menu = uiState.contextMenu;
              if (!menu || menu.nodeId !== selectedNode.id) {
                return;
              }

              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [...getCardsForNode(next, selectedNode.id)];
                const pos = clampCardToWorld(menu.worldX - CARD_WIDTH / 2, menu.worldY - 24);
                const created = createNoteboardCard(pos.x, pos.y);
                created.color = themeCardColor;
                cards.unshift(created);
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });

              setUiState((prev) => ({
                ...prev,
                contextMenu: null,
              }));
            }}
            onPasteTextAtContextMenu={() => {
              const menu = uiState.contextMenu;
              if (!menu || menu.nodeId !== selectedNode.id) {
                return;
              }

              void (async () => {
                const pastedFromSystemClipboard = await pasteSystemClipboardAtPoint(
                  selectedNode.id,
                  menu.worldX,
                  menu.worldY,
                );
                if (!pastedFromSystemClipboard) {
                  pasteCopiedCardsAtCanvasCenter(selectedNode.id);
                }
              })();
            }}
            onCreateCardAtPointAndEdit={(clientX, clientY) => {
              const canvas = canvasRef.current;
              if (!canvas) {
                return null;
              }

              const world = getWorldPoint(canvas, selectedView, clientX, clientY);
              const pos = clampCardToWorld(
                world.x - CARD_WIDTH / 2,
                world.y - CARD_MIN_HEIGHT / 2,
              );
              const created = createNoteboardCard(pos.x, pos.y);
              created.color = themeCardColor;

              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [created, ...getCardsForNode(next, selectedNode.id)];
                return {
                  ...next,
                  nodeDataById: {
                    ...next.nodeDataById,
                    [selectedNode.id]: {
                      ...(next.nodeDataById[selectedNode.id] ?? {}),
                      noteboard: {
                        ...(next.nodeDataById[selectedNode.id]?.noteboard ?? { cards: [] }),
                        cards,
                        view: { ...getViewForNode(next, selectedNode.id) },
                      },
                    },
                  },
                };
              });

              setUiState((prev) => ({
                ...prev,
                contextMenu: null,
                selectionBox: null,
                cardSelection: {
                  nodeId: selectedNode.id,
                  cardIds: [created.id],
                },
              }));

              return created.id;
            }}
          />
        ) : selectedNode ? (
          <DocumentEditor
            node={selectedNode}
            markdown={selectedDocumentMarkdown}
            onMarkdownEditStart={() => {
              documentEditSessionsRef.current.delete(selectedNode.id);
            }}
            onMarkdownEditEnd={() => {
              documentEditSessionsRef.current.delete(selectedNode.id);
            }}
            onMarkdownChange={(value) => {
              if (!documentEditSessionsRef.current.has(selectedNode.id)) {
                pushHistory();
                documentEditSessionsRef.current.add(selectedNode.id);
              }

              setState((prev) => {
                const currentValue = getDocumentMarkdownForNode(prev, selectedNode.id);
                if (currentValue === value) {
                  return prev;
                }
                return {
                  ...prev,
                  nodeDataById: {
                    ...prev.nodeDataById,
                    [selectedNode.id]: {
                      ...(prev.nodeDataById[selectedNode.id] ?? {}),
                      document: {
                        markdown: value,
                      },
                    },
                  },
                };
              });
            }}
          />
        ) : (
          <EditorPanel selectedNode={selectedNode} />
        )}
      </main>

      <DeleteNodeDialog
        pendingDeleteNode={pendingDeleteNode}
        deleteDescendantCount={deleteDescendantCount}
        onCancel={() =>
          setUiState((prev) => ({
            ...prev,
            pendingDeleteNodeId: null,
          }))
        }
        onConfirm={onConfirmDelete}
      />

      <CreateNodeDialog
        isVisible={Boolean(uiState.pendingCreateParentRef)}
        createTargetLabel={createTargetLabel}
        onCancel={() =>
          setUiState((prev) => ({
            ...prev,
            pendingCreateParentRef: null,
          }))
        }
        onSelectType={onSelectCreateType}
      />

      <SettingsDialog
        isVisible={uiState.isSettingsDialogOpen}
        sidebarWidthValue={uiState.settingsDraftSidebarWidth}
        themeValue={uiState.settingsDraftTheme}
        themeOptions={themeOptions}
        minSidebarWidth={MIN_SIDEBAR_WIDTH}
        maxSidebarWidth={MAX_SIDEBAR_WIDTH}
        onSidebarWidthChange={(value) =>
          setUiState((prev) => ({
            ...prev,
            settingsDraftSidebarWidth: value,
          }))
        }
        onThemeChange={(value) =>
          setUiState((prev) => ({
            ...prev,
            settingsDraftTheme: value,
          }))
        }
        onCancel={() =>
          setUiState((prev) => ({
            ...prev,
            isSettingsDialogOpen: false,
            settingsDraftSidebarWidth: String(settings.sidebarWidth),
            settingsDraftTheme: settings.theme,
          }))
        }
        onSave={onSaveSettings}
      />
    </div>
  );
};
