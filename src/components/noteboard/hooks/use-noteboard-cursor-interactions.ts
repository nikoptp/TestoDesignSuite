import React from 'react';
import { getWorldPoint, type NoteboardView } from '../../../renderer/noteboard-utils';
import {
  NOTEBOARD_CARD_BLOCKED_SELECTORS,
  NOTEBOARD_OVERLAY_BLOCKED_SELECTORS,
} from '../../../features/noteboard/noteboard-dom-selectors';

type QuickColorMenuState = {
  x: number;
  y: number;
} | null;

type CursorPreviewState = {
  x: number;
  y: number;
  visible: boolean;
};

type CursorWorldState = {
  x: number;
  y: number;
  visible: boolean;
};

type UseNoteboardCursorInteractionsOptions = {
  canvasRef: React.RefObject<HTMLDivElement>;
  view: NoteboardView;
  isDrawingMode: boolean;
  drawingColor: string;
  onDrawingColorChange: (color: string) => void;
  onCanvasPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onCreateCardAtPointAndEdit: (clientX: number, clientY: number) => string | null;
  onOpenCardEditor: (cardId: string) => void;
  cardContextMenuOpen: boolean;
  onCloseCardContextMenu: () => void;
};

type NoteboardCursorInteractions = {
  cursorPreview: CursorPreviewState;
  cursorWorld: CursorWorldState;
  quickColorMenu: QuickColorMenuState;
  hoveredQuickColor: string | null;
  isShiftHeld: boolean;
  setHoveredQuickColor: React.Dispatch<React.SetStateAction<string | null>>;
  onCanvasPointerDownEvent: (event: React.PointerEvent<HTMLElement>) => void;
  onCanvasPointerMoveEvent: (event: React.PointerEvent<HTMLElement>) => void;
  onCanvasPointerLeaveEvent: () => void;
  onCanvasDoubleClickEvent: (event: React.MouseEvent<HTMLElement>) => void;
};

const BLOCKED_TARGETS = NOTEBOARD_OVERLAY_BLOCKED_SELECTORS;
const CARD_BLOCKED_TARGETS = NOTEBOARD_CARD_BLOCKED_SELECTORS;

