import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  NoteboardBrushType,
  NoteboardCard,
  NoteboardStroke,
  ProjectImageAsset,
} from '../shared/types';
import {
  NOTEBOARD_WORLD_HEIGHT,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
  NOTEBOARD_WORLD_WIDTH,
} from '../shared/noteboard-constants';
import {
  getWorldPoint,
  getGridStepForZoom,
  type NoteboardView,
} from '../renderer/noteboard-utils';
import { ImageAssetSidebar } from './image-asset-sidebar';
import { buildLinkPreviews } from '../renderer/noteboard-link-preview';
import { buildPerfectFreehandPath, buildSmoothPath } from '../renderer/noteboard-drawing';

type ContextMenuState = {
  screenX: number;
  screenY: number;
} | null;

type SelectionRectState = {
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

type QuickColorMenuState = {
  x: number;
  y: number;
} | null;

const MAX_DRAW_SIZE = 64;

type NoteboardCanvasProps = {
  nodeId: string;
  cards: NoteboardCard[];
  strokes: NoteboardStroke[];
  view: NoteboardView;
  isDrawingMode: boolean;
  drawingTool: 'pen' | 'brush' | 'eraser';
  drawingBrush: NoteboardBrushType;
  drawingSize: number;
  drawingOpacity: number;
  drawingColor: string;
  drawingPresetColors: string[];
  selectedCardIds: string[];
  selectionRect: SelectionRectState;
  contextMenu: ContextMenuState;
  canvasRef: React.RefObject<HTMLDivElement>;
  onCanvasPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onCanvasWheel: (event: WheelEvent) => void;
  onCanvasContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onCanvasDrop: (event: React.DragEvent<HTMLElement>) => void;
  cardTemplates: Array<{ id: string; label: string; isCustom?: boolean }>;
  imageAssets: ProjectImageAsset[];
  onAddCardFromTemplateAt: (templateId: string, clientX: number, clientY: number) => void;
  onSaveCardTemplate: (name: string, markdown: string) => void;
  onDeleteCardTemplate: (templateId: string) => void;
  onDeleteImageAsset: (relativePath: string) => void;
  onRenameCardTemplate: (templateId: string, name: string) => void;
  onToggleDrawingMode: () => void;
  onCloseDrawingSidebar: () => void;
  onDrawingToolChange: (tool: 'pen' | 'brush' | 'eraser') => void;
  onDrawingBrushChange: (brush: NoteboardBrushType) => void;
  onDrawingSizeChange: (size: number) => void;
  onDrawingOpacityChange: (opacity: number) => void;
  onDrawingColorChange: (color: string) => void;
  onDrawingPresetColorChange: (index: number, color: string) => void;
  cardColorPresets: string[];
  onClearDrawing: () => void;
  onDuplicateSelected: () => void;
  onSelectCard: (cardId: string, additive: boolean) => void;
  onStartDragCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onStartResizeCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onDeleteCard: (cardId: string) => void;
  onCardColorChange: (cardId: string, color: string) => void;
  onCardTextChange: (cardId: string, value: string) => void;
  onCardTextEditStart: (cardId: string) => void;
  onCardTextEditEnd: (cardId: string) => void;
  onCreateCardAtContextMenu: () => void;
  onPasteTextAtContextMenu: () => void;
  onCreateCardAtPointAndEdit: (clientX: number, clientY: number) => string | null;
};

export const NoteboardCanvas = ({
  nodeId,
  cards,
  strokes,
  view,
  isDrawingMode,
  drawingTool,
  drawingBrush,
  drawingSize,
  drawingOpacity,
  drawingColor,
  drawingPresetColors,
  selectedCardIds,
  selectionRect,
  contextMenu,
  canvasRef,
  onCanvasPointerDown,
  onCanvasWheel,
  onCanvasContextMenu,
  onCanvasDrop,
  cardTemplates,
  imageAssets,
  onAddCardFromTemplateAt,
  onSaveCardTemplate,
  onDeleteCardTemplate,
  onDeleteImageAsset,
  onRenameCardTemplate,
  onToggleDrawingMode,
  onCloseDrawingSidebar,
  onDrawingToolChange,
  onDrawingBrushChange,
  onDrawingSizeChange,
  onDrawingOpacityChange,
  onDrawingColorChange,
  onDrawingPresetColorChange,
  cardColorPresets,
  onClearDrawing,
  onDuplicateSelected,
  onSelectCard,
  onStartDragCard,
  onStartResizeCard,
  onDeleteCard,
  onCardColorChange,
  onCardTextChange,
  onCardTextEditStart,
  onCardTextEditEnd,
  onCreateCardAtContextMenu,
  onPasteTextAtContextMenu,
  onCreateCardAtPointAndEdit,
}: NoteboardCanvasProps): React.ReactElement => {
  const markdownUrlTransform = React.useCallback((url: string): string => {
    const source = (url ?? '').trim();
    if (!source) {
      return '';
    }

    let safeUrl = source;
    if (/^file:/i.test(source)) {
      try {
        const parsed = new URL(source);
        const decodedPath = decodeURIComponent(parsed.pathname);
        const marker = '/project-assets/';
        const markerIndex = decodedPath.toLowerCase().indexOf(marker);
        if (markerIndex >= 0) {
          const relativePath = decodedPath.slice(markerIndex + 1).replace(/^[/\\]+/, '');
          const encodedRelativePath = relativePath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
          safeUrl = `testo-asset://${encodedRelativePath}`;
        }
      } catch {
        safeUrl = source;
      }
    }

    if (!safeUrl) {
      return '';
    }
    if (/^(https?:|file:|testo-asset:|data:image\/)/i.test(safeUrl)) {
      return safeUrl;
    }
    return '';
  }, []);
  const gridStep = getGridStepForZoom(view.zoom);
  const majorGridStep = gridStep * 4;
  const lineWidth = 1 / view.zoom;
  const majorLineWidth = 1.5 / view.zoom;
  const [cursorPreview, setCursorPreview] = React.useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [cursorWorld, setCursorWorld] = React.useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [quickColorMenu, setQuickColorMenu] = React.useState<QuickColorMenuState>(null);
  const [hoveredQuickColor, setHoveredQuickColor] = React.useState<string | null>(null);
  const [isShiftHeld, setIsShiftHeld] = React.useState(false);
  const [previewByCardId, setPreviewByCardId] = React.useState<Record<string, boolean>>({});
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = React.useState('');
  const [templateDrag, setTemplateDrag] = React.useState<{
    templateId: string;
    label: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [cardContextMenu, setCardContextMenu] = React.useState<{
    cardId: string;
    screenX: number;
    screenY: number;
  } | null>(null);
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

  const strokeLayerCacheRef = React.useRef<WeakMap<NoteboardStroke, React.ReactElement | null>>(
    new WeakMap(),
  );
  const openCardEditor = React.useCallback((cardId: string): void => {
    setPreviewByCardId((prev) => ({
      ...prev,
      [cardId]: false,
    }));
    setPendingEditorCardId(cardId);
  }, []);
  const contextMenuCard = cardContextMenu
    ? cards.find((card) => card.id === cardContextMenu.cardId) ?? null
    : null;

  const strokeLayers = React.useMemo(
    () =>
      strokes.map((stroke) => {
        const cached = strokeLayerCacheRef.current.get(stroke);
        if (cached !== undefined) {
          return cached;
        }

        if (stroke.points.length === 0) {
          strokeLayerCacheRef.current.set(stroke, null);
          return null;
        }

        const basePoints = stroke.points.map((point) => ({
          x: point.x - NOTEBOARD_WORLD_MIN_X,
          y: point.y - NOTEBOARD_WORLD_MIN_Y,
          pressure: point.pressure,
          t: point.t,
        }));
        const fallbackPath = buildSmoothPath(basePoints);
        const isPen = stroke.brush === 'pen';
        const isMarker = stroke.brush === 'marker';
        const isCharcoal = stroke.brush === 'charcoal';
        const zoomScale = Math.max(0.05, view.zoom);
        const effectiveSize = stroke.size / zoomScale;
        const point = basePoints[0];
        const isDot = stroke.points.length <= 1;
        const freehandPath = buildPerfectFreehandPath(basePoints, {
          size: effectiveSize * (isMarker ? 1.08 : isCharcoal ? 0.98 : isPen ? 0.82 : 0.9),
          thinning: isMarker ? 0.12 : isCharcoal ? 0.32 : 0.58,
          smoothing: isMarker ? 0.7 : isCharcoal ? 0.44 : 0.72,
          streamline: isMarker ? 0.58 : isCharcoal ? 0.28 : 0.62,
          taperStart: effectiveSize * (isMarker ? 0.06 : 0.18),
          taperEnd: effectiveSize * (isMarker ? 0.06 : 0.24),
        });

        const rendered = (
          <g key={stroke.id} className="stroke-layer">
            {isDot ? (
              <circle
                cx={point.x}
                cy={point.y}
                r={Math.max(1, effectiveSize * (isPen ? 0.34 : 0.5))}
                fill={stroke.color}
                opacity={stroke.opacity}
              />
            ) : null}
            <g
              className="stroke-classic-blend"
              style={{ mixBlendMode: isMarker ? 'multiply' : 'normal' }}
            >
              {freehandPath ? (
                <path d={freehandPath} fill={stroke.color} opacity={stroke.opacity} />
              ) : (
                <path
                  d={fallbackPath}
                  stroke={stroke.color}
                  strokeWidth={Math.max(1, effectiveSize * 0.72)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={stroke.opacity}
                />
              )}
            </g>
          </g>
        );

        strokeLayerCacheRef.current.set(stroke, rendered);
        return rendered;
      }),
    [strokes, view.zoom],
  );
  return (
    <>
      <section
        className={`noteboard-canvas ${isDrawingMode ? 'drawing-mode' : ''}`}
        data-node-id={nodeId}
        ref={canvasRef}
        onPointerDown={(event) => {
          if (
            isDrawingMode &&
            event.button === 2 &&
            !(event.target instanceof Element &&
              event.target.closest(
                '.noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .noteboard-card, .card-textarea',
              ))
          ) {
            setQuickColorMenu({
              x: event.clientX,
              y: event.clientY,
            });
            setHoveredQuickColor(null);
          }

          if (cardContextMenu && event.button === 0) {
            const target = event.target;
            if (!(target instanceof Element && target.closest('.card-context-menu'))) {
              setCardContextMenu(null);
            }
          }

          onCanvasPointerDown(event);
        }}
        onPointerMove={(event) => {
          const target = event.target;
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }

          if (
            target instanceof Element &&
            target.closest(
              '.noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .card-context-menu, .color-quick-menu',
            )
          ) {
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
              const samePosition =
                Math.abs(prev.x - world.x) < 0.01 && Math.abs(prev.y - world.y) < 0.01;
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

          if (
            target instanceof Element &&
            target.closest(
              '.noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .card-context-menu, .color-quick-menu, .noteboard-card, .card-textarea',
            )
          ) {
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
            const samePosition =
              Math.abs(prev.x - nextX) < 0.01 && Math.abs(prev.y - nextY) < 0.01;
            if (prev.visible && samePosition) {
              return prev;
            }
            return {
              x: nextX,
              y: nextY,
              visible: true,
            };
          });
        }}
        onPointerLeave={() => {
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
        }}
        onContextMenu={onCanvasContextMenu}
        onDragOver={(event) => {
          if (isDrawingMode) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onCanvasDrop}
        onDoubleClick={(event) => {
          if (isDrawingMode) {
            return;
          }
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest(
              '.noteboard-card, .noteboard-toolbar, .noteboard-draw-sidebar, .noteboard-template-sidebar, .canvas-context-menu, .card-context-menu, .color-quick-menu',
            )
          ) {
            return;
          }
          const createdId = onCreateCardAtPointAndEdit(event.clientX, event.clientY);
          if (!createdId) {
            return;
          }
          openCardEditor(createdId);
          event.preventDefault();
        }}
      >
        {isDrawingMode && cursorPreview.visible ? (
          <>
            <div
              className={`noteboard-cursor-preview ${drawingTool}`}
              style={{
                left: `${cursorPreview.x}px`,
                top: `${cursorPreview.y}px`,
                width: `${Math.max(4, drawingSize)}px`,
                height: `${Math.max(4, drawingSize)}px`,
              }}
            ></div>
            {isShiftHeld && drawingTool !== 'eraser' ? (
              <div
                className="noteboard-cursor-eraser-hint"
                style={{
                  left: `${cursorPreview.x + 16}px`,
                  top: `${cursorPreview.y - 16}px`,
                }}
                aria-hidden="true"
              >
                <i className="fa-solid fa-eraser"></i>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="noteboard-toolbar">
          <button className={isDrawingMode ? 'active' : ''} onClick={onToggleDrawingMode}>
            {isDrawingMode ? 'Drawing On' : 'Draw'}
          </button>
          {strokes.length > 0 ? <button onClick={onClearDrawing}>Clear Ink</button> : null}
          {selectedCardIds.length > 0 ? (
            <button onClick={onDuplicateSelected}>Duplicate ({selectedCardIds.length})</button>
          ) : null}
        </div>
        {isDrawingMode ? (
          <aside className="noteboard-draw-sidebar">
            <div className="draw-sidebar-header">
              <h3>Drawing</h3>
              <button onClick={onCloseDrawingSidebar}>Close</button>
            </div>

            <label className="settings-field">
              <span className="settings-field-label">Tool</span>
              <div className="tool-style-grid">
                <button
                  type="button"
                  className={`tool-style-option ${drawingTool === 'pen' ? 'active' : ''}`}
                  onClick={() => {
                    onDrawingToolChange('pen');
                  }}
                >
                  <span className="tool-style-icon">
                    <i className="fa-solid fa-pen-nib"></i>
                  </span>
                  <span className="tool-style-name">Pen</span>
                </button>
                <button
                  type="button"
                  className={`tool-style-option ${drawingTool === 'brush' ? 'active' : ''}`}
                  onClick={() => {
                    onDrawingToolChange('brush');
                    if (drawingBrush === 'pen') {
                      onDrawingBrushChange('marker');
                    }
                  }}
                >
                  <span className="tool-style-icon">
                    <i className="fa-solid fa-paintbrush"></i>
                  </span>
                  <span className="tool-style-name">Brush</span>
                </button>
                <button
                  type="button"
                  className={`tool-style-option ${drawingTool === 'eraser' ? 'active' : ''}`}
                  onClick={() => onDrawingToolChange('eraser')}
                >
                  <span className="tool-style-icon">
                    <i className="fa-solid fa-eraser"></i>
                  </span>
                  <span className="tool-style-name">Eraser</span>
                </button>
              </div>
            </label>

            {drawingTool !== 'eraser' ? (
              <>
                {drawingTool === 'brush' ? (
                  <>
                    <label className="settings-field">
                      <span className="settings-field-label">Brush Style</span>
                      <div className="brush-style-grid">
                        {(
                          [
                            { value: 'ink', label: 'Ink', className: 'ink' },
                            { value: 'marker', label: 'Marker', className: 'marker' },
                            { value: 'charcoal', label: 'Charcoal', className: 'charcoal' },
                          ] as Array<{
                            value: NoteboardBrushType;
                            label: string;
                            className: string;
                          }>
                        ).map((brushOption) => (
                          <button
                            key={brushOption.value}
                            type="button"
                            className={`brush-style-option ${
                              drawingBrush === brushOption.value ? 'active' : ''
                            }`}
                            onClick={() => onDrawingBrushChange(brushOption.value)}
                          >
                            <span className="brush-style-name">{brushOption.label}</span>
                            <svg className="brush-preview" viewBox="0 0 64 20" aria-hidden="true">
                              <path
                                className={`brush-preview-path ${brushOption.className}`}
                                d="M 6 14 C 16 2, 28 18, 42 6 C 50 0, 58 10, 62 8"
                                fill="none"
                              />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </label>
                  </>
                ) : null}
                <label className="settings-field">
                  <span className="settings-field-label">Preset Colors</span>
                  <div className="preset-color-grid">
                    {drawingPresetColors.map((presetColor, index) => (
                      <input
                        key={`${index}-${presetColor}`}
                        className="settings-input color-input preset-color-input"
                        type="color"
                        value={presetColor}
                        onChange={(event) =>
                          onDrawingPresetColorChange(index, event.target.value)
                        }
                        aria-label={`Preset color ${index + 1}`}
                      />
                    ))}
                  </div>
                </label>
              </>
            ) : null}

            <label className="settings-field">
              <span className="settings-field-label">Size ({Math.round(drawingSize)})</span>
              <input
                className="settings-input"
                type="range"
                min={2}
                max={MAX_DRAW_SIZE}
                step={1}
                value={drawingSize}
                onChange={(event) => onDrawingSizeChange(Number(event.target.value))}
              />
            </label>

            {drawingTool !== 'eraser' ? (
              <label className="settings-field">
                <span className="settings-field-label">
                  Opacity ({Math.round(drawingOpacity * 100)}%)
                </span>
                <input
                  className="settings-input"
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={drawingOpacity}
                  onChange={(event) => onDrawingOpacityChange(Number(event.target.value))}
                />
              </label>
            ) : null}
          </aside>
        ) : null}
        <div
          className="noteboard-world"
          data-node-id={nodeId}
          style={
            {
              width: `${NOTEBOARD_WORLD_WIDTH}px`,
              height: `${NOTEBOARD_WORLD_HEIGHT}px`,
              transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.zoom})`,
              '--grid-step': `${gridStep}px`,
              '--grid-major-step': `${majorGridStep}px`,
              '--grid-line-width': `${lineWidth}px`,
              '--grid-major-line-width': `${majorLineWidth}px`,
            } as React.CSSProperties
          }
        >
          <svg
            className="noteboard-drawing-layer"
            viewBox={`0 0 ${NOTEBOARD_WORLD_WIDTH} ${NOTEBOARD_WORLD_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {strokeLayers}
          </svg>
          {cards.length === 0 ? (
            <p className="editor-empty">Click on canvas to create your first card.</p>
          ) : null}
          {cards.map((card) => {
            const isPreview = previewByCardId[card.id] ?? true;
            const linkPreviews = isPreview ? buildLinkPreviews(card.text) : [];
            return (
              <article
                key={card.id}
                className={`noteboard-card ${selectedCardIds.includes(card.id) ? 'selected' : ''}`}
                style={{
                  left: `${card.x - NOTEBOARD_WORLD_MIN_X}px`,
                  top: `${card.y - NOTEBOARD_WORLD_MIN_Y}px`,
                  width: `${card.width}px`,
                  height: `${card.height}px`,
                  '--card-fill': card.color,
                } as React.CSSProperties}
                onClick={(event) => {
                  onSelectCard(card.id, event.ctrlKey || event.metaKey);
                }}
                onPointerDown={(event) => {
                  const target = event.target;
                  if (
                    !(target instanceof Element) ||
                    target.closest(
                      '.card-textarea, .card-markdown-preview, .card-actions, .card-resize-handle',
                    )
                  ) {
                    return;
                  }
                  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                  const border = 10;
                  const localX = event.clientX - rect.left;
                  const localY = event.clientY - rect.top;
                  const isBorderZone =
                    localX <= border ||
                    localY <= border ||
                    rect.width - localX <= border ||
                    rect.height - localY <= border;
                  if (!isBorderZone) {
                    return;
                  }
                  onStartDragCard(card.id, event);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCardContextMenu({
                    cardId: card.id,
                    screenX: event.clientX,
                    screenY: event.clientY,
                  });
                }}
                onDoubleClick={(event) => {
                  const target = event.target;
                  if (
                    target instanceof Element &&
                    target.closest('.card-actions, .card-resize-handle')
                  ) {
                    return;
                  }
                  event.stopPropagation();
                  openCardEditor(card.id);
                }}
              >
                <textarea
                  className="card-textarea"
                  placeholder="Write card content..."
                  ref={(element) => {
                    cardTextareaRefs.current[card.id] = element;
                  }}
                  value={card.text}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onFocus={() => onCardTextEditStart(card.id)}
                  onBlur={() => onCardTextEditEnd(card.id)}
                  onChange={(event) => onCardTextChange(card.id, event.target.value)}
                  style={{ display: isPreview ? 'none' : undefined }}
                />
                {isPreview ? (
                  <div
                    className="card-markdown-preview"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      urlTransform={markdownUrlTransform}
                      components={{
                        img: ({ src, alt, ...props }) => {
                          const safeSrc = typeof src === 'string' ? src.trim() : '';
                          if (!safeSrc) {
                            return null;
                          }
                          return <img {...props} src={safeSrc} alt={alt ?? ''} />;
                        },
                        a: ({ href, children, ...props }) => {
                          const safeHref = typeof href === 'string' ? href.trim() : '';
                          if (!safeHref) {
                            return <>{children}</>;
                          }
                          return (
                            <a
                              {...props}
                              href={safeHref}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {card.text.trim() ? card.text : '*No content yet.*'}
                    </ReactMarkdown>
                    {linkPreviews.length > 0 ? (
                      <div className="card-link-preview-list">
                        {linkPreviews.map((preview, index) => (
                          <div
                            key={`${card.id}-${preview.url}-${index}`}
                            className="card-link-preview"
                          >
                            <div className="card-link-preview-media">
                              {preview.kind === 'youtube' ? (
                                <iframe
                                  title={`YouTube preview ${index + 1}`}
                                  src={preview.embedUrl}
                                  loading="lazy"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                ></iframe>
                              ) : (
                                <img src={preview.imageUrl} alt="Linked media preview" loading="lazy" />
                              )}
                            </div>
                            <a
                              href={preview.url}
                              target="_blank"
                              rel="noreferrer"
                              className="card-link-preview-link"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {preview.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="card-actions">
                  <button
                    className="icon-action"
                    title={isPreview ? 'Edit markdown' : 'Preview markdown'}
                    aria-label={isPreview ? 'Edit markdown' : 'Preview markdown'}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isPreview) {
                        openCardEditor(card.id);
                        return;
                      }
                      setPreviewByCardId((prev) => ({
                        ...prev,
                        [card.id]: true,
                      }));
                    }}
                  >
                    <i className={isPreview ? 'fa-solid fa-pen' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
                <button
                  className="card-resize-handle"
                  aria-label="Resize card"
                  title="Resize card"
                  onPointerDown={(event) => onStartResizeCard(card.id, event)}
                >
                  <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
                </button>
              </article>
            );
          })}
          {selectionRect ? (
            <div
              className="selection-rect"
              style={{
                left: `${selectionRect.left}px`,
                top: `${selectionRect.top}px`,
                width: `${selectionRect.width}px`,
                height: `${selectionRect.height}px`,
              }}
            ></div>
          ) : null}
        </div>
      </section>
      {!isDrawingMode ? (
        <aside className="noteboard-template-sidebar">
          <section className="template-sidebar-section">
            <div className="draw-sidebar-header">
              <h3>Templates</h3>
            </div>
            <p className="template-sidebar-hint">Drag a template to the board</p>
            <div className="template-list">
              {cardTemplates.map((template) => (
                <div key={`sidebar-${template.id}`} className="template-item-row">
                  {editingTemplateId === template.id ? (
                    <input
                      className="settings-input template-rename-input"
                      value={editingTemplateName}
                      autoFocus
                      maxLength={48}
                      onChange={(event) => setEditingTemplateName(event.target.value)}
                      onBlur={() => {
                        const nextName = editingTemplateName.trim();
                        if (nextName) {
                          onRenameCardTemplate(template.id, nextName);
                        }
                        setEditingTemplateId(null);
                        setEditingTemplateName('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          const nextName = editingTemplateName.trim();
                          if (nextName) {
                            onRenameCardTemplate(template.id, nextName);
                          }
                          setEditingTemplateId(null);
                          setEditingTemplateName('');
                        } else if (event.key === 'Escape') {
                          setEditingTemplateId(null);
                          setEditingTemplateName('');
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="template-item"
                      onPointerDown={(event) => {
                        if (template.isCustom && event.detail > 1) {
                          return;
                        }
                        setTemplateDrag({
                          templateId: template.id,
                          label: template.label,
                          clientX: event.clientX,
                          clientY: event.clientY,
                        });
                        event.preventDefault();
                      }}
                      onDoubleClick={() => {
                        if (!template.isCustom) {
                          return;
                        }
                        setEditingTemplateId(template.id);
                        setEditingTemplateName(template.label);
                      }}
                    >
                      {template.label}
                    </button>
                  )}
                  {template.isCustom ? (
                    <button
                      type="button"
                      className="template-delete-btn"
                      onClick={() => onDeleteCardTemplate(template.id)}
                      title="Delete template"
                      aria-label="Delete template"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          <ImageAssetSidebar assets={imageAssets} onDeleteAsset={onDeleteImageAsset} />
          <div className="template-sidebar-end-spacer" aria-hidden="true">
            &nbsp;
          </div>
        </aside>
      ) : null}

      {contextMenu ? (
        <div
          className="canvas-context-menu"
          style={{ left: `${contextMenu.screenX}px`, top: `${contextMenu.screenY}px` }}
        >
          <button className="context-menu-item" onClick={onCreateCardAtContextMenu}>
            <i className="fa-solid fa-note-sticky"></i>
            <span>Create Card Here</span>
          </button>
          <button className="context-menu-item" onClick={onPasteTextAtContextMenu}>
            <i className="fa-solid fa-paste"></i>
            <span>Paste Here</span>
          </button>
        </div>
      ) : null}
      {cardContextMenu ? (
        <div
          className="card-context-menu"
          style={{ left: `${cardContextMenu.screenX}px`, top: `${cardContextMenu.screenY}px` }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              const card = cards.find((item) => item.id === cardContextMenu.cardId);
              if (!card) {
                setCardContextMenu(null);
                return;
              }
              const firstLine = card.text
                .split('\n')
                .find((line) => line.trim().length > 0)
                ?.replace(/^[-*#>\s[\]0-9.]+/, '')
                .trim();
              const inferredName = (firstLine && firstLine.slice(0, 48)) || 'Custom Template';
              onSaveCardTemplate(inferredName, card.text);
              setCardContextMenu(null);
            }}
          >
            <i className="fa-solid fa-bookmark"></i>
            <span>Save As Template</span>
          </button>
          <div className="card-context-colors">
            {cardColorPresets.map((presetColor, index) => (
              <button
                key={`${cardContextMenu.cardId}-color-${index}`}
                type="button"
                className={`card-color-swatch ${
                  contextMenuCard?.color === presetColor ? 'active' : ''
                }`}
                style={{ backgroundColor: presetColor }}
                onClick={() => {
                  onCardColorChange(cardContextMenu.cardId, presetColor);
                  setCardContextMenu(null);
                }}
                aria-label={`Set card color ${presetColor}`}
                title={presetColor}
              ></button>
            ))}
          </div>
          <button
            className="context-menu-item"
            onClick={() => {
              onDeleteCard(cardContextMenu.cardId);
              setCardContextMenu(null);
            }}
          >
            <i className="fa-solid fa-trash"></i>
            <span>Delete Card</span>
          </button>
        </div>
      ) : null}
      {quickColorMenu && isDrawingMode ? (
        <div
          className="color-quick-menu"
          style={{ left: `${quickColorMenu.x}px`, top: `${quickColorMenu.y}px` }}
        >
          {drawingPresetColors.map((presetColor, index) => (
            <button
              key={`${index}-${presetColor}`}
              type="button"
              className={`quick-color-swatch ${drawingColor === presetColor ? 'active' : ''}`}
              style={{ backgroundColor: presetColor }}
              onPointerEnter={() => setHoveredQuickColor(presetColor)}
              onPointerLeave={() =>
                setHoveredQuickColor((prev) => (prev === presetColor ? null : prev))
              }
              aria-label={`Use color ${presetColor}`}
              title={presetColor}
            ></button>
          ))}
        </div>
      ) : null}
      {templateDrag ? (
        <div
          className="template-drag-ghost"
          style={{ left: `${templateDrag.clientX}px`, top: `${templateDrag.clientY}px` }}
          aria-hidden="true"
        >
          {templateDrag.label}
        </div>
      ) : null}
      {cursorWorld.visible ? (
        <div className="cursor-coordinate-hud" aria-hidden="true">
          {Math.round(cursorWorld.x)}, {Math.round(cursorWorld.y)}
        </div>
      ) : null}
    </>
  );
};
