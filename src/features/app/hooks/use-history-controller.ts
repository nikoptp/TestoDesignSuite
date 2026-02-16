import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createHistoryStack } from '../../../renderer/history-stack';
import type { PersistedTreeState } from '../../../shared/types';
import type {
  DragState,
  HistorySnapshot,
  PanState,
  QueuedDrawPoint,
  ResizeState,
  UiState,
} from '../app-model';

type UseHistoryControllerOptions = {
  maxEntries: number;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  stateRef: MutableRefObject<PersistedTreeState>;
  uiStateRef: MutableRefObject<UiState>;
  dragRef: MutableRefObject<DragState | null>;
  resizeRef: MutableRefObject<ResizeState | null>;
  panRef: MutableRefObject<PanState | null>;
  drawRef: MutableRefObject<{
    pointerId: number;
    nodeId: string;
    tool: 'pen' | 'brush' | 'eraser';
    strokeId: string | null;
  } | null>;
  drawPointQueueRef: MutableRefObject<QueuedDrawPoint[]>;
  drawRafRef: MutableRefObject<number | null>;
  textEditSessionsRef: MutableRefObject<Set<string>>;
  documentEditSessionsRef: MutableRefObject<Set<string>>;
};

type HistoryController = {
  pushHistory: () => void;
  undoHistory: () => void;
  redoHistory: () => void;
};

const deepCloneState = (input: PersistedTreeState): PersistedTreeState =>
  JSON.parse(JSON.stringify(input)) as PersistedTreeState;

export const useHistoryController = ({
  maxEntries,
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
}: UseHistoryControllerOptions): HistoryController => {
  const historyStackRef = React.useRef(createHistoryStack<HistorySnapshot>(maxEntries));

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
  }, [stateRef, uiStateRef]);

  const applyHistorySnapshot = React.useCallback(
    (snapshot: HistorySnapshot): void => {
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
    },
    [
      documentEditSessionsRef,
      dragRef,
      drawPointQueueRef,
      drawRafRef,
      drawRef,
      panRef,
      resizeRef,
      setState,
      setUiState,
      textEditSessionsRef,
    ],
  );

  const pushHistory = React.useCallback(() => {
    historyStackRef.current.push(captureHistorySnapshot());
  }, [captureHistorySnapshot]);

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

  return {
    pushHistory,
    undoHistory,
    redoHistory,
  };
};

