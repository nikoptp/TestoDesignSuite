import React from 'react';
import type { NoteboardBrushType, NoteboardCard, NoteboardStroke } from '../shared/types';
import {
  NOTEBOARD_WORLD_HEIGHT,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
  NOTEBOARD_WORLD_WIDTH,
} from '../shared/noteboard-constants';
import {
  CARD_MIN_HEIGHT,
  CARD_WIDTH,
  getGridStepForZoom,
  type NoteboardView,
} from '../renderer/noteboard-utils';
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
  onAddCard: () => void;
  onToggleDrawingMode: () => void;
  onCloseDrawingSidebar: () => void;
  onDrawingToolChange: (tool: 'pen' | 'brush' | 'eraser') => void;
  onDrawingBrushChange: (brush: NoteboardBrushType) => void;
  onDrawingSizeChange: (size: number) => void;
  onDrawingOpacityChange: (opacity: number) => void;
  onDrawingColorChange: (color: string) => void;
  onDrawingPresetColorChange: (index: number, color: string) => void;
  onClearDrawing: () => void;
  onDuplicateSelected: () => void;
  onSelectCard: (cardId: string, additive: boolean) => void;
  onStartDragCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onDeleteCard: (cardId: string) => void;
  onCardTextChange: (cardId: string, value: string) => void;
  onCardTextEditStart: (cardId: string) => void;
  onCardTextEditEnd: (cardId: string) => void;
  onCreateCardAtContextMenu: () => void;
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
  onAddCard,
  onToggleDrawingMode,
  onCloseDrawingSidebar,
  onDrawingToolChange,
  onDrawingBrushChange,
  onDrawingSizeChange,
  onDrawingOpacityChange,
  onDrawingColorChange,
  onDrawingPresetColorChange,
  onClearDrawing,
  onDuplicateSelected,
  onSelectCard,
  onStartDragCard,
  onDeleteCard,
  onCardTextChange,
  onCardTextEditStart,
  onCardTextEditEnd,
  onCreateCardAtContextMenu,
}: NoteboardCanvasProps): React.ReactElement => {
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
  const [quickColorMenu, setQuickColorMenu] = React.useState<QuickColorMenuState>(null);
  const [hoveredQuickColor, setHoveredQuickColor] = React.useState<string | null>(null);
  const [isShiftHeld, setIsShiftHeld] = React.useState(false);

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

  const strokeLayerCacheRef = React.useRef<WeakMap<NoteboardStroke, React.ReactElement | null>>(
    new WeakMap(),
  );

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
                '.noteboard-toolbar, .noteboard-draw-sidebar, .canvas-context-menu, .noteboard-card, .card-textarea',
              ))
          ) {
            setQuickColorMenu({
              x: event.clientX,
              y: event.clientY,
            });
            setHoveredQuickColor(null);
          }

          onCanvasPointerDown(event);
        }}
        onPointerMove={(event) => {
          if (!isDrawingMode) {
            return;
          }

          const target = event.target;
          if (
            target instanceof Element &&
            target.closest(
              '.noteboard-toolbar, .noteboard-draw-sidebar, .canvas-context-menu, .color-quick-menu, .noteboard-card, .card-textarea',
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

          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }

          const rect = canvas.getBoundingClientRect();
          setCursorPreview({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            visible: true,
          });
        }}
        onPointerLeave={() =>
          setCursorPreview((prev) =>
            prev.visible
              ? {
                  ...prev,
                  visible: false,
                }
              : prev,
          )
        }
        onContextMenu={onCanvasContextMenu}
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
          <button onClick={onAddCard}>+ Card</button>
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
          {cards.map((card) => (
            <article
              key={card.id}
              className={`noteboard-card ${selectedCardIds.includes(card.id) ? 'selected' : ''}`}
              style={{
                left: `${card.x - NOTEBOARD_WORLD_MIN_X}px`,
                top: `${card.y - NOTEBOARD_WORLD_MIN_Y}px`,
                width: `${CARD_WIDTH}px`,
                minHeight: `${CARD_MIN_HEIGHT}px`,
              }}
              onClick={(event) => {
                onSelectCard(card.id, event.ctrlKey || event.metaKey);
              }}
            >
              <div
                className="card-drag-handle"
                title="Drag card"
                aria-label="Drag card"
                onPointerDown={(event) => onStartDragCard(card.id, event)}
              >
                <i className="fa-solid fa-grip"></i>
              </div>
              <textarea
                className="card-textarea"
                placeholder="Write card content..."
                value={card.text}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onFocus={() => onCardTextEditStart(card.id)}
                onBlur={() => onCardTextEditEnd(card.id)}
                onChange={(event) => onCardTextChange(card.id, event.target.value)}
              />
              <div className="card-actions">
                <button
                  className="icon-action danger"
                  title="Delete card"
                  aria-label="Delete card"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteCard(card.id);
                  }}
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              </div>
            </article>
          ))}
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

      {contextMenu ? (
        <div
          className="canvas-context-menu"
          style={{ left: `${contextMenu.screenX}px`, top: `${contextMenu.screenY}px` }}
        >
          <button className="context-menu-item" onClick={onCreateCardAtContextMenu}>
            <i className="fa-solid fa-note-sticky"></i>
            <span>Create Card Here</span>
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
    </>
  );
};
