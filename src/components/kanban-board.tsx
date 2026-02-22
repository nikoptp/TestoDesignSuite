import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'motion/react';
import type { KanbanCard, KanbanColumn, KanbanPriority } from '../shared/types';
import { useGlobalKeydown } from '../shared/hooks/use-global-keydown';
import { useOutsidePointerDismiss } from '../shared/hooks/use-outside-pointer-dismiss';
import { isTextEntryTargetElement } from '../features/app/app-model';

type MigrateTarget = {
  nodeId: string;
  name: string;
};

type KanbanBoardProps = {
  columns: KanbanColumn[];
  boardCards: KanbanCard[];
  sharedBacklogCards: KanbanCard[];
  collapsedColumnIds: string[];
  migrateTargets: MigrateTarget[];
  onCreateCard: (columnId: string) => void;
  onMoveCard: (input: {
    cardId: string;
    fromSharedBacklog: boolean;
    toColumnId: string;
    toIndex: number;
  }) => void;
  onCardTitleChange: (cardId: string, fromSharedBacklog: boolean, title: string) => void;
  onCardPriorityChange: (cardId: string, fromSharedBacklog: boolean, priority: KanbanPriority) => void;
  onCardMarkdownChange: (cardId: string, fromSharedBacklog: boolean, markdown: string) => void;
  onDeleteCard: (cardId: string, fromSharedBacklog: boolean) => void;
  onPasteCard: (
    targetColumnId: string,
    draft: { title: string; markdown: string; priority: KanbanPriority },
  ) => void;
  onAddColumn: () => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onColumnColorChange: (columnId: string, color: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onMigrate: (targetNodeId: string) => void;
  onToggleColumnCollapsed: (columnId: string) => void;
};

type DragPayload = {
  cardId: string;
  fromSharedBacklog: boolean;
};

type CardRef = {
  cardId: string;
  fromSharedBacklog: boolean;
};

type KanbanClipboard = {
  title: string;
  markdown: string;
  priority: KanbanPriority;
};

type KanbanContextMenuState = {
  screenX: number;
  screenY: number;
  cardId: string | null;
  fromSharedBacklog: boolean;
  columnId: string;
};

type PendingDeleteCard = {
  card: KanbanCard;
  fromSharedBacklog: boolean;
};

const PRIORITY_OPTIONS: Array<{ value: KanbanPriority; label: string }> = [
  { value: 'none', label: 'No Prio' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

const priorityClassName = (priority: KanbanPriority): string => {
  if (priority === 'low') return 'priority-low';
  if (priority === 'medium') return 'priority-medium';
  if (priority === 'high') return 'priority-high';
  return 'priority-none';
};

const cardsForColumn = (
  columnId: string,
  boardCards: KanbanCard[],
  sharedBacklogCards: KanbanCard[],
): Array<{ card: KanbanCard; fromSharedBacklog: boolean }> => {
  if (columnId === 'backlog') {
    return sharedBacklogCards.map((card) => ({ card, fromSharedBacklog: true }));
  }
  return boardCards
    .filter((card) => card.columnId === columnId)
    .map((card) => ({ card, fromSharedBacklog: false }));
};

export const KanbanBoard = ({
  columns,
  boardCards,
  sharedBacklogCards,
  collapsedColumnIds,
  migrateTargets,
  onCreateCard,
  onMoveCard,
  onCardTitleChange,
  onCardPriorityChange,
  onCardMarkdownChange,
  onDeleteCard,
  onPasteCard,
  onAddColumn,
  onRenameColumn,
  onColumnColorChange,
  onDeleteColumn,
  onMigrate,
  onToggleColumnCollapsed,
}: KanbanBoardProps): React.ReactElement => {
  const [activeDrag, setActiveDrag] = React.useState<DragPayload | null>(null);
  const [isMigrateDialogOpen, setIsMigrateDialogOpen] = React.useState(false);
  const [selectedCardRef, setSelectedCardRef] = React.useState<CardRef | null>(null);
  const [detailsMode, setDetailsMode] = React.useState<'preview' | 'edit'>('preview');
  const [clipboardDraft, setClipboardDraft] = React.useState<KanbanClipboard | null>(null);
  const [contextMenu, setContextMenu] = React.useState<KanbanContextMenuState | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = React.useState<PendingDeleteCard | null>(null);
  const sidebarRef = React.useRef<HTMLElement | null>(null);

  const selectedCard = React.useMemo(() => {
    if (!selectedCardRef) {
      return null;
    }
    const source = selectedCardRef.fromSharedBacklog ? sharedBacklogCards : boardCards;
    const card = source.find((item) => item.id === selectedCardRef.cardId);
    if (!card) {
      return null;
    }
    return {
      card,
      fromSharedBacklog: selectedCardRef.fromSharedBacklog,
    };
  }, [boardCards, selectedCardRef, sharedBacklogCards]);

  React.useEffect(() => {
    if (!selectedCardRef) {
      return;
    }
    if (!selectedCard) {
      setSelectedCardRef(null);
    }
  }, [selectedCard, selectedCardRef]);

  useOutsidePointerDismiss({
    enabled: Boolean(selectedCardRef),
    ignoredRefs: [sidebarRef],
    ignoredSelectors: '.kanban-context-menu, .kanban-card',
    onDismiss: () => {
      setSelectedCardRef(null);
    },
  });

  useOutsidePointerDismiss({
    enabled: Boolean(contextMenu),
    ignoredSelectors: '.kanban-context-menu',
    onDismiss: () => {
      setContextMenu(null);
    },
  });

  const copyCard = React.useCallback(
    (card: KanbanCard): void => {
      setClipboardDraft({
        title: card.title,
        markdown: card.markdown,
        priority: card.priority,
      });
    },
    [],
  );

  const deleteCard = React.useCallback(
    (cardId: string, fromSharedBacklog: boolean): void => {
      onDeleteCard(cardId, fromSharedBacklog);
      setContextMenu(null);
    },
    [onDeleteCard],
  );

  const hasCardContent = React.useCallback((card: KanbanCard): boolean => {
    const trimmedTitle = card.title.trim();
    const hasCustomTitle = trimmedTitle.length > 0 && !/^Task #\d+$/i.test(trimmedTitle);
    return hasCustomTitle || card.markdown.trim().length > 0;
  }, []);

  const requestDeleteCard = React.useCallback(
    (card: KanbanCard, fromSharedBacklog: boolean): void => {
      if (hasCardContent(card)) {
        setPendingDeleteCard({ card, fromSharedBacklog });
        setContextMenu(null);
        return;
      }
      deleteCard(card.id, fromSharedBacklog);
    },
    [deleteCard, hasCardContent],
  );

  const cutCard = React.useCallback(
    (card: KanbanCard, fromSharedBacklog: boolean): void => {
      copyCard(card);
      requestDeleteCard(card, fromSharedBacklog);
    },
    [copyCard, requestDeleteCard],
  );

  const pasteCard = React.useCallback(
    (targetColumnId: string): void => {
      if (!clipboardDraft) {
        return;
      }
      onPasteCard(targetColumnId, clipboardDraft);
      setContextMenu(null);
    },
    [clipboardDraft, onPasteCard],
  );

  const onGlobalKeyDown = React.useCallback((event: KeyboardEvent): void => {
    if (!selectedCard || isTextEntryTargetElement(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    const hasMod = event.ctrlKey || event.metaKey;

    if ((event.key === 'Delete' || event.key === 'Backspace') && !hasMod) {
      event.preventDefault();
      requestDeleteCard(selectedCard.card, selectedCard.fromSharedBacklog);
      return;
    }

    if (!hasMod) {
      return;
    }

    if (key === 'c') {
      event.preventDefault();
      copyCard(selectedCard.card);
      return;
    }

    if (key === 'x') {
      event.preventDefault();
      cutCard(selectedCard.card, selectedCard.fromSharedBacklog);
      return;
    }

    if (key === 'v' && clipboardDraft) {
      event.preventDefault();
      pasteCard(selectedCard.card.columnId);
    }
  }, [clipboardDraft, copyCard, cutCard, pasteCard, requestDeleteCard, selectedCard]);

  useGlobalKeydown({
    onKeyDown: onGlobalKeyDown,
  });

  const handleCardDrop = React.useCallback(
    (toColumnId: string, toIndex: number): void => {
      if (!activeDrag) {
        return;
      }
      onMoveCard({
        cardId: activeDrag.cardId,
        fromSharedBacklog: activeDrag.fromSharedBacklog,
        toColumnId,
        toIndex,
      });
      setActiveDrag(null);
    },
    [activeDrag, onMoveCard],
  );

  const openCardDetails = React.useCallback((cardId: string, fromSharedBacklog: boolean): void => {
    setSelectedCardRef({ cardId, fromSharedBacklog });
    setDetailsMode('preview');
  }, []);

  return (
    <div className="kanban-root">
      <div className="kanban-toolbar">
        <h2>Kanban Board</h2>
        <div className="kanban-toolbar-actions">
          <button onClick={onAddColumn}>+ Column</button>
          <button onClick={() => setIsMigrateDialogOpen(true)} disabled={migrateTargets.length === 0}>
            Migrate
          </button>
        </div>
      </div>

      <div className="kanban-workspace">
        <div className="kanban-columns">
          <AnimatePresence initial={false}>
            {columns.map((column) => {
              const cards = cardsForColumn(column.id, boardCards, sharedBacklogCards);
              const isBacklog = column.id === 'backlog';
              const isDoneColumn = column.name === 'Done';
              const isCollapsed = collapsedColumnIds.includes(column.id);

              return (
                <motion.section
                  key={column.id}
                  layout
                  className={`kanban-column ${isCollapsed ? 'collapsed' : ''}`}
                  style={{ '--kanban-column-color': column.color } as React.CSSProperties}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  onDoubleClick={(event) => {
                    if (!(event.target instanceof Element)) {
                      return;
                    }
                    if (
                      event.target.closest(
                        '.kanban-card, .kanban-column-header button, .kanban-column-header input, .kanban-column-header label, .kanban-column-header select, .kanban-column-header textarea',
                      )
                    ) {
                      return;
                    }
                    onCreateCard(column.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleCardDrop(column.id, cards.length);
                  }}
                >
                  <header className="kanban-column-header">
                    {isCollapsed ? (
                      <>
                        <button
                          className="kanban-column-collapse"
                          aria-label={`Expand ${column.name}`}
                          title="Expand column"
                          onClick={() =>
                            onToggleColumnCollapsed(column.id)
                          }
                        >
                          <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
                        </button>
                        <span className="kanban-column-collapsed-label" title={column.name}>
                          {column.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <input
                          className="kanban-column-title"
                          value={column.name}
                          disabled={isBacklog}
                          onChange={(event) => onRenameColumn(column.id, event.target.value)}
                        />
                        <input
                          className="kanban-column-color"
                          type="color"
                          value={column.color}
                          aria-label={`Set color for ${column.name}`}
                          onChange={(event) => onColumnColorChange(column.id, event.target.value)}
                        />
                        <button
                          className="kanban-column-collapse"
                          aria-label={`Collapse ${column.name}`}
                          title="Collapse column"
                          onClick={() =>
                            onToggleColumnCollapsed(column.id)
                          }
                        >
                          <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
                        </button>
                        <button
                          className="kanban-card-add"
                          aria-label={`Add card to ${column.name}`}
                          onClick={() => onCreateCard(column.id)}
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true"></i>
                        </button>
                        {!isBacklog ? (
                          <button className="kanban-column-delete" onClick={() => onDeleteColumn(column.id)}>
                            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                          </button>
                        ) : null}
                      </>
                    )}
                  </header>

                  <AnimatePresence initial={false}>
                    {!isCollapsed ? (
                      <motion.div
                        key={`cards-${column.id}`}
                        className="kanban-column-cards"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        onContextMenu={(event) => {
                          if (!(event.target instanceof Element)) {
                            return;
                          }
                          if (event.target.closest('.kanban-card')) {
                            return;
                          }
                          event.preventDefault();
                          setContextMenu({
                            screenX: event.clientX,
                            screenY: event.clientY,
                            cardId: null,
                            fromSharedBacklog: false,
                            columnId: column.id,
                          });
                        }}
                      >
                        <AnimatePresence initial={false}>
                          {cards.map(({ card, fromSharedBacklog }, index) => (
                            <motion.article
                              key={`${fromSharedBacklog ? 'backlog' : 'board'}-${card.id}`}
                              layout
                              initial={{ opacity: 0, y: 4, scale: 0.99 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.99 }}
                              transition={{ duration: 0.14, ease: 'easeOut' }}
                              className={`kanban-card ${priorityClassName(card.priority)} ${
                                isDoneColumn ? 'kanban-card-done' : ''
                              } ${
                                selectedCardRef?.cardId === card.id &&
                                selectedCardRef.fromSharedBacklog === fromSharedBacklog
                                  ? 'selected'
                                  : ''
                              }`}
                              draggable
                              onClick={() => openCardDetails(card.id, fromSharedBacklog)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                openCardDetails(card.id, fromSharedBacklog);
                                setContextMenu({
                                  screenX: event.clientX,
                                  screenY: event.clientY,
                                  cardId: card.id,
                                  fromSharedBacklog,
                                  columnId: card.columnId,
                                });
                              }}
                              onDragStart={() => {
                                setActiveDrag({ cardId: card.id, fromSharedBacklog });
                              }}
                              onDragEnd={() => {
                                setActiveDrag(null);
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleCardDrop(column.id, index);
                              }}
                            >
                              <div className="kanban-card-top">
                                <span className="kanban-card-number">#{card.taskNumber}</span>
                                {isDoneColumn ? (
                                  <span className="kanban-card-done-icon" title="Completed">
                                    <i className="fa-solid fa-check" aria-hidden="true"></i>
                                  </span>
                                ) : null}
                              </div>
                              <h3 className="kanban-card-title">{card.title.trim() || 'Untitled task'}</h3>
                            </motion.article>
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedCard ? (
            <motion.aside
              ref={sidebarRef}
              className="kanban-details-sidebar"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <header className="kanban-details-header">
                <div className="kanban-details-meta">
                  <span>#{selectedCard.card.taskNumber}</span>
                  {selectedCard.fromSharedBacklog ? <span>Backlog</span> : null}
                </div>
                <div className="kanban-details-actions">
                  <button
                    className="kanban-details-toggle"
                    onClick={() => setDetailsMode((prev) => (prev === 'preview' ? 'edit' : 'preview'))}
                  >
                    {detailsMode === 'preview' ? 'Edit' : 'Preview'}
                  </button>
                  <button
                    className="kanban-details-delete"
                    aria-label="Delete card"
                    onClick={() => requestDeleteCard(selectedCard.card, selectedCard.fromSharedBacklog)}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                  </button>
                  <button
                    className="kanban-details-close"
                    aria-label="Close card details"
                    onClick={() => setSelectedCardRef(null)}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </div>
              </header>

              <label className="kanban-details-field">
                <span>Title</span>
                <input
                  value={selectedCard.card.title}
                  onChange={(event) =>
                    onCardTitleChange(selectedCard.card.id, selectedCard.fromSharedBacklog, event.target.value)
                  }
                />
              </label>

              <label className="kanban-details-field">
                <span>Priority</span>
                <div className="kanban-priority-buttons">
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`kanban-priority-button ${
                        selectedCard.card.priority === option.value ? 'active' : ''
                      } ${priorityClassName(option.value)}`}
                      onClick={() =>
                        onCardPriorityChange(
                          selectedCard.card.id,
                          selectedCard.fromSharedBacklog,
                          option.value,
                        )
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </label>

              <div className="kanban-details-body">
                {detailsMode === 'preview' ? (
                  <div
                    className="kanban-details-preview"
                    onDoubleClick={() => setDetailsMode('edit')}
                  >
                    {selectedCard.card.markdown.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedCard.card.markdown}</ReactMarkdown>
                    ) : (
                      <p className="kanban-details-empty">No description yet.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="kanban-details-editor"
                    value={selectedCard.card.markdown}
                    placeholder="Write details in markdown..."
                    onChange={(event) =>
                      onCardMarkdownChange(
                        selectedCard.card.id,
                        selectedCard.fromSharedBacklog,
                        event.target.value,
                      )
                    }
                  />
                )}
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      {isMigrateDialogOpen ? (
        <div className="dialog-backdrop">
          <div className="confirm-dialog">
            <h3>Migrate Non-Completed Cards</h3>
            <p>Select a target Kanban board.</p>
            <div className="type-option-grid">
              {migrateTargets.map((target) => (
                <button
                  key={target.nodeId}
                  className="type-option"
                  onClick={() => {
                    onMigrate(target.nodeId);
                    setIsMigrateDialogOpen(false);
                  }}
                >
                  <span>{target.name}</span>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button onClick={() => setIsMigrateDialogOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className="kanban-context-menu"
          style={{ left: contextMenu.screenX, top: contextMenu.screenY }}
          role="menu"
        >
          {contextMenu.cardId ? (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const source = contextMenu.fromSharedBacklog ? sharedBacklogCards : boardCards;
                  const card = source.find((item) => item.id === contextMenu.cardId);
                  if (card) {
                    copyCard(card);
                  }
                  setContextMenu(null);
                }}
              >
                <i className="fa-regular fa-copy" aria-hidden="true"></i>
                Copy
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  const source = contextMenu.fromSharedBacklog ? sharedBacklogCards : boardCards;
                  const card = source.find((item) => item.id === contextMenu.cardId);
                  if (card) {
                    cutCard(card, contextMenu.fromSharedBacklog);
                  } else {
                    setContextMenu(null);
                  }
                }}
              >
                <i className="fa-solid fa-scissors" aria-hidden="true"></i>
                Cut
              </button>
            </>
          ) : null}
          <button
            className="context-menu-item"
            disabled={!clipboardDraft}
            onClick={() => pasteCard(contextMenu.columnId)}
          >
            <i className="fa-regular fa-paste" aria-hidden="true"></i>
            Paste To Column
          </button>
          {contextMenu.cardId ? (
            <button
              className="context-menu-item danger"
              onClick={() => {
                const source = contextMenu.fromSharedBacklog ? sharedBacklogCards : boardCards;
                const card = source.find((item) => item.id === contextMenu.cardId);
                if (card) {
                  requestDeleteCard(card, contextMenu.fromSharedBacklog);
                } else {
                  setContextMenu(null);
                }
              }}
            >
              <i className="fa-solid fa-trash" aria-hidden="true"></i>
              Delete
            </button>
          ) : null}
          <div className="kanban-context-menu-divider"></div>
          <button className="context-menu-item" onClick={() => setContextMenu(null)}>
            Close
          </button>
        </div>
      ) : null}

      {pendingDeleteCard ? (
        <div className="dialog-backdrop">
          <div className="confirm-dialog">
            <h3>Delete Task?</h3>
            <p>This task has content. This action cannot be undone without history.</p>
            <div className="dialog-actions">
              <button onClick={() => setPendingDeleteCard(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  deleteCard(pendingDeleteCard.card.id, pendingDeleteCard.fromSharedBacklog);
                  setPendingDeleteCard(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
