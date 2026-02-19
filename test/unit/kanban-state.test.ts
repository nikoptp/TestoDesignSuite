import { describe, expect, it } from 'vitest';
import type { PersistedTreeState } from '../../src/shared/types';
import { ensureKanbanData, getKanbanBoardForNode } from '../../src/features/app/app-model';
import {
  createKanbanCard,
  deleteKanbanCard,
  deleteKanbanColumn,
  migrateKanbanCards,
  moveKanbanCard,
  pasteKanbanCard,
} from '../../src/features/app/kanban-state';

const createState = (): PersistedTreeState => ({
  nodes: [
    {
      id: 'board-a',
      name: 'Board A',
      editorType: 'kanban-board',
      children: [],
    },
    {
      id: 'board-b',
      name: 'Board B',
      editorType: 'kanban-board',
      children: [],
    },
  ],
  selectedNodeId: 'board-a',
  nextNodeNumber: 3,
  nodeDataById: {},
  sharedKanbanBacklogCards: [],
});

describe('kanban state helper operations', () => {
  it('creates and moves backlog cards into board columns', () => {
    const initialized = ensureKanbanData(createState(), 'board-a');
    const withBacklogCard = createKanbanCard(initialized, 'board-a', 'backlog');
    const backlogCardId = withBacklogCard.sharedKanbanBacklogCards?.[0]?.id;
    expect(backlogCardId).toBeTruthy();

    const moved = moveKanbanCard(withBacklogCard, 'board-a', {
      cardId: String(backlogCardId),
      fromSharedBacklog: true,
      toColumnId: 'todo',
      toIndex: 0,
    });

    const board = getKanbanBoardForNode(moved, 'board-a');
    expect(moved.sharedKanbanBacklogCards).toEqual([]);
    expect(board.cards[0]?.columnId).toBe('todo');
  });

  it('migrates all non-done cards from source board to target board', () => {
    let state = ensureKanbanData(createState(), 'board-a');
    state = ensureKanbanData(state, 'board-b');

    state = createKanbanCard(state, 'board-a', 'todo');
    state = createKanbanCard(state, 'board-a', 'doing');
    state = createKanbanCard(state, 'board-a', 'done');

    const migrated = migrateKanbanCards(state, 'board-a', 'board-b');
    const source = getKanbanBoardForNode(migrated, 'board-a');
    const target = getKanbanBoardForNode(migrated, 'board-b');

    expect(source.cards.every((card) => card.columnId === 'done')).toBe(true);
    expect(target.cards.length).toBe(2);
  });

  it('pastes and deletes cards through helper operations', () => {
    let state = ensureKanbanData(createState(), 'board-a');
    state = pasteKanbanCard(state, 'board-a', {
      targetColumnId: 'todo',
      draft: {
        title: 'Pasted card',
        markdown: 'Content',
        priority: 'high',
      },
    });

    const boardAfterPaste = getKanbanBoardForNode(state, 'board-a');
    expect(boardAfterPaste.cards.length).toBe(1);
    expect(boardAfterPaste.cards[0]?.title).toBe('Pasted card');

    const createdId = boardAfterPaste.cards[0]?.id ?? '';
    state = deleteKanbanCard(state, 'board-a', createdId, false);
    const boardAfterDelete = getKanbanBoardForNode(state, 'board-a');
    expect(boardAfterDelete.cards.length).toBe(0);
  });

  it('falls back to a valid column when creating or pasting with unknown target column', () => {
    let state = ensureKanbanData(createState(), 'board-a');

    state = createKanbanCard(state, 'board-a', 'missing-column');
    const afterCreate = getKanbanBoardForNode(state, 'board-a');
    expect(afterCreate.cards[0]?.columnId).toBe('todo');

    state = pasteKanbanCard(state, 'board-a', {
      targetColumnId: 'missing-column',
      draft: {
        title: 'Pasted fallback',
        markdown: '',
        priority: 'none',
      },
    });
    const afterPaste = getKanbanBoardForNode(state, 'board-a');
    expect(afterPaste.cards[1]?.columnId).toBe('todo');
  });

  it('removes deleted columns from collapsedColumnIds', () => {
    let state = ensureKanbanData(createState(), 'board-a');
    state = {
      ...state,
      nodeDataById: {
        ...state.nodeDataById,
        'board-a': {
          ...(state.nodeDataById['board-a'] ?? {}),
          kanban: {
            ...getKanbanBoardForNode(state, 'board-a'),
            collapsedColumnIds: ['backlog', 'todo'],
          },
        },
      },
    };

    state = deleteKanbanColumn(state, 'board-a', 'todo');
    const board = getKanbanBoardForNode(state, 'board-a');
    expect(board.collapsedColumnIds).toEqual(['backlog']);
  });
});
