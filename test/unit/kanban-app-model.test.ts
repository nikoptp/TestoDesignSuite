import { describe, expect, it } from 'vitest';
import type { PersistedTreeState } from '../../src/shared/types';
import {
  KANBAN_DEFAULT_COLUMNS,
  ensureKanbanData,
  getKanbanBoardForNode,
  getSharedKanbanBacklogCards,
} from '../../src/features/app/app-model';

const createBaseState = (): PersistedTreeState => ({
  nodes: [
    {
      id: 'node-kanban',
      name: 'Kanban Node',
      editorType: 'kanban-board',
      children: [],
    },
  ],
  selectedNodeId: 'node-kanban',
  nextNodeNumber: 2,
  nodeDataById: {},
  sharedKanbanBacklogCards: [],
});

describe('kanban app-model helpers', () => {
  it('exposes default columns including Backlog, To Do, Doing, Done', () => {
    expect(KANBAN_DEFAULT_COLUMNS.map((column) => column.name)).toEqual([
      'Backlog',
      'To Do',
      'Doing',
      'Done',
    ]);
  });

  it('ensureKanbanData initializes missing board payload', () => {
    const state = createBaseState();
    const ensured = ensureKanbanData(state, 'node-kanban');
    const board = getKanbanBoardForNode(ensured, 'node-kanban');

    expect(board.columns.map((column) => column.id)).toContain('backlog');
    expect(board.cards).toEqual([]);
    expect(board.nextTaskNumber).toBe(1);
  });

  it('ensureKanbanData normalizes malformed board cards and shared backlog cards', () => {
    const now = Date.now();
    const state: PersistedTreeState = {
      ...createBaseState(),
      nodeDataById: {
        'node-kanban': {
          kanban: {
            columns: [
              { id: 'todo', name: 'To Do', color: '#4e6d91' },
              { id: 'done', name: 'Done', color: '#5b9a5b' },
            ],
            cards: [
              {
                id: 'board-1',
                title: 'Board card',
                markdown: '' as unknown as string,
                taskNumber: 0 as unknown as number,
                priority: 'urgent' as unknown as 'none',
                columnId: '',
                createdAt: now,
                updatedAt: now,
              },
            ],
            nextTaskNumber: 0,
          },
        },
      },
      sharedKanbanBacklogCards: [
        {
          id: 'shared-1',
          title: 'Shared card',
          markdown: undefined as unknown as string,
          taskNumber: -5 as unknown as number,
          priority: 'urgent' as unknown as 'none',
          columnId: 'todo',
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const ensured = ensureKanbanData(state, 'node-kanban');
    const board = getKanbanBoardForNode(ensured, 'node-kanban');
    const backlog = getSharedKanbanBacklogCards(ensured);

    expect(board.columns.some((column) => column.id === 'backlog')).toBe(true);
    expect(board.cards[0]?.priority).toBe('none');
    expect(board.cards[0]?.taskNumber).toBe(1);
    expect(board.cards[0]?.columnId).toBe('todo');
    expect(board.nextTaskNumber).toBe(2);

    expect(backlog[0]?.priority).toBe('none');
    expect(backlog[0]?.taskNumber).toBe(1);
    expect(backlog[0]?.columnId).toBe('backlog');
    expect(backlog[0]?.markdown).toBe('');
  });
});
