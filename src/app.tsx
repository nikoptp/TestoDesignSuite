import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  CreateProjectNodeRequest,
  KanbanPriority,
  LaunchState,
  PersistedTreeState,
  ProjectImageAsset,
  RecentProjectEntry,
  SteamAchievementBackgroundAdjustmentState,
  SteamAchievementBorderStyle,
  SteamAchievementEntryImageStyle,
  SteamAchievementTransform,
  SteamMarketplaceCropTransform,
  SteamMarketplaceOutputState,
  UserSettings,
} from './shared/types';
import {
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from './shared/noteboard-constants';
import {
  countDescendants,
  createNode,
  findNodeById,
  moveNodeById,
} from './shared/tree-utils';
import { useOutsidePointerDismiss } from './shared/hooks/use-outside-pointer-dismiss';
import { startWindowPointerSession } from './shared/pointer-session';
import { appendPointWithPressure } from './renderer/noteboard-drawing';
import { NodeTree, type NodeDropPosition } from './components/node-tree';
import { CreateNodeDialog, DeleteNodeDialog, SettingsDialog } from './components/dialogs';
import { EditorPanel } from './components/editor-panel';
import { NoteboardCanvas } from './components/noteboard-canvas';
import { DocumentEditor } from './components/document-editor';
import { KanbanBoard } from './components/kanban-board';
import { SpreadsheetEditor } from './components/spreadsheet-editor';
import { SteamAchievementArtEditor } from './components/steam-achievement-art-editor';
import { SteamMarketplaceAssetsEditor } from './components/steam-marketplace-assets-editor';
import { TerminalCommandCenterEditor } from './components/terminal-command-center-editor';
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
import { useSpreadsheetEditorActions } from './features/spreadsheet/hooks/use-spreadsheet-editor-actions';
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
  ensureSpreadsheetData,
  ensureSteamAchievementArtData,
  ensureSteamMarketplaceAssetsData,
  ensureTerminalCommandCenterData,
  getCardsForNode,
  getKanbanBoardForNode,
  getSpreadsheetForNode,
  getSteamAchievementArtForNode,
  getSteamMarketplaceAssetsForNode,
  getTerminalCommandCenterForNode,
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
import {
  updateNodeNoteboardData,
  updateNodeTerminalCommandCenterData,
  updateNodeSteamAchievementArtData,
  updateNodeSteamMarketplaceAssetsData,
} from './features/app/workspace-node-updaters';
import {
  clampSteamAchievementTransform,
  createDefaultSteamAchievementEntryImageStyle,
  createDefaultSteamAchievementTransform,
  createSteamAchievementEntry,
  deriveSteamAchievementNameFromPath,
  getSteamAchievementFrameRect,
  getSteamImagePreset,
  normalizeSteamAchievementArtData,
  normalizeSteamAchievementBackgroundAdjustmentState,
  normalizeSteamAchievementEntryName,
  normalizeSteamAchievementEntryImageStyle,
} from './features/steam-achievement/steam-achievement-art';
import {
  clampSteamMarketplaceCropTransform,
  createDefaultSteamMarketplaceCropTransform,
  createSteamMarketplaceEntry,
  deriveSteamMarketplaceNameFromPath,
  getSteamMarketplacePreset,
  normalizeSteamMarketplaceAssetData,
  normalizeSteamMarketplaceEntryName,
  STEAM_MARKETPLACE_PRESETS,
} from './features/steam-marketplace/steam-marketplace-assets';
import {
  normalizeExecutionFolder,
  normalizeTerminalCommandName,
  normalizeTerminalCommandString,
  normalizeTerminalPanelTitle,
} from './features/terminal-command-center/terminal-command-center';

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
  const spreadsheetEditSessionsRef = React.useRef<Set<string>>(new Set<string>());
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

  React.useEffect(() => {
    if (!window.testoApi?.onExternalNodeCreateRequest) {
      return;
    }
    return window.testoApi.onExternalNodeCreateRequest(({ request }) => {
      const input = request as CreateProjectNodeRequest;
      const snapshot = stateRef.current;
      const parentRef = input.parentId ?? null;
      if (parentRef && !findNodeById(snapshot.nodes, parentRef)) {
        return {
          ok: false,
          error: 'Parent node not found.',
        };
      }
      const nextNode = createNode(
        input.name?.trim() ? input.name.trim() : `Untitled Node ${snapshot.nextNodeNumber}`,
        input.editorType,
      );
      const createdNodeId = nextNode.id;
      setState((prev) => {
        const nextNodes = [...prev.nodes];
        if (!parentRef) {
          nextNodes.push(nextNode);
        } else {
          const parent = findNodeById(nextNodes, parentRef);
          if (!parent) {
            return prev;
          }
          parent.children.push(nextNode);
        }
        const nextNodeData = { ...prev.nodeDataById, [nextNode.id]: {} };
        if (input.editorType === 'story-document') {
          nextNodeData[nextNode.id] = {
            ...nextNodeData[nextNode.id],
            document: {
              markdown: typeof input.initialMarkdown === 'string' ? input.initialMarkdown : '',
            },
          };
        }
        return {
          ...prev,
          nodes: nextNodes,
          selectedNodeId: nextNode.id,
          nextNodeNumber: prev.nextNodeNumber + 1,
          nodeDataById: nextNodeData,
          collapsedNodeIds:
            parentRef === null
              ? prev.collapsedNodeIds ?? []
              : (prev.collapsedNodeIds ?? []).filter((id) => id !== parentRef),
        };
      });
      setUiState((prev) => ({
        ...prev,
        pendingCreateParentRef: null,
      }));
      return {
        ok: true,
        createdNodeId,
      };
    });
  }, [setState, setUiState]);

  useProjectSnapshotResponder(stateRef, settingsRef);

  useThemeRuntime(settings);
  const { projectStatus, showTransientProjectStatus, dismissProjectStatus } = useProjectStatusController();

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
    spreadsheetEditSessionsRef,
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

  const onRunUpdateFromStatus = React.useCallback((): void => {
    void window.testoApi?.checkForUpdates?.();
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

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'spreadsheet') {
      return;
    }

    setState((prev) => ensureSpreadsheetData(prev, selectedNode.id));
  }, [selectedNode]);

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
      return;
    }

    setState((prev) => ensureSteamAchievementArtData(prev, selectedNode.id));
  }, [selectedNode]);

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }

    setState((prev) => ensureSteamMarketplaceAssetsData(prev, selectedNode.id));
  }, [selectedNode]);

  React.useEffect(() => {
    if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
      return;
    }

    setState((prev) => ensureTerminalCommandCenterData(prev, selectedNode.id));
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
    selectedNode.editorType !== 'kanban-board' &&
    selectedNode.editorType !== 'spreadsheet' &&
    selectedNode.editorType !== 'steam-achievement-art' &&
    selectedNode.editorType !== 'steam-marketplace-assets' &&
    selectedNode.editorType !== 'terminal-command-center'
      ? getDocumentMarkdownForNode(state, selectedNode.id)
      : '';
  const selectedKanban =
    selectedNode && selectedNode.editorType === 'kanban-board'
      ? getKanbanBoardForNode(state, selectedNode.id)
      : null;
  const selectedSpreadsheet =
    selectedNode && selectedNode.editorType === 'spreadsheet'
      ? getSpreadsheetForNode(state, selectedNode.id)
      : null;
  const selectedSteamAchievementArt =
    selectedNode && selectedNode.editorType === 'steam-achievement-art'
      ? getSteamAchievementArtForNode(state, selectedNode.id)
      : null;
  const selectedSteamMarketplaceAssets =
    selectedNode && selectedNode.editorType === 'steam-marketplace-assets'
      ? getSteamMarketplaceAssetsForNode(state, selectedNode.id)
      : null;
  const selectedTerminalCommandCenter =
    selectedNode && selectedNode.editorType === 'terminal-command-center'
      ? getTerminalCommandCenterForNode(state, selectedNode.id)
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

  const {
    onSpreadsheetEditStart,
    onSpreadsheetEditEnd,
    onSpreadsheetActiveCellChange,
    onSpreadsheetCellChange,
    onSpreadsheetBatchChange,
    onSpreadsheetInsertRow,
    onSpreadsheetDeleteRow,
    onSpreadsheetInsertColumn,
    onSpreadsheetDeleteColumn,
    onSpreadsheetResizeRow,
    onSpreadsheetResizeColumn,
  } = useSpreadsheetEditorActions({
    nodeId: selectedNode?.id ?? '',
    spreadsheetEditSessionsRef,
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

  const onAddSteamAchievementEntry = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
      return;
    }

    pushHistory();
    setState((prev) =>
      updateNodeSteamAchievementArtData(
        ensureSteamAchievementArtData(prev, selectedNode.id),
        selectedNode.id,
        (steamAchievementArt) => ({
          ...steamAchievementArt,
          entries: [
            ...steamAchievementArt.entries,
            createSteamAchievementEntry(`achievement-${steamAchievementArt.entries.length + 1}`),
          ],
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onDeleteSteamAchievementEntry = React.useCallback(
    (entryId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.filter((entry) => entry.id !== entryId),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onRenameSteamAchievementEntry = React.useCallback(
    (entryId: string, name: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    name: normalizeSteamAchievementEntryName(name, ''),
                    updatedAt: Date.now(),
                  }
                : entry,
            ),
          }),
        ),
      );
    },
    [selectedNode],
  );

  const onAssignSteamAchievementAssetToEntry = React.useCallback(
    (entryId: string, relativePath: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    name:
                      entry.name.trim() && entry.name !== 'achievement'
                        ? entry.name
                        : deriveSteamAchievementNameFromPath(relativePath),
                    sourceImageRelativePath: relativePath,
                    crop: createDefaultSteamAchievementTransform(),
                    imageStyle: createDefaultSteamAchievementEntryImageStyle(),
                    updatedAt: Date.now(),
                  }
                : entry,
            ),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onCreateSteamAchievementEntryFromAsset = React.useCallback(
    (relativePath: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: [
              ...steamAchievementArt.entries,
              {
                ...createSteamAchievementEntry(deriveSteamAchievementNameFromPath(relativePath)),
                sourceImageRelativePath: relativePath,
                crop: createDefaultSteamAchievementTransform(),
                imageStyle: createDefaultSteamAchievementEntryImageStyle(),
                updatedAt: Date.now(),
              },
            ],
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onImportSteamAchievementFiles = React.useCallback(
    async (files: File[], target: 'entry' | 'background', targetEntryId?: string): Promise<void> => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }
      if (!window.testoApi?.saveImageAsset || files.length === 0) {
        return;
      }

      const savedEntries: Array<{ relativePath: string; name: string }> = [];
      for (const file of files) {
        if (!(file instanceof File)) {
          continue;
        }
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const saved = await window.testoApi.saveImageAsset({
            bytes,
            mimeType: file.type || 'image/png',
          });
          savedEntries.push({
            relativePath: saved.relativePath,
            name: deriveSteamAchievementNameFromPath(file.name),
          });
        } catch {
          // Ignore individual image import failures and keep processing the batch.
        }
      }

      if (savedEntries.length === 0) {
        showTransientProjectStatus('error', 'Unable to import any dropped images.');
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => {
            if (target === 'background') {
              return {
                ...steamAchievementArt,
                backgroundAssetRelativePaths: [
                  ...new Set([
                    ...(steamAchievementArt.backgroundAssetRelativePaths ?? []),
                    ...savedEntries.map((entry) => entry.relativePath),
                  ]),
                ],
                borderStyle: {
                  ...steamAchievementArt.borderStyle,
                  backgroundImageRelativePath: savedEntries[0]?.relativePath ?? null,
                  backgroundMode: savedEntries[0] ? 'image' : steamAchievementArt.borderStyle.backgroundMode,
                },
              };
            }
            const shouldReplaceTarget = Boolean(targetEntryId && savedEntries.length === 1);
            const nextEntries = shouldReplaceTarget
              ? steamAchievementArt.entries.map((entry) =>
                  entry.id === targetEntryId
                    ? {
                        ...entry,
                        name: entry.name.trim() ? entry.name : savedEntries[0].name,
                        sourceImageRelativePath: savedEntries[0].relativePath,
                        crop: createDefaultSteamAchievementTransform(),
                        imageStyle: createDefaultSteamAchievementEntryImageStyle(),
                        updatedAt: Date.now(),
                      }
                    : entry,
                )
              : [
                  ...steamAchievementArt.entries,
                  ...savedEntries.map((savedEntry) => ({
                    ...createSteamAchievementEntry(savedEntry.name),
                    name: savedEntry.name,
                    sourceImageRelativePath: savedEntry.relativePath,
                    crop: createDefaultSteamAchievementTransform(),
                    imageStyle: createDefaultSteamAchievementEntryImageStyle(),
                    updatedAt: Date.now(),
                  })),
                ];

            return {
              ...steamAchievementArt,
              entries: nextEntries,
            };
          },
        ),
      );
      await refreshImageAssets();
      showTransientProjectStatus(
        'success',
        target === 'background'
          ? `Imported ${savedEntries.length} background image${savedEntries.length === 1 ? '' : 's'} for the achievement frame.`
          : `Imported ${savedEntries.length} image${savedEntries.length === 1 ? '' : 's'} into the achievement set.`,
      );
    },
    [pushHistory, refreshImageAssets, selectedNode, showTransientProjectStatus],
  );

  const onAssignSteamAchievementBackgroundAsset = React.useCallback(
    (relativePath: string | null): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            backgroundAssetRelativePaths:
              relativePath
                ? [...new Set([...(steamAchievementArt.backgroundAssetRelativePaths ?? []), relativePath])]
                : steamAchievementArt.backgroundAssetRelativePaths ?? [],
            borderStyle: {
              ...steamAchievementArt.borderStyle,
              backgroundImageRelativePath: relativePath,
              backgroundMode: relativePath ? 'image' : 'none',
            },
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onRemoveSteamAchievementBackgroundAsset = React.useCallback(
    (relativePath: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            backgroundAssetRelativePaths: (steamAchievementArt.backgroundAssetRelativePaths ?? []).filter(
              (path) => path !== relativePath,
            ),
            borderStyle:
              steamAchievementArt.borderStyle.backgroundImageRelativePath === relativePath
                ? {
                    ...steamAchievementArt.borderStyle,
                    backgroundImageRelativePath: null,
                    backgroundMode: 'none',
                  }
                : steamAchievementArt.borderStyle,
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onBeginSteamAchievementCropInteraction = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
      return;
    }
    pushHistory();
  }, [pushHistory, selectedNode]);

  const onChangeSteamAchievementCrop = React.useCallback(
    (entryId: string, transform: SteamAchievementTransform): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      const preset = getSteamImagePreset(selectedSteamAchievementArt?.presetId ?? '');
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.map((entry) => {
              if (entry.id !== entryId) {
                return entry;
              }
              const asset = imageAssets.find(
                (candidate) => candidate.relativePath === entry.sourceImageRelativePath,
              );
              if (!asset) {
                return {
                  ...entry,
                  crop: transform,
                  updatedAt: Date.now(),
                };
              }
              const frameRect = getSteamAchievementFrameRect(
                preset.width,
                preset.height,
                steamAchievementArt.borderStyle,
              );
              return {
                ...entry,
                crop: clampSteamAchievementTransform(
                  asset.width,
                  asset.height,
                  {
                    ...preset,
                    width: frameRect.width,
                    height: frameRect.height,
                  },
                  transform,
                ),
                updatedAt: Date.now(),
              };
            }),
          }),
        ),
      );
    },
    [imageAssets, selectedNode, selectedSteamAchievementArt],
  );

  const onResetSteamAchievementCrop = React.useCallback(
    (entryId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }
      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    crop: createDefaultSteamAchievementTransform(),
                    updatedAt: Date.now(),
                  }
                : entry,
            ),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onChangeSteamAchievementBorderStyle = React.useCallback(
    (patch: Partial<SteamAchievementBorderStyle>): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            borderStyle: {
              ...steamAchievementArt.borderStyle,
              ...patch,
            },
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onExportSteamAchievementSet = React.useCallback(async (): Promise<void> => {
    if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art' || !selectedSteamAchievementArt) {
      return;
    }
    if (!window.testoApi?.exportSteamAchievementSet) {
      showTransientProjectStatus('error', 'Steam achievement export is not available in this build.');
      return;
    }

    const result = await window.testoApi.exportSteamAchievementSet({
      nodeName: selectedNode.name,
      data: normalizeSteamAchievementArtData(selectedSteamAchievementArt),
    });
    if (result.canceled) {
      showTransientProjectStatus('info', 'Achievement export canceled.');
    }
  }, [selectedNode, selectedSteamAchievementArt, showTransientProjectStatus]);

  const onAddSteamMarketplaceEntry = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: [
            ...steamMarketplaceAssets.entries,
            createSteamMarketplaceEntry(`asset-${steamMarketplaceAssets.entries.length + 1}`),
          ],
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onChangeSteamAchievementBackgroundAdjustments = React.useCallback(
    (patch: Partial<SteamAchievementBackgroundAdjustmentState>): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            backgroundAdjustments: normalizeSteamAchievementBackgroundAdjustmentState({
              ...steamAchievementArt.backgroundAdjustments,
              ...patch,
            }),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onChangeSteamAchievementEntryImageStyle = React.useCallback(
    (entryId: string, patch: Partial<SteamAchievementEntryImageStyle>): void => {
      if (!selectedNode || selectedNode.editorType !== 'steam-achievement-art') {
        return;
      }

      pushHistory();
      setState((prev) =>
        updateNodeSteamAchievementArtData(
          ensureSteamAchievementArtData(prev, selectedNode.id),
          selectedNode.id,
          (steamAchievementArt) => ({
            ...steamAchievementArt,
            entries: steamAchievementArt.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    imageStyle: normalizeSteamAchievementEntryImageStyle({
                      ...entry.imageStyle,
                      ...patch,
                      adjustments: {
                        ...entry.imageStyle.adjustments,
                        ...(patch.adjustments ?? {}),
                      },
                      shadow: {
                        ...entry.imageStyle.shadow,
                        ...(patch.shadow ?? {}),
                      },
                    }),
                    updatedAt: Date.now(),
                  }
                : entry,
            ),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onDeleteSteamMarketplaceEntry = React.useCallback((entryId: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.filter((entry) => entry.id !== entryId),
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onRenameSteamMarketplaceEntry = React.useCallback((entryId: string, name: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  name: normalizeSteamMarketplaceEntryName(name),
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [selectedNode]);

  const onSetSteamMarketplaceEntryPreset = React.useCallback((entryId: string, presetId: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  presetId,
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [selectedNode]);

  const onAssignSteamMarketplaceBaseAssetToEntry = React.useCallback((entryId: string, relativePath: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  name:
                    entry.name.trim() && entry.name !== 'marketplace-asset'
                      ? entry.name
                      : deriveSteamMarketplaceNameFromPath(relativePath),
                  sourceImageRelativePath: relativePath,
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onAssignSteamMarketplaceLogoAssetToEntry = React.useCallback((entryId: string, relativePath: string | null): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          logoAssetRelativePaths:
            relativePath
              ? [...new Set([...(steamMarketplaceAssets.logoAssetRelativePaths ?? []), relativePath])]
              : steamMarketplaceAssets.logoAssetRelativePaths ?? [],
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  logoImageRelativePath: relativePath,
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onRemoveSteamMarketplaceLogoAsset = React.useCallback((relativePath: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          logoAssetRelativePaths: (steamMarketplaceAssets.logoAssetRelativePaths ?? []).filter(
            (path) => path !== relativePath,
          ),
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.logoImageRelativePath === relativePath
              ? {
                  ...entry,
                  logoImageRelativePath: null,
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onCreateSteamMarketplaceEntryFromAsset = React.useCallback((relativePath: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: [
            ...steamMarketplaceAssets.entries,
            {
              ...createSteamMarketplaceEntry(deriveSteamMarketplaceNameFromPath(relativePath)),
              sourceImageRelativePath: relativePath,
              updatedAt: Date.now(),
            },
          ],
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onCreateAllSteamMarketplaceTemplates = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => {
          const existingNames = new Set(
            steamMarketplaceAssets.entries.map((entry) => entry.name.trim().toLowerCase()),
          );
          const missingEntries = STEAM_MARKETPLACE_PRESETS.filter(
            (preset) => !existingNames.has(preset.label.trim().toLowerCase()),
          ).map((preset) => ({
            ...createSteamMarketplaceEntry(preset.label),
            name: preset.label,
            presetId: preset.id,
          }));

          if (missingEntries.length === 0) {
            return steamMarketplaceAssets;
          }

          return {
            ...steamMarketplaceAssets,
            entries: [...steamMarketplaceAssets.entries, ...missingEntries],
          };
        },
      ),
    );
  }, [pushHistory, selectedNode]);

  const onImportSteamMarketplaceFiles = React.useCallback(async (
    files: File[],
    target: 'base' | 'logo',
    targetEntryId?: string,
  ): Promise<void> => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    if (!window.testoApi?.saveImageAsset || files.length === 0) {
      return;
    }

    const savedEntries: Array<{ relativePath: string; name: string }> = [];
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const saved = await window.testoApi.saveImageAsset({
          bytes,
          mimeType: file.type || 'image/png',
        });
        savedEntries.push({
          relativePath: saved.relativePath,
          name: deriveSteamMarketplaceNameFromPath(file.name),
        });
      } catch {
        // Ignore individual import failure and continue the batch.
      }
    }

    if (savedEntries.length === 0) {
      showTransientProjectStatus('error', 'Unable to import any dropped marketplace images.');
      return;
    }

    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => {
          const shouldReplaceTarget = Boolean(targetEntryId && savedEntries.length === 1);
          if (target === 'logo' && targetEntryId) {
            return {
              ...steamMarketplaceAssets,
              logoAssetRelativePaths: [
                ...new Set([
                  ...(steamMarketplaceAssets.logoAssetRelativePaths ?? []),
                  ...savedEntries.map((savedEntry) => savedEntry.relativePath),
                ]),
              ],
              entries: steamMarketplaceAssets.entries.map((entry) =>
                entry.id === targetEntryId
                  ? {
                      ...entry,
                      logoImageRelativePath: savedEntries[0].relativePath,
                      updatedAt: Date.now(),
                    }
                  : entry,
              ),
            };
          }

          const nextEntries = shouldReplaceTarget
            ? steamMarketplaceAssets.entries.map((entry) =>
                entry.id === targetEntryId
                  ? {
                      ...entry,
                      name: entry.name.trim() ? entry.name : savedEntries[0].name,
                      sourceImageRelativePath: savedEntries[0].relativePath,
                      updatedAt: Date.now(),
                    }
                  : entry,
              )
            : [
                ...steamMarketplaceAssets.entries,
                ...savedEntries.map((savedEntry) => ({
                  ...createSteamMarketplaceEntry(savedEntry.name),
                  name: savedEntry.name,
                  sourceImageRelativePath: savedEntry.relativePath,
                  updatedAt: Date.now(),
                })),
              ];

          return {
            ...steamMarketplaceAssets,
            entries: nextEntries,
          };
        },
      ),
    );
    await refreshImageAssets();
    showTransientProjectStatus(
      'success',
      `Imported ${savedEntries.length} image${savedEntries.length === 1 ? '' : 's'} into the marketplace asset set.`,
    );
  }, [pushHistory, refreshImageAssets, selectedNode, showTransientProjectStatus]);

  const onBeginSteamMarketplaceCropInteraction = React.useCallback((): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
  }, [pushHistory, selectedNode]);

  const onChangeSteamMarketplaceCrop = React.useCallback((
    entryId: string,
    presetId: string,
    transform: SteamMarketplaceCropTransform,
  ): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    const preset = getSteamMarketplacePreset(presetId);
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) => {
            if (entry.id !== entryId) {
              return entry;
            }
            const asset = imageAssets.find((candidate) => candidate.relativePath === entry.sourceImageRelativePath);
            const currentOutput = entry.outputsByPresetId[presetId];
            const nextTransform = asset
              ? clampSteamMarketplaceCropTransform(asset.width, asset.height, preset, transform)
              : transform;
            if (
              currentOutput &&
              currentOutput.crop.zoom === nextTransform.zoom &&
              currentOutput.crop.offsetX === nextTransform.offsetX &&
              currentOutput.crop.offsetY === nextTransform.offsetY
            ) {
              return entry;
            }
            return {
              ...entry,
              outputsByPresetId: {
                ...entry.outputsByPresetId,
                [presetId]: {
                  ...currentOutput,
                  crop: nextTransform,
                },
              },
              updatedAt: Date.now(),
            };
          }),
        }),
      ),
    );
  }, [imageAssets, selectedNode]);

  const onPatchSteamMarketplaceOutput = React.useCallback((entryId: string, presetId: string, patch: Partial<SteamMarketplaceOutputState>): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  outputsByPresetId: {
                    ...entry.outputsByPresetId,
                    [presetId]: {
                      ...entry.outputsByPresetId[presetId],
                      ...patch,
                    },
                  },
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [selectedNode]);

  const onPatchSteamMarketplaceSharedAdjustments = React.useCallback((
    entryId: string,
    patch: { overlays: Partial<SteamMarketplaceOutputState['overlays']> },
  ): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  outputsByPresetId: Object.fromEntries(
                    Object.entries(entry.outputsByPresetId).map(([presetId, output]) => {
                      const preset = getSteamMarketplacePreset(presetId);
                      if (preset.kind !== 'image') {
                        return [presetId, output];
                      }
                      return [
                        presetId,
                        {
                          ...output,
                          ...patch,
                          overlays: {
                            ...output.overlays,
                            ...patch.overlays,
                          },
                        },
                      ];
                    }),
                  ),
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [selectedNode]);

  const onResetSteamMarketplaceCrop = React.useCallback((entryId: string, presetId: string): void => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets') {
      return;
    }
    pushHistory();
    setState((prev) =>
      updateNodeSteamMarketplaceAssetsData(
        ensureSteamMarketplaceAssetsData(prev, selectedNode.id),
        selectedNode.id,
        (steamMarketplaceAssets) => ({
          ...steamMarketplaceAssets,
          entries: steamMarketplaceAssets.entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  outputsByPresetId: {
                    ...entry.outputsByPresetId,
                    [presetId]: {
                      ...entry.outputsByPresetId[presetId],
                      crop: createDefaultSteamMarketplaceCropTransform(),
                    },
                  },
                  updatedAt: Date.now(),
                }
              : entry,
          ),
        }),
      ),
    );
  }, [pushHistory, selectedNode]);

  const onExportSteamMarketplaceAssets = React.useCallback(async (): Promise<void> => {
    if (!selectedNode || selectedNode.editorType !== 'steam-marketplace-assets' || !selectedSteamMarketplaceAssets) {
      return;
    }
    if (!window.testoApi?.exportSteamMarketplaceAssets) {
      showTransientProjectStatus('error', 'Steam marketplace export is not available in this build.');
      return;
    }
    const result = await window.testoApi.exportSteamMarketplaceAssets({
      nodeName: selectedNode.name,
      data: normalizeSteamMarketplaceAssetData(selectedSteamMarketplaceAssets),
    });
    if (result.canceled) {
      showTransientProjectStatus('info', 'Steam marketplace export canceled.');
    }
  }, [selectedNode, selectedSteamMarketplaceAssets, showTransientProjectStatus]);

  const onCreateTerminalCommand = React.useCallback(
    (input: { id: string; name: string; command: string; executionFolder: string }): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      pushHistory();
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            commands: [
              ...terminalCommandCenter.commands,
              {
                id: input.id,
                name: normalizeTerminalCommandName(input.name),
                command: normalizeTerminalCommandString(input.command),
                executionFolder: normalizeExecutionFolder(input.executionFolder),
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onPatchTerminalCommand = React.useCallback(
    (
      commandId: string,
      patch: Partial<{ name: string; command: string; executionFolder: string }>,
    ): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            commands: terminalCommandCenter.commands.map((command) =>
              command.id === commandId
                ? {
                    ...command,
                    name:
                      typeof patch.name === 'string'
                        ? normalizeTerminalCommandName(patch.name)
                        : command.name,
                    command:
                      typeof patch.command === 'string'
                        ? normalizeTerminalCommandString(patch.command)
                        : command.command,
                    executionFolder:
                      typeof patch.executionFolder === 'string'
                        ? normalizeExecutionFolder(patch.executionFolder)
                        : command.executionFolder,
                    updatedAt: Date.now(),
                  }
                : command,
            ),
          }),
        ),
      );
    },
    [selectedNode],
  );

  const onDeleteTerminalCommand = React.useCallback(
    (commandId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      pushHistory();
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            commands: terminalCommandCenter.commands.filter((command) => command.id !== commandId),
          }),
        ),
      );
    },
    [pushHistory, selectedNode],
  );

  const onCreateTerminalPanel = React.useCallback(
    (input: {
      id: string;
      title: string;
      x: number;
      y: number;
      width: number;
      height: number;
      defaultExecutionFolder: string | null;
    }): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            panels: [
              ...terminalCommandCenter.panels,
              {
                ...input,
                title: normalizeTerminalPanelTitle(input.title),
                defaultExecutionFolder:
                  typeof input.defaultExecutionFolder === 'string' && input.defaultExecutionFolder.trim()
                    ? input.defaultExecutionFolder.trim()
                    : null,
              },
            ],
          }),
        ),
      );
    },
    [selectedNode],
  );

  const onPatchTerminalPanel = React.useCallback(
    (
      panelId: string,
      patch: Partial<{
        title: string;
        x: number;
        y: number;
        width: number;
        height: number;
        defaultExecutionFolder: string | null;
      }>,
    ): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            panels: terminalCommandCenter.panels.map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    title:
                      typeof patch.title === 'string'
                        ? normalizeTerminalPanelTitle(patch.title)
                        : panel.title,
                    x: typeof patch.x === 'number' && Number.isFinite(patch.x) ? Math.round(patch.x) : panel.x,
                    y: typeof patch.y === 'number' && Number.isFinite(patch.y) ? Math.round(patch.y) : panel.y,
                    width:
                      typeof patch.width === 'number' && Number.isFinite(patch.width)
                        ? patch.width
                        : panel.width,
                    height:
                      typeof patch.height === 'number' && Number.isFinite(patch.height)
                        ? patch.height
                        : panel.height,
                    defaultExecutionFolder:
                      patch.defaultExecutionFolder === null
                        ? null
                        : typeof patch.defaultExecutionFolder === 'string'
                          ? normalizeExecutionFolder(patch.defaultExecutionFolder)
                          : panel.defaultExecutionFolder,
                  }
                : panel,
            ),
          }),
        ),
      );
    },
    [selectedNode],
  );

  const onDeleteTerminalPanel = React.useCallback(
    (panelId: string): void => {
      if (!selectedNode || selectedNode.editorType !== 'terminal-command-center') {
        return;
      }
      setState((prev) =>
        updateNodeTerminalCommandCenterData(
          ensureTerminalCommandCenterData(prev, selectedNode.id),
          selectedNode.id,
          (terminalCommandCenter) => ({
            ...terminalCommandCenter,
            panels: terminalCommandCenter.panels.filter((panel) => panel.id !== panelId),
          }),
        ),
      );
    },
    [selectedNode],
  );

  const isUpdateProgressVisible =
    projectStatus?.action === 'update' &&
    (projectStatus.updatePhase === 'downloading' ||
      projectStatus.updatePhase === 'verifying' ||
      projectStatus.updatePhase === 'installing') &&
    projectStatus.progressMode === 'indeterminate';

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
            <div className="project-status-main">
              <span className="project-status-message">{projectStatus.message}</span>
              {isUpdateProgressVisible ? (
                <span className="project-status-progress" aria-hidden="true">
                  <span className="project-status-spinner"></span>
                  <span className="project-status-progress-track">
                    <span className="project-status-progress-bar"></span>
                  </span>
                </span>
              ) : null}
            </div>
            {projectStatus.persistent &&
            projectStatus.action === 'update' &&
            projectStatus.updatePhase === 'available' ? (
              <span className="project-status-actions">
                <button
                  type="button"
                  className="project-status-update-button"
                  onClick={onRunUpdateFromStatus}
                >
                  Update
                </button>
                <button
                  type="button"
                  className="project-status-dismiss-button"
                  onClick={dismissProjectStatus}
                  aria-label="Dismiss update notification"
                  title="Dismiss"
                >
                  X
                </button>
              </span>
            ) : null}
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
          ) : selectedNode && selectedNode.editorType === 'spreadsheet' && selectedSpreadsheet ? (
            <motion.div
              key={`spreadsheet-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <SpreadsheetEditor
                node={selectedNode}
                spreadsheet={selectedSpreadsheet}
                onEditStart={onSpreadsheetEditStart}
                onEditEnd={onSpreadsheetEditEnd}
                onActiveCellChange={onSpreadsheetActiveCellChange}
                onCellChange={onSpreadsheetCellChange}
                onBatchChange={onSpreadsheetBatchChange}
                onInsertRow={onSpreadsheetInsertRow}
                onDeleteRow={onSpreadsheetDeleteRow}
                onInsertColumn={onSpreadsheetInsertColumn}
                onDeleteColumn={onSpreadsheetDeleteColumn}
                onResizeRow={onSpreadsheetResizeRow}
                onResizeColumn={onSpreadsheetResizeColumn}
              />
            </motion.div>
          ) : selectedNode &&
            selectedNode.editorType === 'steam-achievement-art' &&
            selectedSteamAchievementArt ? (
            <motion.div
              key={`steam-achievement-art-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <SteamAchievementArtEditor
                node={selectedNode}
                art={selectedSteamAchievementArt}
                assets={imageAssets}
                onAddEntry={onAddSteamAchievementEntry}
                onDeleteEntry={onDeleteSteamAchievementEntry}
                onRenameEntry={onRenameSteamAchievementEntry}
                onAssignAssetToEntry={onAssignSteamAchievementAssetToEntry}
                onCreateEntryFromAsset={onCreateSteamAchievementEntryFromAsset}
                onImportFiles={onImportSteamAchievementFiles}
                onBeginCropInteraction={onBeginSteamAchievementCropInteraction}
                onCropChange={onChangeSteamAchievementCrop}
                onResetCrop={onResetSteamAchievementCrop}
                onBorderStyleChange={onChangeSteamAchievementBorderStyle}
                onBackgroundAdjustmentsChange={onChangeSteamAchievementBackgroundAdjustments}
                onEntryImageStyleChange={onChangeSteamAchievementEntryImageStyle}
                onAssignBackgroundAsset={onAssignSteamAchievementBackgroundAsset}
                onRemoveBackgroundAsset={onRemoveSteamAchievementBackgroundAsset}
                onExport={onExportSteamAchievementSet}
                onDeleteImageAsset={onDeleteImageAsset}
              />
            </motion.div>
          ) : selectedNode &&
            selectedNode.editorType === 'steam-marketplace-assets' &&
            selectedSteamMarketplaceAssets ? (
            <motion.div
              key={`steam-marketplace-assets-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <SteamMarketplaceAssetsEditor
                node={selectedNode}
                data={selectedSteamMarketplaceAssets}
                assets={imageAssets}
                onAddEntry={onAddSteamMarketplaceEntry}
                onDeleteEntry={onDeleteSteamMarketplaceEntry}
                onRenameEntry={onRenameSteamMarketplaceEntry}
                onSetEntryPreset={onSetSteamMarketplaceEntryPreset}
                onAssignBaseAssetToEntry={onAssignSteamMarketplaceBaseAssetToEntry}
                onAssignLogoAssetToEntry={onAssignSteamMarketplaceLogoAssetToEntry}
                onRemoveLogoAsset={onRemoveSteamMarketplaceLogoAsset}
                onCreateEntryFromAsset={onCreateSteamMarketplaceEntryFromAsset}
                onImportFiles={onImportSteamMarketplaceFiles}
                onCreateAllTemplates={onCreateAllSteamMarketplaceTemplates}
                onBeginCropInteraction={onBeginSteamMarketplaceCropInteraction}
                onCropChange={onChangeSteamMarketplaceCrop}
                onOutputPatch={onPatchSteamMarketplaceOutput}
                onSharedAdjustmentPatch={onPatchSteamMarketplaceSharedAdjustments}
                onResetCrop={onResetSteamMarketplaceCrop}
                onExport={onExportSteamMarketplaceAssets}
                onDeleteImageAsset={onDeleteImageAsset}
              />
            </motion.div>
          ) : selectedNode &&
            selectedNode.editorType === 'terminal-command-center' &&
            selectedTerminalCommandCenter ? (
            <motion.div
              key={`terminal-command-center-${selectedNode.id}`}
              className="main-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <TerminalCommandCenterEditor
                node={selectedNode}
                data={selectedTerminalCommandCenter}
                onCreateCommand={onCreateTerminalCommand}
                onPatchCommand={onPatchTerminalCommand}
                onDeleteCommand={onDeleteTerminalCommand}
                onCreatePanel={onCreateTerminalPanel}
                onPatchPanel={onPatchTerminalPanel}
                onDeletePanel={onDeleteTerminalPanel}
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

