import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { NoteboardCard } from '../../shared/types';
import {
  NOTEBOARD_WORLD_HEIGHT,
  NOTEBOARD_WORLD_MIN_X,
  NOTEBOARD_WORLD_MIN_Y,
  NOTEBOARD_WORLD_WIDTH,
} from '../../shared/noteboard-constants';
import type { NoteboardView } from '../../renderer/noteboard-utils';
import { buildLinkPreviews } from '../../renderer/noteboard-link-preview';

type SelectionRectState = {
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

type NoteboardWorldProps = {
  nodeId: string;
  cards: NoteboardCard[];
  view: NoteboardView;
  gridStep: number;
  majorGridStep: number;
  lineWidth: number;
  majorLineWidth: number;
  strokeLayers: Array<React.ReactElement | null>;
  selectedCardIds: string[];
  selectionRect: SelectionRectState;
  previewByCardId: Record<string, boolean>;
  markdownUrlTransform: (url: string) => string;
  cardTextareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onSelectCard: (cardId: string, additive: boolean) => void;
  onStartDragCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onStartResizeCard: (cardId: string, event: React.PointerEvent<HTMLElement>) => void;
  onCardTextChange: (cardId: string, value: string) => void;
  onCardTextEditStart: (cardId: string) => void;
  onCardTextEditEnd: (cardId: string) => void;
  onOpenCardEditor: (cardId: string) => void;
  onShowCardPreview: (cardId: string) => void;
  onOpenCardContextMenu: (cardId: string, screenX: number, screenY: number) => void;
};

export const NoteboardWorld = ({
  nodeId,
  cards,
  view,
  gridStep,
  majorGridStep,
  lineWidth,
  majorLineWidth,
  strokeLayers,
  selectedCardIds,
  selectionRect,
  previewByCardId,
  markdownUrlTransform,
  cardTextareaRefs,
  onSelectCard,
  onStartDragCard,
  onStartResizeCard,
  onCardTextChange,
  onCardTextEditStart,
  onCardTextEditEnd,
  onOpenCardEditor,
  onShowCardPreview,
  onOpenCardContextMenu,
}: NoteboardWorldProps): React.ReactElement => {
  const getImageOnlyCardUrl = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0 || lines.length > 2) {
      return null;
    }
    const imageMatch = lines[0]?.match(/^!\[[^\]]*]\(([^)]+)\)$/);
    if (!imageMatch) {
      return null;
    }
    if (lines.length === 1) {
      return imageMatch[1];
    }
    const linkMatch = lines[1]?.match(/^\[[^\]]+]\(([^)]+)\)$/);
    if (!linkMatch) {
      return null;
    }
    return linkMatch[1] === imageMatch[1] ? imageMatch[1] : null;
  };

  return (
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
        const imageOnlyUrl = isPreview ? getImageOnlyCardUrl(card.text) : null;
        const isImageOnly = Boolean(imageOnlyUrl);
        return (
          <article
            key={card.id}
            className={`noteboard-card ${selectedCardIds.includes(card.id) ? 'selected' : ''} ${isImageOnly ? 'image-only' : ''} ${isPreview ? '' : 'editing'}`}
            style={
              {
                left: `${card.x - NOTEBOARD_WORLD_MIN_X}px`,
                top: `${card.y - NOTEBOARD_WORLD_MIN_Y}px`,
                width: `${card.width}px`,
                height: `${card.height}px`,
                '--card-fill': card.color,
              } as React.CSSProperties
            }
            onClick={(event) => {
              onSelectCard(card.id, event.ctrlKey || event.metaKey);
            }}
            onPointerDown={(event) => {
              const target = event.target;
              if (!(target instanceof Element)) {
                return;
              }
              if (target.closest('.card-textarea, .card-resize-handle')) {
                return;
              }
              if (isPreview) {
                onStartDragCard(card.id, event);
                return;
              }
              const clickedPreview = target.closest('.card-markdown-preview');
              if (clickedPreview) {
                return;
              }
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
              const border = 6;
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
              onOpenCardContextMenu(card.id, event.clientX, event.clientY);
            }}
            onDoubleClick={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest('.card-resize-handle')) {
                return;
              }
              event.stopPropagation();
              onOpenCardEditor(card.id);
            }}
          >
            <div className={`card-body ${isImageOnly ? 'image-only' : ''}`}>
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
                onBlur={() => {
                  onCardTextEditEnd(card.id);
                  onShowCardPreview(card.id);
                }}
                onChange={(event) => onCardTextChange(card.id, event.target.value)}
                style={{ display: isPreview ? 'none' : undefined }}
              />
              {isPreview ? (
                <div
                  className={`card-markdown-preview ${isImageOnly ? 'image-only' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {isImageOnly && imageOnlyUrl ? (
                    <img src={markdownUrlTransform(imageOnlyUrl)} alt="Card image" loading="lazy" />
                  ) : (
                    <>
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
                            <div key={`${card.id}-${preview.url}-${index}`} className="card-link-preview">
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
                                  <img
                                    src={preview.imageUrl}
                                    alt="Linked media preview"
                                    loading="lazy"
                                  />
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
                    </>
                  )}
                </div>
              ) : null}
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
  );
};
