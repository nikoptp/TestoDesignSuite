import { contextBridge, ipcRenderer } from 'electron';
import type {
  ApiCapabilities,
  CustomThemeDefinition,
  LaunchState,
  PersistedTreeState,
  ProjectStatusPayload,
  ProjectSnapshot,
  ProjectImageAsset,
  SavedImageAsset,
  SteamAchievementExportRequest,
  SteamAchievementExportResult,
  TerminalActionResult,
  TerminalCommandRequest,
  TerminalCreateSessionRequest,
  TerminalCreateSessionResult,
  TerminalOutputPayload,
  TerminalResizeRequest,
  TerminalSessionStatusPayload,
  TerminalStopByCommandRequest,
  TerminalStopByCommandResult,
  TerminalWriteRequest,
  SteamMarketplaceExportRequest,
  SteamMarketplaceExportResult,
  DocsReadResult,
  DocsRenameRequest,
  DocsWriteRequest,
  ExternalNodeCreateRequestPayload,
  ExternalNodeCreateResponsePayload,
  ProjectDocFileEntry,
  UserSettings,
} from './shared/types';

contextBridge.exposeInMainWorld('testoApi', {
  loadTreeState: (): Promise<PersistedTreeState | null> =>
    ipcRenderer.invoke('tree:load') as Promise<PersistedTreeState | null>,
  saveTreeState: (state: PersistedTreeState): Promise<void> =>
    ipcRenderer.invoke('tree:save', state) as Promise<void>,
  loadUserSettings: (): Promise<UserSettings | null> =>
    ipcRenderer.invoke('settings:load') as Promise<UserSettings | null>,
  saveUserSettings: (settings: UserSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings) as Promise<void>,
  saveImageAsset: (input: { bytes: Uint8Array; mimeType: string }): Promise<SavedImageAsset> =>
    ipcRenderer.invoke('assets:save-image', input) as Promise<SavedImageAsset>,
  listImageAssets: (): Promise<ProjectImageAsset[]> =>
    ipcRenderer.invoke('assets:list-images') as Promise<ProjectImageAsset[]>,
  deleteImageAsset: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke('assets:delete-image', relativePath) as Promise<void>,
  listDocs: (): Promise<ProjectDocFileEntry[]> =>
    ipcRenderer.invoke('docs:list') as Promise<ProjectDocFileEntry[]>,
  readDoc: (relativePath: string): Promise<DocsReadResult> =>
    ipcRenderer.invoke('docs:read', relativePath) as Promise<DocsReadResult>,
  writeDoc: (request: DocsWriteRequest): Promise<DocsReadResult> =>
    ipcRenderer.invoke('docs:write', request) as Promise<DocsReadResult>,
  createDoc: (request: Omit<DocsWriteRequest, 'expectedHash'>): Promise<DocsReadResult> =>
    ipcRenderer.invoke('docs:create', request) as Promise<DocsReadResult>,
  renameDoc: (request: DocsRenameRequest): Promise<{ relativePath: string }> =>
    ipcRenderer.invoke('docs:rename', request) as Promise<{ relativePath: string }>,
  deleteDoc: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke('docs:delete', relativePath) as Promise<void>,
  getCapabilities: (): Promise<ApiCapabilities> =>
    ipcRenderer.invoke('api:get-capabilities') as Promise<ApiCapabilities>,
  exportSteamAchievementSet: (
    request: SteamAchievementExportRequest,
  ): Promise<SteamAchievementExportResult> =>
    ipcRenderer.invoke('steam-achievement:export-set', request) as Promise<SteamAchievementExportResult>,
  exportSteamMarketplaceAssets: (
    request: SteamMarketplaceExportRequest,
  ): Promise<SteamMarketplaceExportResult> =>
    ipcRenderer.invoke('steam-marketplace:export-assets', request) as Promise<SteamMarketplaceExportResult>,
  terminalCreateSession: (
    request: TerminalCreateSessionRequest,
  ): Promise<TerminalCreateSessionResult> =>
    ipcRenderer.invoke('terminal:create-session', request) as Promise<TerminalCreateSessionResult>,
  terminalRunPreset: (request: TerminalCommandRequest): Promise<TerminalActionResult> =>
    ipcRenderer.invoke('terminal:run-command', request) as Promise<TerminalActionResult>,
  terminalWrite: (request: TerminalWriteRequest): Promise<TerminalActionResult> =>
    ipcRenderer.invoke('terminal:write', request) as Promise<TerminalActionResult>,
  terminalResize: (request: TerminalResizeRequest): Promise<TerminalActionResult> =>
    ipcRenderer.invoke('terminal:resize', request) as Promise<TerminalActionResult>,
  terminalStopSession: (sessionId: string): Promise<TerminalActionResult> =>
    ipcRenderer.invoke('terminal:stop-session', sessionId) as Promise<TerminalActionResult>,
  terminalStopByCommand: (
    request: TerminalStopByCommandRequest,
  ): Promise<TerminalStopByCommandResult> =>
    ipcRenderer.invoke('terminal:stop-by-command', request) as Promise<TerminalStopByCommandResult>,
  terminalCloseSession: (sessionId: string): Promise<TerminalActionResult> =>
    ipcRenderer.invoke('terminal:close-session', sessionId) as Promise<TerminalActionResult>,
  terminalOnOutput: (listener: (payload: TerminalOutputPayload) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TerminalOutputPayload): void => {
      listener(payload);
    };
    ipcRenderer.on('terminal:output', wrapped);
    return () => {
      ipcRenderer.removeListener('terminal:output', wrapped);
    };
  },
  terminalOnStatus: (listener: (payload: TerminalSessionStatusPayload) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TerminalSessionStatusPayload): void => {
      listener(payload);
    };
    ipcRenderer.on('terminal:status', wrapped);
    return () => {
      ipcRenderer.removeListener('terminal:status', wrapped);
    };
  },
  exportCustomTheme: (theme: CustomThemeDefinition): Promise<boolean> =>
    ipcRenderer.invoke('themes:export-custom', theme) as Promise<boolean>,
  importCustomTheme: (): Promise<CustomThemeDefinition | null> =>
    ipcRenderer.invoke('themes:import-custom') as Promise<CustomThemeDefinition | null>,
  onRequestProjectSnapshot: (
    listener: () => ProjectSnapshot | Promise<ProjectSnapshot>,
  ): (() => void) => {
    const wrapped = async (_event: Electron.IpcRendererEvent, requestId: number): Promise<void> => {
      try {
        const snapshot = await listener();
        ipcRenderer.send('project:snapshot-response', {
          requestId,
          snapshot,
        });
      } catch {
        ipcRenderer.send('project:snapshot-response', {
          requestId,
          snapshot: null,
        });
      }
    };

    ipcRenderer.on('project:request-snapshot', wrapped);
    return () => {
      ipcRenderer.removeListener('project:request-snapshot', wrapped);
    };
  },
  onOpenSettings: (listener: () => void): (() => void) => {
    const wrapped = (): void => {
      listener();
    };
    ipcRenderer.on('menu:open-settings', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:open-settings', wrapped);
    };
  },
  onProjectStatus: (listener: (payload: ProjectStatusPayload) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ProjectStatusPayload): void => {
      listener(payload);
    };
    ipcRenderer.on('menu:project-status', wrapped);
    return () => {
      ipcRenderer.removeListener('menu:project-status', wrapped);
    };
  },
  onExternalNodeCreateRequest: (
    listener: (
      payload: ExternalNodeCreateRequestPayload,
    ) => Promise<Omit<ExternalNodeCreateResponsePayload, 'requestId'>> | Omit<ExternalNodeCreateResponsePayload, 'requestId'>,
  ): (() => void) => {
    const wrapped = async (
      _event: Electron.IpcRendererEvent,
      payload: ExternalNodeCreateRequestPayload,
    ): Promise<void> => {
      try {
        const result = await listener(payload);
        const responsePayload: ExternalNodeCreateResponsePayload = {
          requestId: payload.requestId,
          ...result,
        };
        ipcRenderer.send('external:nodes-create-response', responsePayload);
      } catch (error: unknown) {
        const responsePayload: ExternalNodeCreateResponsePayload = {
          requestId: payload.requestId,
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        ipcRenderer.send('external:nodes-create-response', responsePayload);
      }
    };
    ipcRenderer.on('external:nodes-create-request', wrapped);
    return () => {
      ipcRenderer.removeListener('external:nodes-create-request', wrapped);
    };
  },
  getLaunchState: (): Promise<LaunchState> =>
    ipcRenderer.invoke('project:launch-state') as Promise<LaunchState>,
  openProjectFileDialog: (): Promise<boolean> =>
    ipcRenderer.invoke('project:open-dialog') as Promise<boolean>,
  terminalPickExecutionFolder: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('terminal:pick-execution-folder', defaultPath) as Promise<string | null>,
  openRecentProject: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('project:open-recent', filePath) as Promise<boolean>,
  createNewProject: (): Promise<boolean> =>
    ipcRenderer.invoke('project:new') as Promise<boolean>,
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke('app:check-updates') as Promise<void>,
});
