import { ipcMain } from 'electron';
import type {
  CustomThemeDefinition,
  PersistedTreeState,
  ProjectSnapshot,
  SavedImageAsset,
  UserSettings,
  ProjectImageAsset,
  LaunchState,
  ApiCapabilities,
  DocsReadResult,
  DocsRenameRequest,
  DocsWriteRequest,
  ProjectDocFileEntry,
  ExternalNodeCreateResponsePayload,
  SteamAchievementExportRequest,
  SteamAchievementExportResult,
  TerminalActionResult,
  TerminalCommandRequest,
  TerminalCreateSessionRequest,
  TerminalCreateSessionResult,
  TerminalResizeRequest,
  TerminalStopByCommandRequest,
  TerminalStopByCommandResult,
  TerminalWriteRequest,
  SteamMarketplaceExportRequest,
  SteamMarketplaceExportResult,
} from '../shared/types';

export type PendingSnapshotRequest = {
  senderId: number;
  resolve: (snapshot: ProjectSnapshot | null) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export type PendingExternalNodeCreateRequest = {
  senderId: number;
  resolve: (payload: ExternalNodeCreateResponsePayload) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type RegisterIpcHandlersDeps = {
  loadTreeState: () => Promise<PersistedTreeState | null>;
  saveTreeState: (state: PersistedTreeState) => Promise<void>;
  loadUserSettings: () => Promise<UserSettings | null>;
  saveUserSettings: (settings: UserSettings) => Promise<void>;
  saveImageAsset: (input: { bytes: Uint8Array; mimeType: string }) => Promise<SavedImageAsset>;
  listImageAssets: () => Promise<ProjectImageAsset[]>;
  deleteImageAsset: (relativePath: string) => Promise<void>;
  listProjectDocs: () => Promise<ProjectDocFileEntry[]>;
  readProjectDoc: (relativePath: string) => Promise<DocsReadResult>;
  writeProjectDoc: (request: DocsWriteRequest) => Promise<DocsReadResult>;
  createProjectDoc: (request: Omit<DocsWriteRequest, 'expectedHash'>) => Promise<DocsReadResult>;
  renameProjectDoc: (request: DocsRenameRequest) => Promise<{ relativePath: string }>;
  deleteProjectDoc: (relativePath: string) => Promise<void>;
  exportSteamAchievementSet: (
    request: SteamAchievementExportRequest,
  ) => Promise<SteamAchievementExportResult>;
  exportSteamMarketplaceAssets: (
    request: SteamMarketplaceExportRequest,
  ) => Promise<SteamMarketplaceExportResult>;
  terminalCreateSession: (
    ownerWebContentsId: number,
    request: TerminalCreateSessionRequest,
  ) => Promise<TerminalCreateSessionResult>;
  terminalRunCommand: (request: TerminalCommandRequest) => TerminalActionResult;
  terminalWrite: (request: TerminalWriteRequest) => TerminalActionResult;
  terminalResize: (request: TerminalResizeRequest) => TerminalActionResult;
  terminalStopSession: (sessionId: string) => TerminalActionResult;
  terminalStopByCommand: (request: TerminalStopByCommandRequest) => TerminalStopByCommandResult;
  terminalCloseSession: (sessionId: string) => TerminalActionResult;
  exportCustomThemeToFile: (theme: CustomThemeDefinition) => Promise<boolean>;
  importCustomThemeFromFile: () => Promise<CustomThemeDefinition | null>;
  getLaunchState: () => Promise<LaunchState>;
  openProjectFile: () => Promise<boolean>;
  pickExecutionFolder: (defaultPath?: string) => Promise<string | null>;
  openRecentProject: (filePath: string) => Promise<boolean>;
  createNewProject: () => Promise<boolean>;
  checkForGithubUpdates: (manual: boolean) => Promise<void>;
  getApiCapabilities: () => ApiCapabilities;
  pendingSnapshotRequests: Map<number, PendingSnapshotRequest>;
  pendingExternalNodeCreateRequests: Map<number, PendingExternalNodeCreateRequest>;
};

export const registerIpcHandlers = ({
  loadTreeState,
  saveTreeState,
  loadUserSettings,
  saveUserSettings,
  saveImageAsset,
  listImageAssets,
  deleteImageAsset,
  listProjectDocs,
  readProjectDoc,
  writeProjectDoc,
  createProjectDoc,
  renameProjectDoc,
  deleteProjectDoc,
  exportSteamAchievementSet,
  exportSteamMarketplaceAssets,
  terminalCreateSession,
  terminalRunCommand,
  terminalWrite,
  terminalResize,
  terminalStopSession,
  terminalStopByCommand,
  terminalCloseSession,
  exportCustomThemeToFile,
  importCustomThemeFromFile,
  getLaunchState,
  openProjectFile,
  pickExecutionFolder,
  openRecentProject,
  createNewProject,
  checkForGithubUpdates,
  getApiCapabilities,
  pendingSnapshotRequests,
  pendingExternalNodeCreateRequests,
}: RegisterIpcHandlersDeps): void => {
  ipcMain.handle('tree:load', async () => loadTreeState());
  ipcMain.handle('tree:save', async (_event, state: PersistedTreeState) => {
    await saveTreeState(state);
  });
  ipcMain.handle('settings:load', async () => loadUserSettings());
  ipcMain.handle('settings:save', async (_event, settings: UserSettings) => {
    await saveUserSettings(settings);
  });
  ipcMain.handle(
    'assets:save-image',
    async (
      _event,
      input: {
        bytes: Uint8Array;
        mimeType: string;
      },
    ) => saveImageAsset(input),
  );
  ipcMain.handle('assets:list-images', async () => listImageAssets());
  ipcMain.handle('assets:delete-image', async (_event, relativePath: string) => {
    await deleteImageAsset(relativePath);
  });
  ipcMain.handle('docs:list', async () => listProjectDocs());
  ipcMain.handle('docs:read', async (_event, relativePath: string) => readProjectDoc(relativePath));
  ipcMain.handle('docs:write', async (_event, request: DocsWriteRequest) => writeProjectDoc(request));
  ipcMain.handle(
    'docs:create',
    async (_event, request: Omit<DocsWriteRequest, 'expectedHash'>) => createProjectDoc(request),
  );
  ipcMain.handle('docs:rename', async (_event, request: DocsRenameRequest) => renameProjectDoc(request));
  ipcMain.handle('docs:delete', async (_event, relativePath: string) => {
    await deleteProjectDoc(relativePath);
  });
  ipcMain.handle(
    'steam-achievement:export-set',
    async (_event, request: SteamAchievementExportRequest) => exportSteamAchievementSet(request),
  );
  ipcMain.handle(
    'steam-marketplace:export-assets',
    async (_event, request: SteamMarketplaceExportRequest) => exportSteamMarketplaceAssets(request),
  );
  ipcMain.handle(
    'terminal:create-session',
    async (event, request: TerminalCreateSessionRequest) =>
      terminalCreateSession(event.sender.id, request),
  );
  ipcMain.handle('terminal:run-command', async (_event, request: TerminalCommandRequest) =>
    terminalRunCommand(request),
  );
  ipcMain.handle('terminal:write', async (_event, request: TerminalWriteRequest) =>
    terminalWrite(request),
  );
  ipcMain.handle('terminal:resize', async (_event, request: TerminalResizeRequest) =>
    terminalResize(request),
  );
  ipcMain.handle('terminal:stop-session', async (_event, sessionId: string) =>
    terminalStopSession(sessionId),
  );
  ipcMain.handle(
    'terminal:stop-by-command',
    async (_event, request: TerminalStopByCommandRequest) => terminalStopByCommand(request),
  );
  ipcMain.handle('terminal:close-session', async (_event, sessionId: string) =>
    terminalCloseSession(sessionId),
  );
  ipcMain.handle('themes:export-custom', async (_event, theme: CustomThemeDefinition) =>
    exportCustomThemeToFile(theme),
  );
  ipcMain.handle('themes:import-custom', async () => importCustomThemeFromFile());
  ipcMain.handle('project:launch-state', async () => getLaunchState());
  ipcMain.handle('project:open-dialog', async () => openProjectFile());
  ipcMain.handle('terminal:pick-execution-folder', async (_event, defaultPath?: string) =>
    pickExecutionFolder(defaultPath),
  );
  ipcMain.handle('project:open-recent', async (_event, filePath: string) =>
    openRecentProject(filePath),
  );
  ipcMain.handle('project:new', async () => createNewProject());
  ipcMain.handle('app:check-updates', async () => {
    await checkForGithubUpdates(true);
  });
  ipcMain.handle('api:get-capabilities', async () => getApiCapabilities());
  ipcMain.on(
    'external:nodes-create-response',
    (
      event,
      payload:
        | {
            requestId?: unknown;
            ok?: unknown;
            createdNodeId?: unknown;
            error?: unknown;
          }
        | undefined,
    ) => {
      if (!payload || typeof payload.requestId !== 'number' || typeof payload.ok !== 'boolean') {
        return;
      }
      const pending = pendingExternalNodeCreateRequests.get(payload.requestId);
      if (!pending || pending.senderId !== event.sender.id) {
        return;
      }
      clearTimeout(pending.timeout);
      pendingExternalNodeCreateRequests.delete(payload.requestId);
      pending.resolve({
        requestId: payload.requestId,
        ok: payload.ok,
        createdNodeId: typeof payload.createdNodeId === 'string' ? payload.createdNodeId : undefined,
        error: typeof payload.error === 'string' ? payload.error : undefined,
      });
    },
  );
  ipcMain.on(
    'project:snapshot-response',
    (
      event,
      payload:
        | {
            requestId?: unknown;
            snapshot?: unknown;
          }
        | undefined,
    ) => {
      if (!payload || typeof payload.requestId !== 'number') {
        return;
      }

      const pending = pendingSnapshotRequests.get(payload.requestId);
      if (!pending || pending.senderId !== event.sender.id) {
        return;
      }

      clearTimeout(pending.timeout);
      pendingSnapshotRequests.delete(payload.requestId);

      const snapshotCandidate = payload.snapshot as Partial<ProjectSnapshot> | null | undefined;
      if (
        snapshotCandidate &&
        typeof snapshotCandidate === 'object' &&
        typeof snapshotCandidate.treeState === 'object' &&
        snapshotCandidate.treeState !== null &&
        typeof snapshotCandidate.userSettings === 'object' &&
        snapshotCandidate.userSettings !== null
      ) {
        pending.resolve({
          treeState: snapshotCandidate.treeState as PersistedTreeState,
          userSettings: snapshotCandidate.userSettings as UserSettings,
        });
        return;
      }

      pending.resolve(null);
    },
  );
};
