import React from 'react';
import type {
  NoteboardBrushType,
  NoteboardCard,
  NoteboardStroke,
  ProjectImageAsset,
} from '../shared/types';
import {
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
} from '../shared/noteboard-constants';
import {
  getGridStepForZoom,
  type NoteboardView,
} from '../renderer/noteboard-utils';
import { buildPerfectFreehandPath, buildSmoothPath } from '../renderer/noteboard-drawing';
import { NoteboardDrawSidebar } from './noteboard/noteboard-draw-sidebar';
import { NoteboardOverlays } from './noteboard/noteboard-overlays';
import { NoteboardWorld } from './noteboard/noteboard-world';
import { useNoteboardCursorInteractions } from './noteboard/hooks/use-noteboard-cursor-interactions';
import { useNoteboardLocalUi } from './noteboard/hooks/use-noteboard-local-ui';

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
  const {
    previewByCardId,
    setPreviewByCardId,
    editingTemplateId,
    setEditingTemplateId,
    editingTemplateName,
    setEditingTemplateName,
    templateDrag,
    onBeginTemplateDrag,
    cardContextMenu,
    closeCardContextMenu,
    contextMenuCard,
    cardTextareaRefs,
    openCardEditor,
    onOpenCardContextMenu,
  } = useNoteboardLocalUi({
    cards,
    selectedCardIds,
    canvasRef,
    onCanvasWheel,
    onAddCardFromTemplateAt,
  });

  const strokeLayerCacheRef = React.useRef<WeakMap<NoteboardStroke, React.ReactElement | null>>(
    new WeakMap(),
  );

  const {
    cursorPreview,
    cursorWorld,
    quickColorMenu,
    isShiftHeld,
    setHoveredQuickColor,
    onCanvasPointerDownEvent,
    onCanvasPointerMoveEvent,
    onCanvasPointerLeaveEvent,
    onCanvasDoubleClickEvent,
  } = useNoteboardCursorInteractions({
    canvasRef,
    view,
    isDrawingMode,
    drawingColor,
    onDrawingColorChange,
    onCanvasPointerDown,
    onCreateCardAtPointAndEdit,
    onOpenCardEditor: openCardEditor,
    cardContextMenuOpen: Boolean(cardContextMenu),
    onCloseCardContextMenu: closeCardContextMenu,
  });

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
        onPointerDown={onCanvasPointerDownEvent}
        onPointerMove={onCanvasPointerMoveEvent}
        onPointerLeave={onCanvasPointerLeaveEvent}
        onContextMenu={onCanvasContextMenu}
        onDragOver={(event) => {
          if (isDrawingMode) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={onCanvasDrop}
        onDoubleClick={onCanvasDoubleClickEvent}
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
        <NoteboardDrawSidebar
          isDrawingMode={isDrawingMode}
          drawingTool={drawingTool}
          drawingBrush={drawingBrush}
          drawingSize={drawingSize}
          drawingOpacity={drawingOpacity}
          drawingPresetColors={drawingPresetColors}
          onCloseDrawingSidebar={onCloseDrawingSidebar}
          onDrawingToolChange={onDrawingToolChange}
          onDrawingBrushChange={onDrawingBrushChange}
          onDrawingSizeChange={onDrawingSizeChange}
          onDrawingOpacityChange={onDrawingOpacityChange}
          onDrawingPresetColorChange={onDrawingPresetColorChange}
        />
        <NoteboardWorld
          nodeId={nodeId}
          cards={cards}
          view={view}
          gridStep={gridStep}
          majorGridStep={majorGridStep}
          lineWidth={lineWidth}
          majorLineWidth={majorLineWidth}
          strokeLayers={strokeLayers}
          selectedCardIds={selectedCardIds}
          selectionRect={selectionRect}
          previewByCardId={previewByCardId}
          markdownUrlTransform={markdownUrlTransform}
          cardTextareaRefs={cardTextareaRefs}
          onSelectCard={onSelectCard}
          onStartDragCard={onStartDragCard}
          onStartResizeCard={onStartResizeCard}
          onCardTextChange={onCardTextChange}
          onCardTextEditStart={onCardTextEditStart}
          onCardTextEditEnd={onCardTextEditEnd}
          onOpenCardEditor={openCardEditor}
          onShowCardPreview={(cardId) =>
            setPreviewByCardId((prev) => ({
              ...prev,
              [cardId]: true,
            }))
          }
          onOpenCardContextMenu={onOpenCardContextMenu}
        />
      </section>
      <NoteboardOverlays
        isDrawingMode={isDrawingMode}
        cardTemplates={cardTemplates}
        imageAssets={imageAssets}
        editingTemplateId={editingTemplateId}
        editingTemplateName={editingTemplateName}
        templateDrag={templateDrag}
        contextMenu={contextMenu}
        cardContextMenu={cardContextMenu}
        contextMenuCardColor={contextMenuCard?.color ?? null}
        cardColorPresets={cardColorPresets}
        quickColorMenu={quickColorMenu}
        drawingPresetColors={drawingPresetColors}
        drawingColor={drawingColor}
        cursorWorld={cursorWorld}
        onSetEditingTemplateId={setEditingTemplateId}
        onSetEditingTemplateName={setEditingTemplateName}
        onBeginTemplateDrag={onBeginTemplateDrag}
        onRenameCardTemplate={onRenameCardTemplate}
        onDeleteCardTemplate={onDeleteCardTemplate}
        onDeleteImageAsset={onDeleteImageAsset}
        onCreateCardAtContextMenu={onCreateCardAtContextMenu}
        onPasteTextAtContextMenu={onPasteTextAtContextMenu}
        onSaveCardAsTemplateFromContext={(cardId) => {
          const card = cards.find((item) => item.id === cardId);
          if (!card) {
            closeCardContextMenu();
            return;
          }
          const firstLine = card.text
            .split('\n')
            .find((line) => line.trim().length > 0)
            ?.replace(/^[-*#>\s[\]0-9.]+/, '')
            .trim();
          const inferredName = (firstLine && firstLine.slice(0, 48)) || 'Custom Template';
          onSaveCardTemplate(inferredName, card.text);
          closeCardContextMenu();
        }}
        onCardColorChangeFromContext={(cardId, color) => {
          onCardColorChange(cardId, color);
          closeCardContextMenu();
        }}
        onDeleteCardFromContext={(cardId) => {
          onDeleteCard(cardId);
          closeCardContextMenu();
        }}
        onQuickColorEnter={setHoveredQuickColor}
        onQuickColorLeave={(color) =>
          setHoveredQuickColor((prev) => (prev === color ? null : prev))
        }
      />
    </>
  );
};
