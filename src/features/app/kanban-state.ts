import type { KanbanCard, KanbanPriority, PersistedTreeState } from '../../shared/types';
import {
  ensureKanbanData,
  getKanbanBoardForNode,
} from './app-model';
import { updateNodeKanbanData } from './workspace-node-updaters';

type MoveKanbanCardInput = {
  cardId: string;
  fromSharedBacklog: boolean;
  toColumnId: string;
  toIndex: number;
};

type UpdateKanbanCardInput = {
  cardId: string;
  fromSharedBacklog: boolean;
  patch: Partial<Pick<KanbanCard, 'title' | 'priority' | 'markdown'>>;
};

type PasteKanbanCardInput = {
  targetColumnId: string;
  draft: Pick<KanbanCard, 'title' | 'markdown' | 'priority'>;
};

const COLUMN_COLOR_PALETTE = ['#5f6f8a', '#4e6d91', '#d4b63a', '#5b9a5b', '#745890'];

const withBoard = (state: PersistedTreeState, nodeId: string) => {
  const next = ensureKanbanData(state, nodeId);
  const board = getKanbanBoardForNode(next, nodeId);
  return { next, board };
};

const resolveValidColumnId = (board: ReturnType<typeof getKanbanBoardForNode>, columnId: string): string => {
  const requested = columnId?.trim() ?? '';
  if (requested && board.columns.some((column) => column.id === requested)) {
    return requested;
  }
  return (
    board.columns.find((column) => column.id === 'todo')?.id ??
    board.columns.find((column) => column.id !== 'backlog')?.id ??
    board.columns[0]?.id ??
    'todo'
  );
};

const insertIntoColumn = (
  cards: KanbanCard[],
  targetColumnId: string,
  targetIndex: number,
  movedCard: KanbanCard,
): KanbanCard[] => {
  const base = cards.filter((card) => card.id !== movedCard.id);
  const result: KanbanCard[] = [];
  let inserted = false;
  let seenInColumn = 0;

  base.forEach((card) => {
    if (!inserted && card.columnId === targetColumnId && seenInColumn === targetIndex) {
      result.push(movedCard);
      inserted = true;
    }
    if (card.columnId === targetColumnId) {
      seenInColumn += 1;
    }
    result.push(card);
  });

  if (!inserted) {
    result.push(movedCard);
  }
  return result;
};

export const createKanbanCard = (
  state: PersistedTreeState,
  nodeId: string,
  columnId: string,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);
  const targetColumnId = resolveValidColumnId(board, columnId);
  const taskNumber = board.nextTaskNumber;
  const now = Date.now();
  const created: KanbanCard = {
    id: `kanban-card-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Task #${taskNumber}`,
    markdown: '',
    taskNumber,
    priority: 'none',
    columnId: targetColumnId,
    createdAt: now,
    updatedAt: now,
  };

  const isBacklog = targetColumnId === 'backlog';
  const boardCards = isBacklog ? board.cards : [...board.cards, created];
  const sharedBacklogCards = isBacklog
    ? [...(next.sharedKanbanBacklogCards ?? []), { ...created, columnId: 'backlog' }]
    : [...(next.sharedKanbanBacklogCards ?? [])];

  return {
    ...updateNodeKanbanData(next, nodeId, () => ({
      ...board,
      cards: boardCards,
      nextTaskNumber: taskNumber + 1,
    })),
    sharedKanbanBacklogCards: sharedBacklogCards,
  };
};

export const moveKanbanCard = (
  state: PersistedTreeState,
  nodeId: string,
  input: MoveKanbanCardInput,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);
  const targetColumnId = resolveValidColumnId(board, input.toColumnId);

  const sharedBacklogCards = [...(next.sharedKanbanBacklogCards ?? [])];
  const boardCards = [...board.cards];

  const sourcePool = input.fromSharedBacklog ? sharedBacklogCards : boardCards;
  const sourceIndex = sourcePool.findIndex((card) => card.id === input.cardId);
  if (sourceIndex === -1) {
    return state;
  }

  const moving = { ...sourcePool[sourceIndex], columnId: targetColumnId, updatedAt: Date.now() };

  let nextBacklog = sharedBacklogCards;
  let nextBoardCards = boardCards;

  if (input.fromSharedBacklog) {
    nextBacklog = sharedBacklogCards.filter((card) => card.id !== input.cardId);
  } else {
    nextBoardCards = boardCards.filter((card) => card.id !== input.cardId);
  }

  if (targetColumnId === 'backlog') {
    nextBacklog = insertIntoColumn(nextBacklog, 'backlog', input.toIndex, {
      ...moving,
      columnId: 'backlog',
    });
  } else {
    nextBoardCards = insertIntoColumn(nextBoardCards, targetColumnId, input.toIndex, moving);
  }

  return {
    ...updateNodeKanbanData(next, nodeId, () => ({
      ...board,
      cards: nextBoardCards,
    })),
    sharedKanbanBacklogCards: nextBacklog,
  };
};

export const updateKanbanCard = (
  state: PersistedTreeState,
  nodeId: string,
  input: UpdateKanbanCardInput,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);

  if (input.fromSharedBacklog) {
    return {
      ...next,
      sharedKanbanBacklogCards: (next.sharedKanbanBacklogCards ?? []).map((card) =>
        card.id === input.cardId
          ? {
              ...card,
              ...input.patch,
              updatedAt: Date.now(),
            }
          : card,
      ),
    };
  }

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    cards: board.cards.map((card) =>
      card.id === input.cardId
        ? {
            ...card,
            ...input.patch,
            updatedAt: Date.now(),
          }
        : card,
    ),
  }));
};

