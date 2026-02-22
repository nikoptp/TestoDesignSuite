import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState, UserSettings } from '../../../shared/types';
import {
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  clampCardToWorld,
  createNoteboardCard,
  getWorldPoint,
  type NoteboardView,
} from '../../../renderer/noteboard-utils';
import {
  CUSTOM_TEMPLATE_MAX_COUNT,
  MAX_DRAW_SIZE,
  type UiState,
  createCustomTemplateId,
  ensureNoteboardData,
  estimateCardDimensionsFromText,
  getCardsForNode,
  getStrokesForNode,
  getViewForNode,
  isHexColor,
  sanitizeCardTemplates,
  sanitizeDrawingPresetColors,
} from '../../app/app-model';
import { updateNodeNoteboardData } from '../../app/workspace-node-updaters';

type TemplateOption = {
  id: string;
  label: string;
  markdown: string;
  isCustom: boolean;
};

type UseNoteboardCardActionsOptions = {
  nodeId: string;
  selectedView: NoteboardView;
  selectedCardIds: string[];
  availableCardTemplates: TemplateOption[];
  themeCardColor: string;
  uiState: UiState;
  uiStateRef: MutableRefObject<UiState>;
  canvasRef: React.RefObject<HTMLDivElement>;
  textEditSessionsRef: MutableRefObject<Set<string>>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  setSettings: Dispatch<SetStateAction<UserSettings>>;
  pushHistory: () => void;
  pasteSystemClipboardAtPoint: (nodeId: string, worldX: number, worldY: number) => Promise<boolean>;
  pasteCopiedCardsAtCanvasCenter: (nodeId: string) => boolean;
  refreshImageAssets: () => Promise<void>;
};

type UseNoteboardCardActionsResult = {
  onAddCardFromTemplateAt: (templateId: string, clientX: number, clientY: number) => void;
  onRenameCardTemplate: (templateId: string, name: string) => void;
  onSaveCardTemplate: (name: string, markdown: string) => void;
  onDeleteCardTemplate: (templateId: string) => void;
  onDeleteImageAsset: (relativePath: string) => void;
  onDrawingToolChange: (tool: 'pen' | 'brush' | 'eraser') => void;
  onDrawingBrushChange: (brush: UserSettings['drawingBrush']) => void;
  onDrawingSizeChange: (size: number) => void;
  onDrawingOpacityChange: (opacity: number) => void;
  onDrawingColorChange: (color: string) => void;
  onDrawingPresetColorChange: (index: number, color: string) => void;
  onClearDrawing: () => void;
  onDuplicateSelected: () => void;
  onSelectCard: (cardId: string, additive: boolean) => void;
  onDeleteCard: (cardId: string) => void;
  onCardTextChange: (cardId: string, value: string) => void;
  onCardColorChange: (cardId: string, color: string) => void;
  onCardTextEditStart: (cardId: string) => void;
  onCardTextEditEnd: (cardId: string) => void;
  onCreateCardAtContextMenu: () => void;
  onPasteTextAtContextMenu: () => void;
  onCreateCardAtPointAndEdit: (clientX: number, clientY: number) => string | null;
};

