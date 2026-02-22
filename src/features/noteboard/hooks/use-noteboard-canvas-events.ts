import React from 'react';
import type { MutableRefObject } from 'react';
import type { NoteboardBrushType, PersistedTreeState, UserSettings } from '../../../shared/types';
import {
  offsetFromWorldPointAtViewportPoint,
  worldPointFromClientPoint,
  worldPointFromViewportPoint,
} from '../../../shared/noteboard-coordinate-utils';
import { TESTO_IMAGE_ASSET_DRAG_MIME } from '../../../shared/drag-payloads';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  clampViewOffsets,
  getMinZoomForCanvas,
  getWorldPoint,
  type NoteboardView,
} from '../../../renderer/noteboard-utils';
import { createBrushStroke } from '../../../renderer/noteboard-drawing';
import {
  CONTEXT_MENU_HEIGHT,
  CONTEXT_MENU_WIDTH,
  MAX_DRAW_SIZE,
  MAX_ZOOM,
  type DragState,
  type DrawState,
  type DroppedCanvasPayload,
  type PanState,
  type ResizeState,
  type UiState,
  defaultSettings,
  ensureNoteboardData,
  estimateCardDimensionsFromText,
  getCardsForNode,
  getStrokesForNode,
  getViewForNode,
} from '../../app/app-model';
import { updateNodeNoteboardData } from '../../app/workspace-node-updaters';
import {
  NOTEBOARD_CANVAS_POINTER_BLOCKED_SELECTORS,
} from '../noteboard-dom-selectors';

type UseNoteboardCanvasEventsOptions = {
  nodeId: string;
  selectedView: NoteboardView;
  uiState: UiState;
  canvasRef: React.RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<PersistedTreeState>;
  settings: UserSettings;
  dragRef: MutableRefObject<DragState | null>;
  resizeRef: MutableRefObject<ResizeState | null>;
  panRef: MutableRefObject<PanState | null>;
  drawRef: MutableRefObject<DrawState | null>;
  setState: React.Dispatch<React.SetStateAction<PersistedTreeState>>;
  setUiState: React.Dispatch<React.SetStateAction<UiState>>;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  pushHistory: () => void;
  getBrushColor: () => string;
  eraseStrokesAtPoint: (
    prev: PersistedTreeState,
    nodeId: string,
    x: number,
    y: number,
    screenRadius: number,
    viewZoom: number,
  ) => PersistedTreeState;
  handleCanvasDrop: (
    nodeId: string,
    worldX: number,
    worldY: number,
    payload: DroppedCanvasPayload,
  ) => Promise<void>;
};

type UseNoteboardCanvasEventsResult = {
  onCanvasPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onCanvasWheel: (event: WheelEvent) => void;
  onCanvasContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onCanvasDrop: (event: React.DragEvent<HTMLElement>) => void;
  onStartDragCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onStartResizeCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
};