export const useNoteboardCursorInteractions = ({
  canvasRef,
  view,
  isDrawingMode,
  drawingColor,
  onDrawingColorChange,
  onCanvasPointerDown,
  onCreateCardAtPointAndEdit,
  onOpenCardEditor,
  cardContextMenuOpen,
  onCloseCardContextMenu,
}: UseNoteboardCursorInteractionsOptions): NoteboardCursorInteractions => {
  const [cursorPreview, setCursorPreview] = React.useState<CursorPreviewState>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [cursorWorld, setCursorWorld] = React.useState<CursorWorldState>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [quickColorMenu, setQuickColorMenu] = React.useState<QuickColorMenuState>(null);
  const [hoveredQuickColor, setHoveredQuickColor] = React.useState<string | null>(null);
  const [isShiftHeld, setIsShiftHeld] = React.useState(false);

  React.useEffect(() => {
    if (!quickColorMenu) {
      return;
    }

    const closeQuickColorMenu = (event: PointerEvent | MouseEvent): void => {
      if (event.button !== 2) {
        return;
      }

      if (hoveredQuickColor && hoveredQuickColor !== drawingColor) {
        onDrawingColorChange(hoveredQuickColor);
      }
      setQuickColorMenu(null);
      setHoveredQuickColor(null);
    };

    window.addEventListener('pointerup', closeQuickColorMenu);
    window.addEventListener('mouseup', closeQuickColorMenu);
    return () => {
      window.removeEventListener('pointerup', closeQuickColorMenu);
      window.removeEventListener('mouseup', closeQuickColorMenu);
    };
  }, [drawingColor, hoveredQuickColor, onDrawingColorChange, quickColorMenu]);

  React.useEffect(() => {
    if (!isDrawingMode) {
      setQuickColorMenu(null);
      setHoveredQuickColor(null);
    }
  }, [isDrawingMode]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Shift') {
        setIsShiftHeld(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Shift') {
        setIsShiftHeld(false);
      }
    };

    const onWindowBlur = (): void => {
      setIsShiftHeld(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  const onCanvasPointerDownEvent = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      if (
        isDrawingMode &&
        event.button === 2 &&
        !(event.target instanceof Element && event.target.closest(CARD_BLOCKED_TARGETS))
      ) {
        setQuickColorMenu({
          x: event.clientX,
          y: event.clientY,
        });
        setHoveredQuickColor(null);
      }

      if (cardContextMenuOpen && event.button === 0) {
        const target = event.target;
        if (!(target instanceof Element && target.closest('.card-context-menu'))) {
          onCloseCardContextMenu();
        }
      }

      onCanvasPointerDown(event);
    },
    [
      cardContextMenuOpen,
      isDrawingMode,
      onCanvasPointerDown,
      onCloseCardContextMenu,
    ],
  );

  const onCanvasPointerMoveEvent = React.useCallback(
    (event: React.PointerEvent<HTMLElement>): void => {
      const target = event.target;
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      if (
        document.body.classList.contains('is-resizing-card') ||
        document.body.classList.contains('is-dragging-card') ||
        document.body.classList.contains('is-panning-canvas')
      ) {
        return;
      }
      if (!isDrawingMode && event.buttons !== 0) {
        return;
      }

      if (target instanceof Element && target.closest(BLOCKED_TARGETS)) {
        setCursorWorld((prev) =>
          prev.visible
            ? {
                ...prev,
                visible: false,
              }
            : prev,
        );
      } else {
        const world = getWorldPoint(canvas, view, event.clientX, event.clientY);
        setCursorWorld((prev) => {
          const samePosition = Math.abs(prev.x - world.x) < 0.01 && Math.abs(prev.y - world.y) < 0.01;
          if (prev.visible && samePosition) {
            return prev;
          }
          return {
            x: world.x,
            y: world.y,
            visible: true,
          };
        });
      }

      if (!isDrawingMode) {
        return;
      }

      if (target instanceof Element && target.closest(CARD_BLOCKED_TARGETS)) {
        setCursorPreview((prev) =>
          prev.visible
            ? {
                ...prev,
                visible: false,
              }
            : prev,
        );
        return;
      }

      const rect = canvas.getBoundingClientRect();
      setCursorPreview((prev) => {
        const nextX = event.clientX - rect.left;
        const nextY = event.clientY - rect.top;
        const samePosition = Math.abs(prev.x - nextX) < 0.01 && Math.abs(prev.y - nextY) < 0.01;
        if (prev.visible && samePosition) {
          return prev;
        }
        return {
          x: nextX,
          y: nextY,
          visible: true,
        };
      });
    },
    [canvasRef, isDrawingMode, view],
  );

  const onCanvasPointerLeaveEvent = React.useCallback((): void => {
    setCursorPreview((prev) =>
      prev.visible
        ? {
            ...prev,
            visible: false,
          }
        : prev,
    );
    setCursorWorld((prev) =>
      prev.visible
        ? {
            ...prev,
            visible: false,
          }
        : prev,
    );
  }, []);

  const onCanvasDoubleClickEvent = React.useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      if (isDrawingMode) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest(`${BLOCKED_TARGETS}, .noteboard-card`)) {
        return;
      }
      const createdId = onCreateCardAtPointAndEdit(event.clientX, event.clientY);
      if (!createdId) {
        return;
      }
      onOpenCardEditor(createdId);
      event.preventDefault();
    },
    [isDrawingMode, onCreateCardAtPointAndEdit, onOpenCardEditor],
  );

  return {
    cursorPreview,
    cursorWorld,
    quickColorMenu,
    hoveredQuickColor,
    isShiftHeld,
    setHoveredQuickColor,
    onCanvasPointerDownEvent,
    onCanvasPointerMoveEvent,
    onCanvasPointerLeaveEvent,
    onCanvasDoubleClickEvent,
  };
};