export const useNoteboardCardActions = ({
  nodeId,
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
}: UseNoteboardCardActionsOptions): UseNoteboardCardActionsResult => {
  const onAddCardFromTemplateAt = React.useCallback(
    (templateId: string, clientX: number, clientY: number): void => {
      const template = availableCardTemplates.find((item) => item.id === templateId);
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const world = getWorldPoint(canvas, selectedView, clientX, clientY);
      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [...getCardsForNode(next, nodeId)];
        const pos = clampCardToWorld(world.x - CARD_WIDTH / 2, world.y - CARD_MIN_HEIGHT / 2);
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
            nodeId,
            cardIds: [card.id],
          },
        }));

        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
      });
    },
    [availableCardTemplates, canvasRef, nodeId, pushHistory, selectedView, setState, setUiState, themeCardColor],
  );

  const onRenameCardTemplate = React.useCallback(
    (templateId: string, name: string): void => {
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
      });
    },
    [setSettings],
  );

  const onSaveCardTemplate = React.useCallback(
    (name: string, markdown: string): void => {
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
      });
    },
    [setSettings],
  );

  const onDeleteCardTemplate = React.useCallback(
    (templateId: string): void => {
      setSettings((prev) => {
        const current = sanitizeCardTemplates(prev.cardTemplates);
        const nextTemplates = current.filter((template) => template.id !== templateId);
        if (nextTemplates.length === current.length) {
          return prev;
        }
        return {
          ...prev,
          cardTemplates: nextTemplates,
        };
      });
    },
    [setSettings],
  );

  const onDeleteImageAsset = React.useCallback(
    (relativePath: string): void => {
      void (async () => {
        try {
          await window.testoApi?.deleteImageAsset(relativePath);
        } catch {
          return;
        }
        await refreshImageAssets();
      })();
    },
    [refreshImageAssets],
  );

  const onDrawingToolChange = React.useCallback(
    (tool: 'pen' | 'brush' | 'eraser'): void => {
      setSettings((prev) => ({
        ...prev,
        drawingTool: tool,
      }));
    },
    [setSettings],
  );

  const onDrawingBrushChange = React.useCallback(
    (brush: UserSettings['drawingBrush']): void => {
      setSettings((prev) => ({
        ...prev,
        drawingBrush: brush,
      }));
    },
    [setSettings],
  );

  const onDrawingSizeChange = React.useCallback(
    (size: number): void => {
      setSettings((prev) => ({
        ...prev,
        drawingSize: Math.max(2, Math.min(MAX_DRAW_SIZE, size)),
      }));
    },
    [setSettings],
  );

  const onDrawingOpacityChange = React.useCallback(
    (opacity: number): void => {
      setSettings((prev) => ({
        ...prev,
        drawingOpacity: Math.max(0.05, Math.min(1, opacity)),
      }));
    },
    [setSettings],
  );

  const onDrawingColorChange = React.useCallback(
    (color: string): void => {
      setSettings((prev) => ({
        ...prev,
        drawingColor: color,
      }));
    },
    [setSettings],
  );

  const onDrawingPresetColorChange = React.useCallback(
    (index: number, color: string): void => {
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
      });
    },
    [setSettings],
  );

  const onClearDrawing = React.useCallback((): void => {
    pushHistory();
    setState((prev) => {
      const next = ensureNoteboardData(prev, nodeId);
      const strokes = getStrokesForNode(next, nodeId);
      if (strokes.length === 0) {
        return prev;
      }

      return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
        ...noteboard,
        cards: [...getCardsForNode(next, nodeId)],
        strokes: [],
        view: { ...getViewForNode(next, nodeId) },
      }));
    });
  }, [nodeId, pushHistory, setState]);

  const onDuplicateSelected = React.useCallback((): void => {
    if (selectedCardIds.length === 0) {
      return;
    }

    pushHistory();
    setState((prev) => {
      const next = ensureNoteboardData(prev, nodeId);
      const cards = [...getCardsForNode(next, nodeId)];
      const selectedCardsForDup = cards.filter((card) => selectedCardIds.includes(card.id));
      if (selectedCardsForDup.length === 0) {
        return prev;
      }

      const duplicates = selectedCardsForDup.map((card) => createNoteboardCard(card.x + 28, card.y + 28));
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
          nodeId,
          cardIds: duplicates.map((card) => card.id),
        },
      }));

      return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
        ...noteboard,
        cards,
        view: { ...getViewForNode(next, nodeId) },
      }));
    });
  }, [nodeId, pushHistory, selectedCardIds, setState, setUiState]);

  const onSelectCard = React.useCallback(
    (cardId: string, additive: boolean): void => {
      if (uiStateRef.current.isDrawingMode) {
        return;
      }
      setUiState((prev) => {
        const current = prev.cardSelection.nodeId === nodeId ? prev.cardSelection.cardIds : [];
        const nextCardIds = additive
          ? current.includes(cardId)
            ? current.filter((id) => id !== cardId)
            : [...current, cardId]
          : [cardId];

        return {
          ...prev,
          contextMenu: null,
          cardSelection: {
            nodeId,
            cardIds: nextCardIds,
          },
        };
      });
    },
    [nodeId, setUiState, uiStateRef],
  );

  const onDeleteCard = React.useCallback(
    (cardId: string): void => {
      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [...getCardsForNode(next, nodeId)];
        const index = cards.findIndex((card) => card.id === cardId);
        if (index < 0) {
          return prev;
        }

        cards.splice(index, 1);
        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
      });

      setUiState((prev) => ({
        ...prev,
        cardSelection: {
          nodeId,
          cardIds: selectedCardIds.filter((id) => id !== cardId),
        },
      }));
    },
    [nodeId, pushHistory, selectedCardIds, setState, setUiState],
  );

  const onCardTextChange = React.useCallback(
    (cardId: string, value: string): void => {
      const sessionKey = `${nodeId}:${cardId}`;
      if (!textEditSessionsRef.current.has(sessionKey)) {
        pushHistory();
        textEditSessionsRef.current.add(sessionKey);
      }

      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = getCardsForNode(next, nodeId).map((card) => {
          if (card.id !== cardId) {
            return card;
          }
          const nextSize = estimateCardDimensionsFromText(value);
          const grownWidth = Math.max(card.width, nextSize.width);
          const grownHeight = Math.max(card.height, nextSize.height);
          const clampedPos = clampCardToWorld(card.x, card.y, grownWidth, grownHeight);
          return {
            ...card,
            text: value,
            width: grownWidth,
            height: grownHeight,
            x: clampedPos.x,
            y: clampedPos.y,
          };
        });
        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
      });
    },
    [nodeId, pushHistory, setState, textEditSessionsRef],
  );

  const onCardColorChange = React.useCallback(
    (cardId: string, color: string): void => {
      if (!isHexColor(color)) {
        return;
      }
      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = getCardsForNode(next, nodeId).map((card) =>
          card.id === cardId ? { ...card, color } : card,
        );
        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
      });
    },
    [nodeId, pushHistory, setState],
  );

  const onCardTextEditStart = React.useCallback(
    (cardId: string): void => {
      textEditSessionsRef.current.delete(`${nodeId}:${cardId}`);
    },
    [nodeId, textEditSessionsRef],
  );

  const onCardTextEditEnd = React.useCallback(
    (cardId: string): void => {
      textEditSessionsRef.current.delete(`${nodeId}:${cardId}`);
    },
    [nodeId, textEditSessionsRef],
  );

  const onCreateCardAtContextMenu = React.useCallback((): void => {
    const menu = uiState.contextMenu;
    if (!menu || menu.nodeId !== nodeId) {
      return;
    }

    pushHistory();
    setState((prev) => {
      const next = ensureNoteboardData(prev, nodeId);
      const cards = [...getCardsForNode(next, nodeId)];
      const pos = clampCardToWorld(menu.worldX - CARD_WIDTH / 2, menu.worldY - 24);
      const created = createNoteboardCard(pos.x, pos.y);
      created.color = themeCardColor;
      cards.unshift(created);
      return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
        ...noteboard,
        cards,
        view: { ...getViewForNode(next, nodeId) },
      }));
    });

    setUiState((prev) => ({
      ...prev,
      contextMenu: null,
    }));
  }, [nodeId, pushHistory, setState, setUiState, themeCardColor, uiState.contextMenu]);

  const onPasteTextAtContextMenu = React.useCallback((): void => {
    const menu = uiState.contextMenu;
    if (!menu || menu.nodeId !== nodeId) {
      return;
    }

    void (async () => {
      const pastedFromSystemClipboard = await pasteSystemClipboardAtPoint(nodeId, menu.worldX, menu.worldY);
      if (!pastedFromSystemClipboard) {
        pasteCopiedCardsAtCanvasCenter(nodeId);
      }
    })();
  }, [nodeId, pasteCopiedCardsAtCanvasCenter, pasteSystemClipboardAtPoint, uiState.contextMenu]);

  const onCreateCardAtPointAndEdit = React.useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }

      const world = getWorldPoint(canvas, selectedView, clientX, clientY);
      const pos = clampCardToWorld(world.x - CARD_WIDTH / 2, world.y - CARD_MIN_HEIGHT / 2);
      const created = createNoteboardCard(pos.x, pos.y);
      created.color = themeCardColor;

      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [created, ...getCardsForNode(next, nodeId)];
        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
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

      return created.id;
    },
    [canvasRef, nodeId, pushHistory, selectedView, setState, setUiState, themeCardColor],
  );

  return {
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
  };
};
