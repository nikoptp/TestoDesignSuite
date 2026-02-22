import { describe, expect, it } from 'vitest';
import type { PersistedTreeState } from '../../src/shared/types';
import {
  updateNodeKanbanData,
  updateNodeNoteboardData,
  updateNodeWorkspaceData,
} from '../../src/features/app/workspace-node-updaters';

const baseState = (): PersistedTreeState => ({
  nodes: [],
  selectedNodeId: null,
  nextNodeNumber: 1,
  nodeDataById: {},
});

describe('workspace-node-updaters', () => {
  it('updates workspace slice immutably', () => {
    const next = updateNodeWorkspaceData(baseState(), 'node-a', (workspace) => ({
      ...workspace,
      document: { markdown: 'hello' },
    }));

    expect(next.nodeDataById['node-a']?.document?.markdown).toBe('hello');
  });

  it('updates noteboard slice with defaults when missing', () => {
    const next = updateNodeNoteboardData(baseState(), 'node-a', (noteboard) => ({
      ...noteboard,
      cards: [{ id: 'card-1', text: '', createdAt: 1, color: '#fff', x: 0, y: 0, width: 200, height: 120 }],
    }));

    expect(next.nodeDataById['node-a']?.noteboard?.cards).toHaveLength(1);
  });

  it('updates kanban slice with defaults when missing', () => {
    const next = updateNodeKanbanData(baseState(), 'node-k', (kanban) => ({
      ...kanban,
      columns: [{ id: 'todo', name: 'To Do', color: '#000000' }],
      cards: [],
      nextTaskNumber: 2,
    }));

    expect(next.nodeDataById['node-k']?.kanban?.nextTaskNumber).toBe(2);
    expect(next.nodeDataById['node-k']?.kanban?.columns[0]?.id).toBe('todo');
  });
});
