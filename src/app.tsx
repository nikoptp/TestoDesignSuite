import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  KanbanPriority,
  LaunchState,
  PersistedTreeState,
  ProjectImageAsset,
  RecentProjectEntry,
  UserSettings,
} from './shared/types';
import {
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from './shared/noteboard-constants';
import {
  countDescendants,
  findNodeById,
  moveNodeById,
} from './shared/tree-utils';
import { useOutsidePointerDismiss } from './shared/hooks/use-outside-pointer-dismiss';
import { startWindowPointerSession } from './shared/pointer-session';
import {
} from './renderer/noteboard-utils';
import { appendPointWithPressure } from './renderer/noteboard-drawing';
import { NodeTree, type NodeDropPosition } from './components/node-tree';
import { CreateNodeDialog, DeleteNodeDialog, SettingsDialog } from './components/dialogs';
import { EditorPanel } from './components/editor-panel';
import { NoteboardCanvas } from './components/noteboard-canvas';
import { DocumentEditor } from './components/document-editor';
import { KanbanBoard } from './components/kanban-board';
import { StartupSplash } from './components/startup-splash';
import {
  useProjectBootstrap,
  useProjectSnapshotResponder,
  useSettingsAutosave,
  useTreeAutosave,
} from './features/project/hooks/use-project-lifecycle';
import { useProjectStatusController } from './features/project/hooks/use-project-status-controller';
import { useTreeActions } from './features/navigation/hooks/use-tree-actions';
import { useSettingsDialogController } from './features/navigation/hooks/use-settings-dialog-controller';
import { useHistoryController } from './features/app/hooks/use-history-controller';
import { useNoteboardClipboard } from './features/noteboard/hooks/use-noteboard-clipboard';
import { useNoteboardCanvasEvents } from './features/noteboard/hooks/use-noteboard-canvas-events';
import { useNoteboardCardActions } from './features/noteboard/hooks/use-noteboard-card-actions';
import { useNoteboardPointerEvents } from './features/noteboard/hooks/use-noteboard-pointer-events';
import {
  useNoteboardKeyboardShortcuts,
  useNoteboardPasteShortcut,
} from './features/noteboard/hooks/use-noteboard-global-events';
import { useDocumentEditorActions } from './features/document/hooks/use-document-editor-actions';
import { useThemeRuntime } from './features/theme/hooks/use-theme-runtime';
import { useThemeStudioController } from './features/theme/hooks/use-theme-studio-controller';

import {
  CARD_COLOR_PRESETS,
  MAX_HISTORY_ENTRIES,
  type AppClipboard,
  type DragState,
  type DrawState,
  type PanState,
  type QueuedDrawPoint,
  type ResizeState,
  type UiState,
  CARD_TEMPLATES,
  clampSidebarWidth,
  defaultSettings,
  defaultState,
  ensureNoteboardData,
  ensureKanbanData,
  getCardsForNode,
  getKanbanBoardForNode,
  getSharedKanbanBacklogCards,
  getDocumentMarkdownForNode,
  getStrokesForNode,
  getThemeCardColor,
  getViewForNode,
  isAppTheme,
  isUserSettings,
  sanitizeCardTemplates,
  sanitizeCustomThemes,
  sanitizeDrawingPresetColors,
  themeOptions,
} from './features/app/app-model';
import {
  addKanbanColumn,
  createKanbanCard,
  deleteKanbanCard,
  deleteKanbanColumn,
  migrateKanbanCards,
  moveKanbanCard,
  pasteKanbanCard,
  recolorKanbanColumn,
  renameKanbanColumn,
  updateKanbanCard,
} from './features/app/kanban-state';
import { updateNodeNoteboardData } from './features/app/workspace-node-updaters';

const SKIP_SPLASH_ONCE_KEY = 'testo.splash.skipOnce';
const SKIP_SPLASH_QUERY_PARAM = 'skipSplashOnce';

export const App = (): React.ReactElement => {
  const [isStartupSplashVisible, setIsStartupSplashVisible] = React.useState(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(SKIP_SPLASH_QUERY_PARAM) === '1') {
        url.searchParams.delete(SKIP_SPLASH_QUERY_PARAM);
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        return false;
      }
    } catch {
      // Ignore URL parsing/access issues and fall back to localStorage flag.
    }

    try {
      if (window.localStorage.getItem(SKIP_SPLASH_ONCE_KEY) === '1') {
        window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
        return false;
      }
    } catch {
      // Ignore storage access issues and keep splash visible by default.
    }
    return true;
  });
  const [state, setState] = React.useState<PersistedTreeState>(defaultState);
  const [settings, setSettings] = React.useState<UserSettings>(defaultSettings);
  const [imageAssets, setImageAssets] = React.useState<ProjectImageAsset[]>([]);
  const [uiState, setUiState] = React.useState<UiState>({
    editingNodeId: null,
    editingNameDraft: '',
    pendingDeleteNodeId: null,
    pendingCreateParentRef: null,
    isSettingsDialogOpen: false,
    settingsDraftTheme: defaultSettings.theme,
    settingsDraftCustomThemeId: '',
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
  const [isStartupActionBusy, setIsStartupActionBusy] = React.useState(false);
  const [, setStartupStatusMessage] = React.useState('Preparing workspace...');
  const [recentProjects, setRecentProjects] = React.useState<RecentProjectEntry[]>([]);
  const [lastActiveProjectPath, setLastActiveProjectPath] = React.useState<string | null>(null);
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
  const documentQuickUndoNodeIdRef = React.useRef<string | null>(null);
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

  useProjectSnapshotResponder(stateRef, settingsRef);

  useThemeRuntime(settings);
  const { projectStatus, showTransientProjectStatus } = useProjectStatusController();

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

      return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
        ...noteboard,
        cards: [...getCardsForNode(next, nodeId)],
        strokes: kept,
        view: { ...getViewForNode(next, nodeId) },
      }));
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
      return updateNodeNoteboardData(next, draw.nodeId, (noteboard) => ({
        ...noteboard,
        cards: [...getCardsForNode(next, draw.nodeId)],
        strokes,
        view: { ...view },
      }));
    });
  }, [eraseStrokesAtPoint]);

  const { pushHistory, undoHistory, redoHistory } = useHistoryController({
    maxEntries: MAX_HISTORY_ENTRIES,
    setState,
    setUiState,
    stateRef,
    uiStateRef,
    dragRef,
    resizeRef,
    panRef,
    drawRef,
    drawPointQueueRef,
    drawRafRef,
    textEditSessionsRef,
    documentEditSessionsRef,
  });

  useProjectBootstrap({
    setState,
    setSettings,
    setImageAssets,
    setIsBootstrapped,
    clampSidebarWidth,
    defaultSidebarWidth: defaultState.sidebarWidth ?? 320,
    isUserSettings,
    defaultSettings,
    sanitizeDrawingPresetColors,
    sanitizeCardTemplates,
    sanitizeCustomThemes,
  });
  useTreeAutosave({
    isBootstrapped,
    state,
    timerRef: stateSaveTimerRef,
  });
  useSettingsAutosave({
    isBootstrapped,
    settings,
    timerRef: settingsSaveTimerRef,
  });

  React.useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    if (!window.testoApi?.getLaunchState) {
      setStartupStatusMessage('Choose a startup option.');
      return;
    }

    let cancelled = false;
    const loadLaunchState = async (): Promise<void> => {
      try {
        const launchState: LaunchState = await window.testoApi.getLaunchState();
        if (cancelled) {
          return;
        }
        setRecentProjects(launchState.recentProjects);
        setLastActiveProjectPath(launchState.lastActiveProjectPath);
        setStartupStatusMessage('Choose a startup option.');
      } catch {
        if (cancelled) {
          return;
        }
        setStartupStatusMessage('Unable to load recent projects.');
      }
    };

    void loadLaunchState();
    return () => {
      cancelled = true;
    };
  }, [isBootstrapped]);

  const onBeginResize = React.useCallback(() => {
    setIsResizing(true);
  }, []);

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }

    let cleanupSession: (() => void) | null = null;
    const onPointerMove = (event: PointerEvent): void => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      setState((prev) => ({
        ...prev,
        sidebarWidth: clampSidebarWidth(event.clientX - shellRect.left),
      }));
    };

    const onPointerUp = (): void => {
      setIsResizing(false);
    };

    cleanupSession = startWindowPointerSession({
      onMove: onPointerMove,
      onEnd: onPointerUp,
      bodyClassName: 'is-resizing-sidebar',
    });

    return () => {
      cleanupSession?.();
      cleanupSession = null;
    };
  }, [isResizing]);

  useNoteboardPointerEvents({
    canvasRef,
    stateRef,
    uiStateRef,
    dragRef,
    resizeRef,
    panRef,
    drawRef,
    drawPointQueueRef,
    drawRafRef,
    setState,
    setUiState,
    flushQueuedDrawPoints,
    eraseStrokesAtPoint,
  });

  const {
    getCanvasCenterWorldPoint,
    extractImageBlobFromClipboardData,
    createTextCardAtWorldPoint,
    createImageCardAtWorldPoint,
    pasteCopiedCardsAtCanvasCenter,
    pasteSystemClipboardAtPoint,
    handleCanvasDrop,
  } = useNoteboardClipboard({
    canvasRef,
    stateRef,
    settingsRef,
    clipboardRef,
    setState,
    setUiState,
    pushHistory,
    refreshImageAssets,
  });

  useNoteboardKeyboardShortcuts({
    stateRef,
    uiStateRef,
    drawRef,
    drawPointQueueRef,
    drawRafRef,
    clipboardRef,
    documentQuickUndoNodeIdRef,
    setState,
    setUiState,
    pushHistory,
    undoHistory,
    redoHistory,
  });

  useNoteboardPasteShortcut({
    stateRef,
    clipboardRef,
    getCanvasCenterWorldPoint,
    extractImageBlobFromClipboardData,
    createImageCardAtWorldPoint,
    createTextCardAtWorldPoint,
    pasteCopiedCardsAtCanvasCenter,
  });

  useOutsidePointerDismiss({
    ignoredSelectors: '.canvas-context-menu',
    onDismiss: () => {
      if (!uiStateRef.current.contextMenu) {
        return;
      }
      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
      }));
    },
  });

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

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
      return;
    }

    setState((prev) => ensureKanbanData(prev, selectedNode.id));
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
    selectedNode &&
    selectedNode.editorType !== 'noteboard' &&
    selectedNode.editorType !== 'kanban-board'
      ? getDocumentMarkdownForNode(state, selectedNode.id)
      : '';
  const selectedKanban =
    selectedNode && selectedNode.editorType === 'kanban-board'
      ? getKanbanBoardForNode(state, selectedNode.id)
      : null;
  const sharedKanbanBacklogCards = getSharedKanbanBacklogCards(state);

  const collectKanbanNodes = React.useCallback((nodes: typeof state.nodes): Array<{ nodeId: string; name: string }> => {
    const result: Array<{ nodeId: string; name: string }> = [];
    const visit = (items: typeof state.nodes): void => {
      items.forEach((node) => {
        if (node.editorType === 'kanban-board') {
          result.push({ nodeId: node.id, name: node.name });
        }
        if (node.children.length > 0) {
          visit(node.children);
        }
      });
    };
    visit(nodes);
    return result;
  }, []);

  const kanbanMigrateTargets =
    selectedNode && selectedNode.editorType === 'kanban-board'
      ? collectKanbanNodes(state.nodes).filter((node) => node.nodeId !== selectedNode.id)
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

  const {
    onCanvasPointerDown,
    onCanvasWheel,
    onCanvasContextMenu,
    onCanvasDrop,
    onStartDragCard,
    onStartResizeCard,
  } = useNoteboardCanvasEvents({
    nodeId: selectedNode?.id ?? '',
    selectedView,
    uiState,
    canvasRef,
    stateRef,
    settings,
    dragRef,
    resizeRef,
    panRef,
    drawRef,
    setState,
    setUiState,
    setSettings,
    pushHistory,
    getBrushColor,
    eraseStrokesAtPoint,
    handleCanvasDrop,
  });

  const {
    onAddCardFromTemplateAt,
    onRenameCardTemplate,
    onSaveCardTemplate,
    onDeleteCardTemplate,
    onDeleteImageAsset,
    onDrawingToolChange,
    onDrawingBrushChange,
    onDrawingSizeChange,
    onDrawingOpacityChange,
    onDrawingColorChange,
    onDrawingPresetColorChange,
    onClearDrawing,
    onDuplicateSelected,
    onSelectCard,
    onDeleteCard,
    onCardTextChange,
    onCardColorChange,
    onCardTextEditStart,
    onCardTextEditEnd,
    onCreateCardAtContextMenu,
    onPasteTextAtContextMenu,
    onCreateCardAtPointAndEdit,
  } = useNoteboardCardActions({
    nodeId: selectedNode?.id ?? '',
    selectedView,
    selectedCardIds,
    availableCardTemplates,
    themeCardColor,
    uiState,
    uiStateRef,
    canvasRef,
    textEditSessionsRef,
    setState,
    setUiState,
    setSettings,
    pushHistory,
    pasteSystemClipboardAtPoint,
    pasteCopiedCardsAtCanvasCenter,
    refreshImageAssets,
  });

  const {
    onMarkdownEditStart,
    onMarkdownEditEnd,
    onMarkdownChange,
  } = useDocumentEditorActions({
    nodeId: selectedNode?.id ?? '',
    documentEditSessionsRef,
    documentQuickUndoNodeIdRef,
    setState,
    pushHistory,
  });

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

  const {
    onSelectNode,
    onBeginRename,
    onRenameCommit,
    onRenameCancel,
    onSelectCreateType,
    onConfirmDelete,
    onSaveSettings,
  } = useTreeActions({
    state,
    uiState,
    settings,
    setState,
    setUiState,
    setSettings,
    pushHistory,
    isAppTheme,
  });

  const onMoveNode = React.useCallback(
    (sourceId: string, targetId: string, position: NodeDropPosition): void => {
      setState((prev) => {
        const nextNodes = [...prev.nodes];
        const didMove = moveNodeById(nextNodes, sourceId, targetId, position);
        if (!didMove) {
          return prev;
        }

        pushHistory();
        return {
          ...prev,
          nodes: nextNodes,
        };
      });
      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
        selectionBox: null,
      }));
    },
    [pushHistory, setState, setUiState],
  );

  const onContinueFromSplash = React.useCallback((): void => {
    setIsStartupSplashVisible(false);
  }, []);

  const onOpenProjectFromSplash = React.useCallback(async (): Promise<void> => {
    if (!window.testoApi?.openProjectFileDialog) {
      return;
    }

    setIsStartupActionBusy(true);
    setStartupStatusMessage('Opening project...');
    try {
      window.localStorage.setItem(SKIP_SPLASH_ONCE_KEY, '1');
    } catch {
      // Ignore storage access issues.
    }
    try {
      const opened = await window.testoApi.openProjectFileDialog();
      if (opened) {
        setIsStartupSplashVisible(false);
      } else {
        try {
          window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
        } catch {
          // Ignore storage access issues.
        }
        setStartupStatusMessage('Open canceled.');
      }
    } catch {
      try {
        window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
      } catch {
        // Ignore storage access issues.
      }
      setStartupStatusMessage('Open failed.');
    } finally {
      setIsStartupActionBusy(false);
    }
  }, []);

  const onCreateProjectFromSplash = React.useCallback(async (): Promise<void> => {
    if (!window.testoApi?.createNewProject) {
      return;
    }

    setIsStartupActionBusy(true);
    setStartupStatusMessage('Creating project...');
    try {
      window.localStorage.setItem(SKIP_SPLASH_ONCE_KEY, '1');
    } catch {
      // Ignore storage access issues.
    }
    try {
      const created = await window.testoApi.createNewProject();
      if (created) {
        setIsStartupSplashVisible(false);
      } else {
        try {
          window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
        } catch {
          // Ignore storage access issues.
        }
        setStartupStatusMessage('New project canceled.');
      }
    } catch {
      try {
        window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
      } catch {
        // Ignore storage access issues.
      }
      setStartupStatusMessage('New project failed.');
    } finally {
      setIsStartupActionBusy(false);
    }
  }, []);

  const onOpenRecentFromSplash = React.useCallback(async (filePath: string): Promise<void> => {
    if (!window.testoApi?.openRecentProject) {
      return;
    }

    setIsStartupActionBusy(true);
    setStartupStatusMessage('Opening recent project...');
    try {
      window.localStorage.setItem(SKIP_SPLASH_ONCE_KEY, '1');
    } catch {
      // Ignore storage access issues.
    }
    try {
      const opened = await window.testoApi.openRecentProject(filePath);
      if (opened) {
        setIsStartupSplashVisible(false);
      } else {
        try {
          window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
        } catch {
          // Ignore storage access issues.
        }
        setStartupStatusMessage('Unable to open selected project.');
      }
    } catch {
      try {
        window.localStorage.removeItem(SKIP_SPLASH_ONCE_KEY);
      } catch {
        // Ignore storage access issues.
      }
      setStartupStatusMessage('Unable to open selected project.');
    } finally {
      setIsStartupActionBusy(false);
    }
  }, []);

  const {
    onThemeDraftChange,
    onCustomThemeDraftChange,
    onCancelSettingsDialog,
  } = useSettingsDialogController({
    settings,
    settingsRef,
    setUiState,
  });

  const {
    selectedCustomThemeForDraft,
    onCreateCustomTheme,
    onRenameCustomTheme,
    onDeleteCustomTheme,
    onCustomThemeTokenChange,
    onImportCustomTheme,
    onExportCustomTheme,
  } = useThemeStudioController({
    settings,
    uiState,
    setSettings,
    setUiState,
    showStatus: ({ status, message }) => showTransientProjectStatus(status, message),
  });

  const onKanbanCreateCard = React.useCallback(
    (columnId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }

      pushHistory();
      setState((prev) => createKanbanCard(prev, selectedNode.id, columnId));
    },
    [pushHistory, selectedNode],
  );

  const onKanbanMoveCard = React.useCallback(
    (input: {
      cardId: string;
      fromSharedBacklog: boolean;
      toColumnId: string;
      toIndex: number;
    }): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }

      pushHistory();
      setState((prev) => moveKanbanCard(prev, selectedNode.id, input));
    },
    [pushHistory, selectedNode],
  );

  const onKanbanCardTitleChange = React.useCallback(
    (cardId: string, fromSharedBacklog: boolean, title: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }

      setState((prev) =>
        updateKanbanCard(prev, selectedNode.id, {
          cardId,
          fromSharedBacklog,
          patch: { title },
        }),
      );
    },
    [selectedNode],
  );

  const onKanbanCardPriorityChange = React.useCallback(
    (cardId: string, fromSharedBacklog: boolean, priority: KanbanPriority): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      setState((prev) =>
        updateKanbanCard(prev, selectedNode.id, {
          cardId,
          fromSharedBacklog,
          patch: { priority },
        }),
      );
    },
    [selectedNode],
  );

  const onKanbanCardMarkdownChange = React.useCallback(
    (cardId: string, fromSharedBacklog: boolean, markdown: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      setState((prev) =>
        updateKanbanCard(prev, selectedNode.id, {
          cardId,
          fromSharedBacklog,
          patch: { markdown },
        }),
      );
    },
    [selectedNode],
  );

  const onKanbanAddColumn = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
      return;
    }
    pushHistory();
    setState((prev) => addKanbanColumn(prev, selectedNode.id));
  }, [pushHistory, selectedNode]);

  const onKanbanRenameColumn = React.useCallback(
    (columnId: string, name: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      setState((prev) => renameKanbanColumn(prev, selectedNode.id, columnId, name));
    },
    [selectedNode],
  );

  const onKanbanColumnColorChange = React.useCallback(
    (columnId: string, color: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      setState((prev) => recolorKanbanColumn(prev, selectedNode.id, columnId, color));
    },
    [selectedNode],
  );

  const onKanbanDeleteColumn = React.useCallback(
    (columnId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board' || columnId === 'backlog') {
        return;
      }
      pushHistory();
      setState((prev) => deleteKanbanColumn(prev, selectedNode.id, columnId));
    },
    [pushHistory, selectedNode],
  );

  const onKanbanMigrate = React.useCallback(
    (targetNodeId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      if (!targetNodeId || targetNodeId === selectedNode.id) {
        return;
      }

      pushHistory();
      setState((prev) => migrateKanbanCards(prev, selectedNode.id, targetNodeId));
    },
    [pushHistory, selectedNode],
  );

  const onKanbanToggleColumnCollapsed = React.useCallback(
    (columnId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      setState((prev) => {
        const next = ensureKanbanData(prev, selectedNode.id);
        const workspace = next.nodeDataById[selectedNode.id] ?? {};
        const board = getKanbanBoardForNode(next, selectedNode.id);
        const current = board.collapsedColumnIds ?? [];
        const nextCollapsed = current.includes(columnId)
          ? current.filter((id) => id !== columnId)
          : [...current, columnId];

        return {
          ...next,
          nodeDataById: {
            ...next.nodeDataById,
            [selectedNode.id]: {
              ...workspace,
              kanban: {
                ...board,
                collapsedColumnIds: nextCollapsed,
              },
            },
          },
        };
      });
    },
    [selectedNode],
  );

  const onKanbanDeleteCard = React.useCallback(
    (cardId: string, fromSharedBacklog: boolean): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      pushHistory();
      setState((prev) => deleteKanbanCard(prev, selectedNode.id, cardId, fromSharedBacklog));
    },
    [pushHistory, selectedNode],
  );

  const onKanbanPasteCard = React.useCallback(
    (
      targetColumnId: string,
      draft: {
        title: string;
        markdown: string;
        priority: KanbanPriority;
      },
    ): void => {
      if (!selectedNode || selectedNode.editorType !== 'kanban-board') {
        return;
      }
      pushHistory();
      setState((prev) => pasteKanbanCard(prev, selectedNode.id, { targetColumnId, draft }));
    },
    [pushHistory, selectedNode],
  );

  return (
    <motion.div
      ref={shellRef}
      className="app-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ '--sidebar-width': `${state.sidebarWidth ?? 320}px` } as React.CSSProperties}
    >
      <motion.aside
        className="sidebar"
        initial={{ x: -10, opacity: 0.85 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <h1 className="brand">TestoDesignSuite</h1>
        {projectStatus ? (
          <div
            className={`project-status project-status-${projectStatus.status}`}
            role="status"
            aria-live="polite"
          >
            {projectStatus.message}
          </div>
        ) : null}

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
                collapsedNodeIds={state.collapsedNodeIds ?? []}
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
                onToggleNodeCollapsed={(nodeId) =>
                  setState((prev) => {
                    const collapsed = prev.collapsedNodeIds ?? [];
                    const nextCollapsed = collapsed.includes(nodeId)
                      ? collapsed.filter((id) => id !== nodeId)
                      : [...collapsed, nodeId];
                    return {
                      ...prev,
                      collapsedNodeIds: nextCollapsed,
                    };
                  })
                }
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
                onMoveNode={onMoveNode}
              />
            </ul>
          </div>
        </section>
      </motion.aside>
      <div
        className="sidebar-resizer"
        title="Resize sidebar"
        aria-label="Resize sidebar"
        onPointerDown={onBeginResize}
      ></div>

      <main className="main-panel">
        <AnimatePresence mode="wait" initial={false}>
          {selectedNode && selectedNode.editorType === 'noteboard' ? (
            <motion.div
              key={`noteboard-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
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
                onCanvasPointerDown={onCanvasPointerDown}
                onCanvasWheel={onCanvasWheel}
                onCanvasContextMenu={onCanvasContextMenu}
                onCanvasDrop={onCanvasDrop}
                cardTemplates={availableCardTemplates.map((template) => ({
                  id: template.id,
                  label: template.label,
                  isCustom: template.isCustom,
                }))}
                imageAssets={imageAssets}
                onAddCardFromTemplateAt={onAddCardFromTemplateAt}
                onRenameCardTemplate={onRenameCardTemplate}
                onSaveCardTemplate={onSaveCardTemplate}
                onDeleteCardTemplate={onDeleteCardTemplate}
                onDeleteImageAsset={onDeleteImageAsset}
                onToggleDrawingMode={toggleDrawingMode}
                onCloseDrawingSidebar={closeDrawingMode}
                onDrawingToolChange={onDrawingToolChange}
                onDrawingBrushChange={onDrawingBrushChange}
                onDrawingSizeChange={onDrawingSizeChange}
                onDrawingOpacityChange={onDrawingOpacityChange}
                onDrawingColorChange={onDrawingColorChange}
                onDrawingPresetColorChange={onDrawingPresetColorChange}
                onClearDrawing={onClearDrawing}
                onDuplicateSelected={onDuplicateSelected}
                onSelectCard={onSelectCard}
                onStartDragCard={onStartDragCard}
                onStartResizeCard={onStartResizeCard}
                onDeleteCard={onDeleteCard}
                onCardTextChange={onCardTextChange}
                onCardColorChange={onCardColorChange}
                onCardTextEditStart={onCardTextEditStart}
                onCardTextEditEnd={onCardTextEditEnd}
                onCreateCardAtContextMenu={onCreateCardAtContextMenu}
                onPasteTextAtContextMenu={onPasteTextAtContextMenu}
                onCreateCardAtPointAndEdit={onCreateCardAtPointAndEdit}
              />
            </motion.div>
          ) : selectedNode && selectedNode.editorType === 'kanban-board' && selectedKanban ? (
            <motion.div
              key={`kanban-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <KanbanBoard
                columns={selectedKanban.columns}
                boardCards={selectedKanban.cards}
                sharedBacklogCards={sharedKanbanBacklogCards}
                collapsedColumnIds={selectedKanban.collapsedColumnIds}
                migrateTargets={kanbanMigrateTargets}
                onCreateCard={onKanbanCreateCard}
                onMoveCard={onKanbanMoveCard}
                onCardTitleChange={onKanbanCardTitleChange}
                onCardPriorityChange={onKanbanCardPriorityChange}
                onCardMarkdownChange={onKanbanCardMarkdownChange}
                onDeleteCard={onKanbanDeleteCard}
                onPasteCard={onKanbanPasteCard}
                onAddColumn={onKanbanAddColumn}
                onRenameColumn={onKanbanRenameColumn}
                onColumnColorChange={onKanbanColumnColorChange}
                onDeleteColumn={onKanbanDeleteColumn}
                onMigrate={onKanbanMigrate}
                onToggleColumnCollapsed={onKanbanToggleColumnCollapsed}
              />
            </motion.div>
          ) : selectedNode ? (
            <motion.div
              key={`document-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <DocumentEditor
                node={selectedNode}
                markdown={selectedDocumentMarkdown}
                onMarkdownEditStart={onMarkdownEditStart}
                onMarkdownEditEnd={onMarkdownEditEnd}
                onMarkdownChange={onMarkdownChange}
              />
            </motion.div>
          ) : (
            <motion.div
              key="editor-empty"
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              <EditorPanel selectedNode={selectedNode} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isStartupSplashVisible ? (
        <StartupSplash
          recentProjects={recentProjects}
          lastActiveProjectPath={lastActiveProjectPath}
          isBusy={!isBootstrapped || isStartupActionBusy}
          onContinue={onContinueFromSplash}
          onOpenProject={onOpenProjectFromSplash}
          onBrowseProject={onOpenProjectFromSplash}
          onCreateNewProject={onCreateProjectFromSplash}
          onOpenRecentProject={onOpenRecentFromSplash}
        />
      ) : null}

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
        themeValue={uiState.settingsDraftTheme}
        themeOptions={themeOptions}
        customThemeValue={uiState.settingsDraftCustomThemeId}
        customThemeOptions={(settings.customThemes ?? [])
          .filter((theme) => theme.baseTheme === uiState.settingsDraftTheme)
          .map((theme) => ({
          value: theme.id,
          label: theme.name,
        }))}
        selectedCustomThemeName={selectedCustomThemeForDraft?.name ?? ''}
        selectedCustomThemeTokens={selectedCustomThemeForDraft?.tokens ?? {}}
        onThemeChange={onThemeDraftChange}
        onCustomThemeChange={onCustomThemeDraftChange}
        onCreateCustomTheme={onCreateCustomTheme}
        onImportCustomTheme={onImportCustomTheme}
        onExportCustomTheme={onExportCustomTheme}
        onRenameCustomTheme={onRenameCustomTheme}
        onDeleteCustomTheme={onDeleteCustomTheme}
        onCustomThemeTokenChange={onCustomThemeTokenChange}
        onCancel={onCancelSettingsDialog}
        onSave={onSaveSettings}
      />
    </motion.div>
  );
};

