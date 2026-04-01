import { createDefaultSteamAchievementArtData } from '../steam-achievement/steam-achievement-art';
import { createDefaultSteamMarketplaceAssetData } from '../steam-marketplace/steam-marketplace-assets';
import { createDefaultTerminalCommandCenterData } from '../terminal-command-center/terminal-command-center';
import type { NodeWorkspaceData, PersistedTreeState } from '../../shared/types';

type NoteboardData = NonNullable<NodeWorkspaceData['noteboard']>;
type KanbanData = NonNullable<NodeWorkspaceData['kanban']>;
type SpreadsheetData = NonNullable<NodeWorkspaceData['spreadsheet']>;
type SteamAchievementArtData = NonNullable<NodeWorkspaceData['steamAchievementArt']>;
type SteamMarketplaceAssetData = NonNullable<NodeWorkspaceData['steamMarketplaceAssets']>;
type TerminalCommandCenterData = NonNullable<NodeWorkspaceData['terminalCommandCenter']>;

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

const EMPTY_STEAM_ACHIEVEMENT_ART: SteamAchievementArtData = createDefaultSteamAchievementArtData();

const EMPTY_STEAM_MARKETPLACE_ASSETS: SteamMarketplaceAssetData =
  createDefaultSteamMarketplaceAssetData();
const EMPTY_TERMINAL_COMMAND_CENTER: TerminalCommandCenterData = createDefaultTerminalCommandCenterData();

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

export const updateNodeSteamAchievementArtData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (
    steamAchievementArt: SteamAchievementArtData,
    workspace: NodeWorkspaceData,
  ) => SteamAchievementArtData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.steamAchievementArt ?? EMPTY_STEAM_ACHIEVEMENT_ART;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      steamAchievementArt: next,
    };
  });

export const updateNodeSteamMarketplaceAssetsData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (
    steamMarketplaceAssets: SteamMarketplaceAssetData,
    workspace: NodeWorkspaceData,
  ) => SteamMarketplaceAssetData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.steamMarketplaceAssets ?? EMPTY_STEAM_MARKETPLACE_ASSETS;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      steamMarketplaceAssets: next,
    };
  });

export const updateNodeTerminalCommandCenterData = (
  state: PersistedTreeState,
  nodeId: string,
  updater: (
    terminalCommandCenter: TerminalCommandCenterData,
    workspace: NodeWorkspaceData,
  ) => TerminalCommandCenterData,
): PersistedTreeState =>
  updateNodeWorkspaceData(state, nodeId, (workspace) => {
    const current = workspace.terminalCommandCenter ?? EMPTY_TERMINAL_COMMAND_CENTER;
    const next = updater(current, workspace);
    if (next === current) {
      return workspace;
    }
    return {
      ...workspace,
      terminalCommandCenter: next,
    };
  });