export const deleteKanbanCard = (
  state: PersistedTreeState,
  nodeId: string,
  cardId: string,
  fromSharedBacklog: boolean,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);

  if (fromSharedBacklog) {
    return {
      ...next,
      sharedKanbanBacklogCards: (next.sharedKanbanBacklogCards ?? []).filter(
        (card) => card.id !== cardId,
      ),
    };
  }

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    cards: board.cards.filter((card) => card.id !== cardId),
  }));
};

export const pasteKanbanCard = (
  state: PersistedTreeState,
  nodeId: string,
  input: PasteKanbanCardInput,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);
  const taskNumber = board.nextTaskNumber;
  const now = Date.now();
  const normalizedColumnId = resolveValidColumnId(board, input.targetColumnId);

  const created: KanbanCard = {
    id: `kanban-card-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.draft.title.trim() || `Task #${taskNumber}`,
    markdown: input.draft.markdown,
    priority: input.draft.priority,
    taskNumber,
    columnId: normalizedColumnId,
    createdAt: now,
    updatedAt: now,
  };

  const isBacklog = normalizedColumnId === 'backlog';
  const nextBoardCards = isBacklog ? board.cards : [...board.cards, created];
  const nextSharedBacklog = isBacklog
    ? [...(next.sharedKanbanBacklogCards ?? []), { ...created, columnId: 'backlog' }]
    : [...(next.sharedKanbanBacklogCards ?? [])];

  return {
    ...updateNodeKanbanData(next, nodeId, () => ({
      ...board,
      cards: nextBoardCards,
      nextTaskNumber: taskNumber + 1,
    })),
    sharedKanbanBacklogCards: nextSharedBacklog,
  };
};

export const addKanbanColumn = (state: PersistedTreeState, nodeId: string): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);
  const nextIndex = board.columns.length + 1;
  const idBase = `col-${Date.now().toString(36)}`;
  const color = COLUMN_COLOR_PALETTE[nextIndex % COLUMN_COLOR_PALETTE.length];

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    columns: [...board.columns, { id: idBase, name: `Column ${nextIndex}`, color }],
  }));
};

export const renameKanbanColumn = (
  state: PersistedTreeState,
  nodeId: string,
  columnId: string,
  name: string,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, name: name.trim() || column.name } : column,
    ),
  }));
};

export const recolorKanbanColumn = (
  state: PersistedTreeState,
  nodeId: string,
  columnId: string,
  color: string,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, color } : column,
    ),
  }));
};

export const deleteKanbanColumn = (
  state: PersistedTreeState,
  nodeId: string,
  columnId: string,
): PersistedTreeState => {
  const { next, board } = withBoard(state, nodeId);
  const remainingColumns = board.columns.filter((column) => column.id !== columnId);
  const fallbackColumnId =
    remainingColumns.find((column) => column.name === 'To Do')?.id ??
    remainingColumns.find((column) => column.id !== 'backlog')?.id ??
    'backlog';

  const nextCards = board.cards.map((card) =>
    card.columnId === columnId ? { ...card, columnId: fallbackColumnId, updatedAt: Date.now() } : card,
  );

  return updateNodeKanbanData(next, nodeId, () => ({
    ...board,
    columns: remainingColumns,
    cards: nextCards,
    collapsedColumnIds: (board.collapsedColumnIds ?? []).filter((id) => id !== columnId),
  }));
};

export const migrateKanbanCards = (
  state: PersistedTreeState,
  sourceNodeId: string,
  targetNodeId: string,
): PersistedTreeState => {
  const withSource = ensureKanbanData(state, sourceNodeId);
  const withBoth = ensureKanbanData(withSource, targetNodeId);

  const sourceWorkspace = withBoth.nodeDataById[sourceNodeId] ?? {};
  const targetWorkspace = withBoth.nodeDataById[targetNodeId] ?? {};
  const sourceBoard = getKanbanBoardForNode(withBoth, sourceNodeId);
  const targetBoard = getKanbanBoardForNode(withBoth, targetNodeId);

  const doneColumnIds = sourceBoard.columns
    .filter((column) => column.name === 'Done')
    .map((column) => column.id);
  const movingCards = sourceBoard.cards.filter((card) => !doneColumnIds.includes(card.columnId));
  if (movingCards.length === 0) {
    return state;
  }

  const sourceByColumnId = new Map(sourceBoard.columns.map((column) => [column.id, column.name]));
  const targetByName = new Map(targetBoard.columns.map((column) => [column.name, column.id]));
  const targetDefaultColumnId =
    targetByName.get('To Do') ??
    targetBoard.columns.find((column) => column.id !== 'backlog')?.id ??
    targetBoard.columns[0]?.id ??
    'todo';

  const movedForTarget = movingCards.map((card) => {
    const sourceColumnName = sourceByColumnId.get(card.columnId);
    const mappedColumnId =
      (sourceColumnName ? targetByName.get(sourceColumnName) : undefined) ?? targetDefaultColumnId;
    return {
      ...card,
      columnId: mappedColumnId,
      updatedAt: Date.now(),
    };
  });

  return {
    ...withBoth,
    nodeDataById: {
      ...withBoth.nodeDataById,
      [sourceNodeId]: {
        ...sourceWorkspace,
        kanban: {
          ...sourceBoard,
          cards: sourceBoard.cards.filter((card) => doneColumnIds.includes(card.columnId)),
        },
      },
      [targetNodeId]: {
        ...targetWorkspace,
        kanban: {
          ...targetBoard,
          cards: [...targetBoard.cards, ...movedForTarget],
        },
      },
    },
  };
};

export type { MoveKanbanCardInput };
export type { UpdateKanbanCardInput };
export type { PasteKanbanCardInput };
export type { KanbanPriority };
