import type { NodeWorkspaceData, PersistedTreeState } from '../../shared/types';

type NoteboardData = NonNullable<NodeWorkspaceData['noteboard']>;
type KanbanData = NonNullable<NodeWorkspaceData['kanban']>;
type SpreadsheetData = NonNullable<NodeWorkspaceData['spreadsheet']>;

const EMPTY_NOTEBOARD: NoteboardData = {
  cards: [],
};

const EMPTY_KANBAN: KanbanData = {
  columns: [],
  cards: [],
  nextTaskNumber: 1,
};

const EMPTY_SPREADSHEET: SpreadsheetData = {
  sheets: [],
  activeSheetId: '',
  activeCellKey: 'A1',
  rowCount: 50,
  columnCount: 26,
  rowHeights: {},
  columnWidths: {},
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

export const updateNodeSpreadsheetData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (spreadsheet: SpreadsheetData, workspace: NodeWorkspaceData) => SpreadsheetData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.spreadsheet ?? EMPTY_SPREADSHEET;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      spreadsheet: next,
    };
  });
