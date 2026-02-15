import React from 'react';
import type {
  AppTheme,
  CategoryNode,
  EditorType,
  NoteboardBrushType,
  NoteboardCard,
  NoteboardStroke,
  PersistedTreeState,
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
  CARD_WIDTH,
  CANVAS_PADDING,
  clampCardToWorld,
  clampViewOffsets,
  createNoteboardCard,
  getMinZoomForCanvas,
  getWorldPoint,
  type NoteboardView,
} from './renderer/noteboard-utils';
import { appendPointWithPressure, createBrushStroke } from './renderer/noteboard-drawing';
import { createHistoryStack } from './renderer/history-stack';
import { isPersistedTreeState } from './renderer/persistence-guards';
import { NodeTree } from './components/node-tree';
import { CreateNodeDialog, DeleteNodeDialog, SettingsDialog } from './components/dialogs';
import { EditorPanel } from './components/editor-panel';
import { NoteboardCanvas } from './components/noteboard-canvas';

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
        dx: number;
        dy: number;
      }>;
    }
  | null;

const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 620;
const MAX_ZOOM = 2.5;
const MAX_HISTORY_ENTRIES = 120;
const MAX_DRAW_SIZE = 64;
const DRAWING_PRESET_COLOR_COUNT = 6;
const DEFAULT_DRAWING_PRESET_COLORS = [
  '#1e1f24',
  '#ff6b6b',
  '#4dabf7',
  '#51cf66',
  '#ffd43b',
  '#f783ac',
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
};

const themeOptions: Array<{ value: AppTheme; label: string }> = [
  { value: 'parchment', label: 'Parchment' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'evergreen', label: 'Evergreen' },
];

const isAppTheme = (value: unknown): value is AppTheme =>
  value === 'parchment' || value === 'midnight' || value === 'evergreen';

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
        )))
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
    if (next.x !== card.x || next.y !== card.y) {
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
  const panRef = React.useRef<PanState | null>(null);
  const drawRef = React.useRef<DrawState | null>(null);
  const drawPointQueueRef = React.useRef<QueuedDrawPoint[]>([]);
  const drawRafRef = React.useRef<number | null>(null);
  const clipboardRef = React.useRef<AppClipboard>(null);
  const textEditSessionsRef = React.useRef<Set<string>>(new Set<string>());
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
    panRef.current = null;
    drawRef.current = null;
    drawPointQueueRef.current = [];
    if (drawRafRef.current !== null) {
      window.cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }
    textEditSessionsRef.current.clear();
    document.body.classList.remove('is-dragging-card');
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
        const [loadedState, loadedSettings] = await Promise.all([
          window.testoApi.loadTreeState(),
          window.testoApi.loadUserSettings(),
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
          });
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
            const cardMaxX = card.x + CARD_WIDTH;
            const cardMinY = card.y;
            const cardMaxY = card.y + CARD_MIN_HEIGHT;
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
        const maxStartX = Math.max(...starts.map((p) => p.x));
        const minStartY = Math.min(...starts.map((p) => p.y));
        const maxStartY = Math.max(...starts.map((p) => p.y));
        const minAllowedDeltaX = NOTEBOARD_WORLD_MIN_X + CANVAS_PADDING - minStartX;
        const maxAllowedDeltaX =
          NOTEBOARD_WORLD_MAX_X - CARD_WIDTH - CANVAS_PADDING - maxStartX;
        const minAllowedDeltaY = NOTEBOARD_WORLD_MIN_Y + CANVAS_PADDING - minStartY;
        const maxAllowedDeltaY =
          NOTEBOARD_WORLD_MAX_Y - CARD_MIN_HEIGHT - CANVAS_PADDING - maxStartY;

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
      drawPointQueueRef.current = [];
      if (drawRafRef.current !== null) {
        window.cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = null;
      }
      document.body.classList.remove('is-drawing-canvas');
    };
  }, [flushQueuedDrawPoints]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      const isTextEntryTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
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
              dx: card.x - anchorX,
              dy: card.y - anchorY,
            })),
          };
        }
        event.preventDefault();
        return;
      }

      if (key === 'v' && clipboardRef.current?.kind === 'noteboard-cards') {
        pushHistory();
        setState((prev) => {
          const next = ensureNoteboardData(prev, activeNode.id);
          const cards = [...getCardsForNode(next, activeNode.id)];
          const view = getViewForNode(next, activeNode.id);
          const canvas = canvasRef.current;
          let anchorX = 0;
          let anchorY = 0;

          if (canvas) {
            anchorX = (canvas.clientWidth / 2 - view.offsetX) / view.zoom + NOTEBOARD_WORLD_MIN_X;
            anchorY =
              (canvas.clientHeight / 2 - view.offsetY) / view.zoom + NOTEBOARD_WORLD_MIN_Y;
          }

          const newIds: string[] = [];
          clipboardRef.current.cards.forEach((item) => {
            const pos = clampCardToWorld(anchorX + item.dx, anchorY + item.dy);
            const created = createNoteboardCard(pos.x, pos.y);
            created.text = item.text;
            cards.unshift(created);
            newIds.push(created.id);
          });

          setUiState((prevUi) => ({
            ...prevUi,
            cardSelection: {
              nodeId: activeNode.id,
              cardIds: newIds,
            },
          }));

          return {
            ...next,
            nodeDataById: {
              ...next.nodeDataById,
              [activeNode.id]: {
                ...(next.nodeDataById[activeNode.id] ?? {}),
                noteboard: {
                  ...(next.nodeDataById[activeNode.id]?.noteboard ?? { cards: [] }),
                  cards,
                  view: { ...view },
                },
              },
            },
          };
        });
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [pushHistory, redoHistory, undoHistory]);

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
                  '.noteboard-card, .noteboard-toolbar, .noteboard-draw-sidebar, .canvas-context-menu, .color-quick-menu',
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
                  '.noteboard-card, .noteboard-toolbar, .noteboard-draw-sidebar, .canvas-context-menu, .color-quick-menu',
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
              if (target.closest('.card-textarea, .noteboard-card')) {
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
              const menuWidth = 196;
              const menuHeight = 44;
              const screenX = Math.min(
                window.innerWidth - menuWidth - 8,
                Math.max(8, event.clientX),
              );
              const screenY = Math.min(
                window.innerHeight - menuHeight - 8,
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
            onAddCard={() => {
              pushHistory();
              setState((prev) => {
                const next = ensureNoteboardData(prev, selectedNode.id);
                const cards = [...getCardsForNode(next, selectedNode.id)];
                const view = getViewForNode(next, selectedNode.id);
                const canvas = canvasRef.current;
                const fallback = { x: CANVAS_PADDING + 40, y: CANVAS_PADDING + 40 };
                const positioned = canvas
                  ? clampCardToWorld(
                      (canvas.clientWidth / 2 - view.offsetX) / view.zoom +
                        NOTEBOARD_WORLD_MIN_X -
                        CARD_WIDTH / 2,
                      (canvas.clientHeight / 2 - view.offsetY) / view.zoom +
                        NOTEBOARD_WORLD_MIN_Y -
                        CARD_MIN_HEIGHT / 2,
                    )
                  : fallback;

                const card = createNoteboardCard(positioned.x, positioned.y);
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
                        view: { ...view },
                      },
                    },
                  },
                };
              });
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
                const cards = getCardsForNode(next, selectedNode.id).map((card) =>
                  card.id === cardId ? { ...card, text: value } : card,
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
                cards.unshift(createNoteboardCard(pos.x, pos.y));
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