export const useNoteboardCanvasEvents = ({
  nodeId,
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
}: UseNoteboardCanvasEventsOptions): UseNoteboardCanvasEventsResult => {
  const onCanvasPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (uiState.contextMenu && !target.closest('.canvas-context-menu')) {
      setUiState((prev) => ({ ...prev, contextMenu: null }));
    }

    if (event.button === 1) {
      panRef.current = {
        pointerId: event.pointerId,
        nodeId,
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
      !target.closest(NOTEBOARD_CANVAS_POINTER_BLOCKED_SELECTORS)
    ) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
      pushHistory();

      const currentTool = settings.drawingTool ?? defaultSettings.drawingTool ?? 'brush';
      const activeTool = event.shiftKey && currentTool !== 'eraser' ? 'eraser' : currentTool;
      if (activeTool === 'eraser') {
        const eraserRadiusPx = Math.max(6, settings.drawingSize ?? defaultSettings.drawingSize ?? 10);
        setState((prev) => eraseStrokesAtPoint(prev, nodeId, world.x, world.y, eraserRadiusPx, selectedView.zoom));
        drawRef.current = { pointerId: event.pointerId, nodeId, tool: 'eraser', strokeId: null };
        document.body.classList.add('is-drawing-canvas');
      } else {
        const color = (settings.drawingColor ?? defaultSettings.drawingColor ?? '#1e1f24').trim() || getBrushColor();
        const size = Math.max(2, Math.min(MAX_DRAW_SIZE, settings.drawingSize ?? defaultSettings.drawingSize ?? 10));
        const opacity = Math.max(0.05, Math.min(1, settings.drawingOpacity ?? defaultSettings.drawingOpacity ?? 0.85));
        const activeBrush: NoteboardBrushType =
          currentTool === 'pen'
            ? 'pen'
            : (settings.drawingBrush ?? defaultSettings.drawingBrush ?? 'ink') === 'pen'
              ? 'ink'
              : settings.drawingBrush ?? defaultSettings.drawingBrush ?? 'ink';

        setState((prev) => {
          const next = ensureNoteboardData(prev, nodeId);
          const view = getViewForNode(next, nodeId);
          const stroke = createBrushStroke(world.x, world.y, activeBrush, color, size, opacity);
          drawRef.current = { pointerId: event.pointerId, nodeId, tool: activeTool, strokeId: stroke.id };
          document.body.classList.add('is-drawing-canvas');
          return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
            ...noteboard,
            cards: [...getCardsForNode(next, nodeId)],
            strokes: [...getStrokesForNode(next, nodeId), stroke],
            view: { ...view },
          }));
        });
      }

      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
        selectionBox: null,
        cardSelection: { nodeId, cardIds: [] },
      }));
      event.preventDefault();
      return;
    }

    if (
      event.button === 0 &&
      target.closest('.noteboard-canvas') &&
      !target.closest(NOTEBOARD_CANVAS_POINTER_BLOCKED_SELECTORS)
    ) {
      if (uiState.isDrawingMode) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
        cardSelection: { nodeId, cardIds: [] },
        selectionBox: {
          nodeId,
          pointerId: event.pointerId,
          startX: world.x,
          startY: world.y,
          currentX: world.x,
          currentY: world.y,
          additive: event.ctrlKey || event.metaKey,
          baseSelectedCardIds: prev.cardSelection.nodeId === nodeId ? prev.cardSelection.cardIds : [],
        },
      }));
      event.preventDefault();
    }
  }, [canvasRef, drawRef, eraseStrokesAtPoint, getBrushColor, nodeId, panRef, pushHistory, selectedView, setState, setUiState, settings, uiState.contextMenu, uiState.isDrawingMode]);

  const onCanvasWheel = React.useCallback((event: WheelEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest('.card-textarea')) return;

    if (uiState.isDrawingMode && event.shiftKey) {
      const direction = event.deltaY < 0 ? 1 : -1;
      const wheelSteps = Math.max(1, Math.round(Math.abs(event.deltaY) / 100));
      const sizeDelta = direction * wheelSteps * 3;
      setSettings((prev) => ({
        ...prev,
        drawingSize: Math.max(2, Math.min(MAX_DRAW_SIZE, (prev.drawingSize ?? defaultSettings.drawingSize ?? 10) + sizeDelta)),
      }));
      event.preventDefault();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const minZoom = getMinZoomForCanvas(canvas);
    const zoomDelta = event.deltaY < 0 ? 1.12 : 0.88;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(minZoom, selectedView.zoom * zoomDelta));
    if (nextZoom === selectedView.zoom) return;

    const rect = canvas.getBoundingClientRect();
    const worldElement = (canvas.querySelector(':scope > .noteboard-world') as HTMLElement | null) || (canvas.querySelector('.noteboard-world') as HTMLElement | null);
    const layoutOffsetX = worldElement?.offsetLeft ?? 0;
    const layoutOffsetY = worldElement?.offsetTop ?? 0;
    const pointerX = event.clientX - rect.left - layoutOffsetX;
    const pointerY = event.clientY - rect.top - layoutOffsetY;
    const worldPoint = worldPointFromViewportPoint(selectedView, pointerX, pointerY);

    setState((prev) => {
      const next = ensureNoteboardData(prev, nodeId);
      const nextView = { ...getViewForNode(next, nodeId) };
      nextView.zoom = nextZoom;
      const offset = offsetFromWorldPointAtViewportPoint(
        worldPoint,
        { x: pointerX, y: pointerY },
        nextZoom,
      );
      nextView.offsetX = offset.x;
      nextView.offsetY = offset.y;
      clampViewOffsets(canvas, nextView);
      return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
        ...noteboard,
        cards: [...getCardsForNode(next, nodeId)],
        view: nextView,
      }));
    });
    event.preventDefault();
  }, [canvasRef, nodeId, selectedView, setSettings, setState, uiState.isDrawingMode]);

  const onCanvasContextMenu = React.useCallback((event: React.MouseEvent<HTMLElement>): void => {
    if (uiState.isDrawingMode) {
      event.preventDefault();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.card-textarea, .noteboard-card, .noteboard-template-sidebar')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const worldPoint = worldPointFromClientPoint(canvas, selectedView, event.clientX, event.clientY);
    const screenX = Math.min(window.innerWidth - CONTEXT_MENU_WIDTH - 8, Math.max(8, event.clientX));
    const screenY = Math.min(window.innerHeight - CONTEXT_MENU_HEIGHT - 8, Math.max(8, event.clientY));
    setUiState((prev) => ({
      ...prev,
      contextMenu: { nodeId, screenX, screenY, worldX: worldPoint.x, worldY: worldPoint.y },
    }));
    event.preventDefault();
  }, [canvasRef, nodeId, selectedView, setUiState, uiState.isDrawingMode]);

  const onCanvasDrop = React.useCallback((event: React.DragEvent<HTMLElement>): void => {
    if (uiState.isDrawingMode) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const payload: DroppedCanvasPayload = {
      files: Array.from(event.dataTransfer.files),
      textPlain: event.dataTransfer.getData('text/plain') ?? '',
      textUriList: event.dataTransfer.getData('text/uri-list') ?? '',
      textHtml: event.dataTransfer.getData('text/html') ?? '',
      testoImageAsset: event.dataTransfer.getData(TESTO_IMAGE_ASSET_DRAG_MIME) ?? '',
    };
    const world = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
    void handleCanvasDrop(nodeId, world.x, world.y, payload);
  }, [canvasRef, handleCanvasDrop, nodeId, selectedView, uiState.isDrawingMode]);

  const onStartDragCard = React.useCallback((cardId: string, event: React.PointerEvent<HTMLElement>): void => {
    if (uiState.isDrawingMode) return;
    const cards = getCardsForNode(stateRef.current, nodeId);
    const card = cards.find((item) => item.id === cardId);
    const canvas = canvasRef.current;
    if (!card || !canvas) return;

    const current = uiState.cardSelection.nodeId === nodeId ? uiState.cardSelection.cardIds : [];
    const movingCardIds = current.includes(cardId) && current.length > 0 ? current : [cardId];
    const startPositions: Record<string, { x: number; y: number }> = {};
    movingCardIds.forEach((id) => {
      const selectedCard = cards.find((item) => item.id === id);
      if (selectedCard) startPositions[id] = { x: selectedCard.x, y: selectedCard.y };
    });

    const pointer = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
    pushHistory();
    dragRef.current = {
      pointerId: event.pointerId,
      nodeId,
      movingCardIds: Object.keys(startPositions),
      pointerStartX: pointer.x,
      pointerStartY: pointer.y,
      startPositions,
    };
    document.body.classList.add('is-dragging-card');
    setUiState((prev) => ({ ...prev, cardSelection: { nodeId, cardIds: movingCardIds } }));
    event.preventDefault();
    event.stopPropagation();
  }, [canvasRef, dragRef, nodeId, pushHistory, selectedView, setUiState, stateRef, uiState.cardSelection, uiState.isDrawingMode]);

  const onStartResizeCard = React.useCallback((cardId: string, event: React.PointerEvent<HTMLElement>): void => {
    if (uiState.isDrawingMode) return;
    const cards = getCardsForNode(stateRef.current, nodeId);
    const card = cards.find((item) => item.id === cardId);
    const canvas = canvasRef.current;
    if (!card || !canvas) return;
    const pointer = getWorldPoint(canvas, selectedView, event.clientX, event.clientY);
    const minSize = estimateCardDimensionsFromText(card.text);
    const minWidth = Math.max(CARD_MIN_WIDTH, minSize.width);
    const minHeight = Math.max(CARD_MIN_HEIGHT, minSize.height);
    const startWidth = Math.max(card.width, minWidth);
    const startHeight = Math.max(card.height, minHeight);
    pushHistory();
    resizeRef.current = {
      pointerId: event.pointerId,
      nodeId,
      cardId: card.id,
      startPointerX: pointer.x,
      startPointerY: pointer.y,
      startWidth,
      startHeight,
      startX: card.x,
      startY: card.y,
      minWidth,
      minHeight,
      lastWidth: startWidth,
      lastHeight: startHeight,
    };
    document.body.classList.add('is-resizing-card');
    event.preventDefault();
    event.stopPropagation();
  }, [canvasRef, nodeId, pushHistory, resizeRef, selectedView, stateRef, uiState.isDrawingMode]);

  return {
    onCanvasPointerDown,
    onCanvasWheel,
    onCanvasContextMenu,
    onCanvasDrop,
    onStartDragCard,
    onStartResizeCard,
  };
};
