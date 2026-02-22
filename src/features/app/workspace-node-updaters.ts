import type { NodeWorkspaceData, PersistedTreeState } from '../../shared/types';

type NoteboardData = NonNullable<NodeWorkspaceData['noteboard']>;
type KanbanData = NonNullable<NodeWorkspaceData['kanban']>;

const EMPTY_NOTEBOARD: NoteboardData = {
  cards: [],
};

const EMPTY_KANBAN: KanbanData = {
  columns: [],
  cards: [],
  nextTaskNumber: 1,
};

export const updateNodeWorkspaceData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (workspace: NodeWorkspaceData) => NodeWorkspaceData,
): PersistedTreeState => {
  const workspace = state.nodeDataById[nodeId] ?? {};
  const nextWorkspace = updater(workspace);
  if (nextWorkspace === workspace) {
    return state;
  }
  return {
    ...state,
    nodeDataById: {
      ...state.nodeDataById,
      [nodeId]: nextWorkspace,
    },
  };
};

export const updateNodeNoteboardData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (noteboard: NoteboardData, workspace: NodeWorkspaceData) => NoteboardData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.noteboard ?? EMPTY_NOTEBOARD;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      noteboard: next,
    };
  });

export const updateNodeKanbanData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (kanban: KanbanData, workspace: NodeWorkspaceData) => KanbanData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.kanban ?? EMPTY_KANBAN;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      kanban: next,
    };
  });
