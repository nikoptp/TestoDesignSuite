import React from 'react';
import type { NoteboardCard } from '../../../shared/types';

type TemplateDragState = {
  templateId: string;
  label: string;
  clientX: number;
  clientY: number;
} | null;

type CardContextMenuState = {
  cardId: string;
  screenX: number;
  screenY: number;
} | null;

type UseNoteboardLocalUiOptions = {
  cards: NoteboardCard[];
  selectedCardIds: string[];
  canvasRef: React.RefObject<HTMLDivElement>;
  onCanvasWheel: (event: WheelEvent) => void;
  onAddCardFromTemplateAt: (templateId: string, clientX: number, clientY: number) => void;
};

type NoteboardLocalUi = {
  previewByCardId: Record<string, boolean>;
  setPreviewByCardId: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  editingTemplateId: string | null;
  setEditingTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
  editingTemplateName: string;
  setEditingTemplateName: React.Dispatch<React.SetStateAction<string>>;
  templateDrag: TemplateDragState;
  setTemplateDrag: React.Dispatch<React.SetStateAction<TemplateDragState>>;
  onBeginTemplateDrag: (templateId: string, label: string, clientX: number, clientY: number) => void;
  cardContextMenu: CardContextMenuState;
  setCardContextMenu: React.Dispatch<React.SetStateAction<CardContextMenuState>>;
  closeCardContextMenu: () => void;
  contextMenuCard: NoteboardCard | null;
  cardTextareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  openCardEditor: (cardId: string) => void;
  onOpenCardContextMenu: (cardId: string, screenX: number, screenY: number) => void;
};

export const useNoteboardLocalUi = ({
  cards,
  selectedCardIds,
  canvasRef,
  onCanvasWheel,
  onAddCardFromTemplateAt,
}: UseNoteboardLocalUiOptions): NoteboardLocalUi => {
  const [previewByCardId, setPreviewByCardId] = React.useState<Record<string, boolean>>({});
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = React.useState('');
  const [templateDrag, setTemplateDrag] = React.useState<TemplateDragState>(null);
  const [cardContextMenu, setCardContextMenu] = React.useState<CardContextMenuState>(null);
  const [pendingEditorCardId, setPendingEditorCardId] = React.useState<string | null>(null);
  const cardTextareaRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const prevSelectedCardIdsRef = React.useRef<string[]>(selectedCardIds);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onCanvasWheel);
    };
  }, [canvasRef, onCanvasWheel]);

  React.useEffect(() => {
    const existingIds = new Set(cards.map((card) => card.id));
    Object.keys(cardTextareaRefs.current).forEach((cardId) => {
      if (!existingIds.has(cardId)) {
        delete cardTextareaRefs.current[cardId];
      }
    });
    setPreviewByCardId((prev) => {
      const nextEntries = Object.entries(prev).filter(([cardId]) => existingIds.has(cardId));
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [cards]);

  React.useEffect(() => {
    const previous = prevSelectedCardIdsRef.current;
    const current = new Set(selectedCardIds);
    const deselected = previous.filter((cardId) => !current.has(cardId));

    if (deselected.length > 0) {
      setPreviewByCardId((prev) => {
        let changed = false;
        const next = { ...prev };
        deselected.forEach((cardId) => {
          if (next[cardId] !== true) {
            next[cardId] = true;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    prevSelectedCardIdsRef.current = selectedCardIds;
  }, [selectedCardIds]);

  React.useEffect(() => {
    if (!pendingEditorCardId) {
      return;
    }

    const textarea = cardTextareaRefs.current[pendingEditorCardId];
    if (!textarea) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
      setPendingEditorCardId(null);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [cards, pendingEditorCardId]);

  React.useEffect(() => {
    if (!cardContextMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('.card-context-menu')) {
        return;
      }
      setCardContextMenu(null);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [cardContextMenu]);

  React.useEffect(() => {
    if (!templateDrag) {
      return;
    }

    const onPointerMove = (event: PointerEvent): void => {
      setTemplateDrag((prev) =>
        prev
          ? {
              ...prev,
              clientX: event.clientX,
              clientY: event.clientY,
            }
          : prev,
      );
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent): void => {
      const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
      if (
        dropTarget instanceof Element &&
        dropTarget.closest('.noteboard-canvas') &&
        !dropTarget.closest(
          '.noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .noteboard-card, .card-textarea',
        )
      ) {
        onAddCardFromTemplateAt(templateDrag.templateId, event.clientX, event.clientY);
      }
      setTemplateDrag(null);
      document.body.classList.remove('is-dragging-template');
      event.preventDefault();
    };

    document.body.classList.add('is-dragging-template');
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });

    return () => {
      document.body.classList.remove('is-dragging-template');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onAddCardFromTemplateAt, templateDrag]);

  const openCardEditor = React.useCallback((cardId: string): void => {
    setPreviewByCardId((prev) => ({
      ...prev,
      [cardId]: false,
    }));
    setPendingEditorCardId(cardId);
  }, []);

  const onOpenCardContextMenu = React.useCallback((cardId: string, screenX: number, screenY: number): void => {
    setCardContextMenu({
      cardId,
      screenX,
      screenY,
    });
  }, []);

  const onBeginTemplateDrag = React.useCallback((templateId: string, label: string, clientX: number, clientY: number): void => {
    setTemplateDrag({
      templateId,
      label,
      clientX,
      clientY,
    });
  }, []);

  const closeCardContextMenu = React.useCallback((): void => {
    setCardContextMenu(null);
  }, []);

  const contextMenuCard = cardContextMenu
    ? cards.find((card) => card.id === cardContextMenu.cardId) ?? null
    : null;

  return {
    previewByCardId,
    setPreviewByCardId,
    editingTemplateId,
    setEditingTemplateId,
    editingTemplateName,
    setEditingTemplateName,
    templateDrag,
    setTemplateDrag,
    onBeginTemplateDrag,
    cardContextMenu,
    setCardContextMenu,
    closeCardContextMenu,
    contextMenuCard,
    cardTextareaRefs,
    openCardEditor,
    onOpenCardContextMenu,
  };
};

