import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState } from '../../../shared/types';
import {
  type DrawState,
  type DragState,
  type PanState,
  type QueuedDrawPoint,
  type ResizeState,
  type UiState,
  CARD_MAX_HEIGHT,
  CARD_MAX_WIDTH,
  ensureNoteboardData,
  getCardsForNode,
  getViewForNode,
} from '../../app/app-model';
import { NOTEBOARD_WORLD_MAX_X, NOTEBOARD_WORLD_MAX_Y, NOTEBOARD_WORLD_MIN_X, NOTEBOARD_WORLD_MIN_Y } from '../../../shared/noteboard-constants';
import { CANVAS_PADDING, CARD_MIN_HEIGHT, CARD_WIDTH, clampViewOffsets, getWorldPoint } from '../../../renderer/noteboard-utils';
import { updateNodeNoteboardData } from '../../app/workspace-node-updaters';

type UseNoteboardPointerEventsOptions = {
  canvasRef: React.RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<PersistedTreeState>;
  uiStateRef: MutableRefObject<UiState>;
  dragRef: MutableRefObject<DragState | null>;
  resizeRef: MutableRefObject<ResizeState | null>;
  panRef: MutableRefObject<PanState | null>;
  drawRef: MutableRefObject<DrawState | null>;
  drawPointQueueRef: MutableRefObject<QueuedDrawPoint[]>;
  drawRafRef: MutableRefObject<number | null>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  flushQueuedDrawPoints: () => void;
  eraseStrokesAtPoint: (
    prev: PersistedTreeState,
    nodeId: string,
    x: number,
    y: number,
    screenRadius: number,
    viewZoom: number,
  ) => PersistedTreeState;
};

export const useNoteboardPointerEvents = ({
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
}: UseNoteboardPointerEventsOptions): void => {
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
            return !(cardMaxX < minX || cardMinX > maxX || cardMaxY < minY || cardMinY > maxY);
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

          return updateNodeNoteboardData(next, pan.nodeId, (noteboard) => ({
            ...noteboard,
            cards: [...getCardsForNode(next, pan.nodeId)],
            view,
          }));
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

        const currentView = getViewForNode(stateRef.current, resize.nodeId);
        const world = getWorldPoint(canvas, currentView, event.clientX, event.clientY);
        const deltaX = world.x - resize.startPointerX;
        const deltaY = world.y - resize.startPointerY;
        const maxWidthByWorld = NOTEBOARD_WORLD_MAX_X - CANVAS_PADDING - resize.startX;
        const maxHeightByWorld = NOTEBOARD_WORLD_MAX_Y - CANVAS_PADDING - resize.startY;
        const nextWidth = Math.max(
          resize.minWidth,
          Math.min(CARD_MAX_WIDTH, maxWidthByWorld, resize.startWidth + deltaX),
        );
        const nextHeight = Math.max(
          resize.minHeight,
          Math.min(CARD_MAX_HEIGHT, maxHeightByWorld, resize.startHeight + deltaY),
        );

        if (
          Math.abs(resize.lastWidth - nextWidth) < 0.01 &&
          Math.abs(resize.lastHeight - nextHeight) < 0.01
        ) {
          event.preventDefault();
          return;
        }

        resize.lastWidth = nextWidth;
        resize.lastHeight = nextHeight;

        setState((prev) => {
          const cards = getCardsForNode(prev, resize.nodeId);
          const target = cards.find((card) => card.id === resize.cardId);
          if (!target) {
            event.preventDefault();
            return prev;
          }
          if (
            Math.abs(target.width - nextWidth) < 0.01 &&
            Math.abs(target.height - nextHeight) < 0.01
          ) {
            event.preventDefault();
            return prev;
          }

          const updatedCards = cards.map((card) =>
            card.id === resize.cardId
              ? {
                  ...card,
                  width: nextWidth,
                  height: nextHeight,
                }
              : card,
          );

          return updateNodeNoteboardData(prev, resize.nodeId, (noteboard) => ({
            ...noteboard,
            cards: updatedCards,
            view: { ...getViewForNode(prev, resize.nodeId) },
          }));
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

        return updateNodeNoteboardData(next, drag.nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...view },
        }));
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
  }, [
    canvasRef,
    drawPointQueueRef,
    drawRafRef,
    drawRef,
    dragRef,
    eraseStrokesAtPoint,
    flushQueuedDrawPoints,
    panRef,
    resizeRef,
    setState,
    setUiState,
    stateRef,
    uiStateRef,
  ]);
};
