import { contextBridge, ipcRenderer } from 'electron';
import type {
  CustomThemeDefinition,
  LaunchState,
  PersistedTreeState,
  ProjectStatusPayload,
  ProjectSnapshot,
  ProjectImageAsset,
  SavedImageAsset,
  SteamAchievementExportRequest,
  SteamAchievementExportResult,
  SteamMarketplaceExportRequest,
  SteamMarketplaceExportResult,
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
  exportSteamAchievementSet: (
    request: SteamAchievementExportRequest,
  ): Promise<SteamAchievementExportResult> =>
    ipcRenderer.invoke('steam-achievement:export-set', request) as Promise<SteamAchievementExportResult>,
  exportSteamMarketplaceAssets: (
    request: SteamMarketplaceExportRequest,
  ): Promise<SteamMarketplaceExportResult> =>
    ipcRenderer.invoke('steam-marketplace:export-assets', request) as Promise<SteamMarketplaceExportResult>,
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
  getLaunchState: (): Promise<LaunchState> =>
    ipcRenderer.invoke('project:launch-state') as Promise<LaunchState>,
  openProjectFileDialog: (): Promise<boolean> =>
    ipcRenderer.invoke('project:open-dialog') as Promise<boolean>,
  openRecentProject: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('project:open-recent', filePath) as Promise<boolean>,
  createNewProject: (): Promise<boolean> =>
    ipcRenderer.invoke('project:new') as Promise<boolean>,
  checkForUpdates: (): Promise<void> =>
    ipcRenderer.invoke('app:check-updates') as Promise<void>,
});
