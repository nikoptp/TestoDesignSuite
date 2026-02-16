import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState } from '../../../shared/types';
import { findNodeById } from '../../../shared/tree-utils';
import {
  type AppClipboard,
  type UiState,
  ensureNoteboardData,
  getCardsForNode,
  getViewForNode,
  isTextEntryTargetElement,
  normalizeClipboardText,
} from '../../app/app-model';

const NOTEBOARD_CARDS_CLIPBOARD_MARKER = '__testo_noteboard_cards__';

type UseNoteboardKeyboardShortcutsOptions = {
  stateRef: MutableRefObject<PersistedTreeState>;
  uiStateRef: MutableRefObject<UiState>;
  drawRef: MutableRefObject<{
    pointerId: number;
    nodeId: string;
    tool: 'brush' | 'eraser' | 'pen';
    strokeId: string | null;
  } | null>;
  drawPointQueueRef: MutableRefObject<Array<{ x: number; y: number; at: number; pressure?: number }>>;
  drawRafRef: MutableRefObject<number | null>;
  clipboardRef: MutableRefObject<AppClipboard>;
  documentQuickUndoNodeIdRef: MutableRefObject<string | null>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  pushHistory: () => void;
  undoHistory: () => void;
  redoHistory: () => void;
};

type UseNoteboardPasteShortcutOptions = {
  stateRef: MutableRefObject<PersistedTreeState>;
  clipboardRef: MutableRefObject<AppClipboard>;
  getCanvasCenterWorldPoint: (nodeId: string) => { x: number; y: number } | null;
  extractImageBlobFromClipboardData: (clipboardData: DataTransfer | null) => Blob | null;
  createImageCardAtWorldPoint: (
    nodeId: string,
    worldX: number,
    worldY: number,
    blob: Blob,
  ) => Promise<boolean>;
  createTextCardAtWorldPoint: (nodeId: string, worldX: number, worldY: number, text: string) => boolean;
  pasteCopiedCardsAtCanvasCenter: (nodeId: string) => boolean;
};

export const useNoteboardKeyboardShortcuts = ({
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
}: UseNoteboardKeyboardShortcutsOptions): void => {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const isTextEntryTarget = isTextEntryTargetElement(event.target);
      const activeNode = findNodeById(stateRef.current.nodes, stateRef.current.selectedNodeId);
      const isDocumentEditorNode = Boolean(activeNode && activeNode.editorType !== 'noteboard');
      const shouldUseDocumentHistoryShortcut =
        Boolean(activeNode) && documentQuickUndoNodeIdRef.current === activeNode.id;

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
      if (mod) {
        const key = event.key.toLowerCase();
        if (key === 'z' || key === 'y') {
          if (isTextEntryTarget) {
            if (!isDocumentEditorNode || !shouldUseDocumentHistoryShortcut) {
              return;
            }
          }

          if (key === 'z') {
            if (event.shiftKey) {
              redoHistory();
            } else {
              undoHistory();
            }
          } else {
            redoHistory();
          }

          if (isDocumentEditorNode && activeNode) {
            documentQuickUndoNodeIdRef.current = activeNode.id;
          }

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
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            void navigator.clipboard.writeText(NOTEBOARD_CARDS_CLIPBOARD_MARKER).catch(() => {
              // Internal app clipboard still works even if system clipboard write is denied.
            });
          }
        }
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    clipboardRef,
    documentQuickUndoNodeIdRef,
    drawPointQueueRef,
    drawRafRef,
    drawRef,
    pushHistory,
    redoHistory,
    setState,
    setUiState,
    stateRef,
    uiStateRef,
    undoHistory,
  ]);
};

export const useNoteboardPasteShortcut = ({
  stateRef,
  clipboardRef,
  getCanvasCenterWorldPoint,
  extractImageBlobFromClipboardData,
  createImageCardAtWorldPoint,
  createTextCardAtWorldPoint,
  pasteCopiedCardsAtCanvasCenter,
}: UseNoteboardPasteShortcutOptions): void => {
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

      const rawClipboardText = event.clipboardData?.getData('text/plain') ?? '';
      const normalizedClipboardText = normalizeClipboardText(rawClipboardText);
      const hasImageInClipboardData =
        Array.from(event.clipboardData?.items ?? []).some(
          (item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'),
        );
      const shouldPasteInternalCardsFirst =
        clipboardRef.current?.kind === 'noteboard-cards' &&
        normalizedClipboardText === NOTEBOARD_CARDS_CLIPBOARD_MARKER;

      if (shouldPasteInternalCardsFirst) {
        event.preventDefault();
        pasteCopiedCardsAtCanvasCenter(activeNode.id);
        return;
      }

      const imageBlob = extractImageBlobFromClipboardData(event.clipboardData);
      if (imageBlob) {
        event.preventDefault();
        void createImageCardAtWorldPoint(activeNode.id, center.x, center.y, imageBlob);
        return;
      }

      if (
        normalizedClipboardText &&
        normalizedClipboardText !== NOTEBOARD_CARDS_CLIPBOARD_MARKER
      ) {
        event.preventDefault();
        createTextCardAtWorldPoint(activeNode.id, center.x, center.y, normalizedClipboardText);
        return;
      }

      if (clipboardRef.current?.kind === 'noteboard-cards' && !hasImageInClipboardData) {
        event.preventDefault();
        pasteCopiedCardsAtCanvasCenter(activeNode.id);
      }

    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [
    clipboardRef,
    createImageCardAtWorldPoint,
    createTextCardAtWorldPoint,
    extractImageBlobFromClipboardData,
    getCanvasCenterWorldPoint,
    pasteCopiedCardsAtCanvasCenter,
    stateRef,
  ]);
};
