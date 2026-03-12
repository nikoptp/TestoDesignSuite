import { ipcMain } from 'electron';
import type {
  CustomThemeDefinition,
  PersistedTreeState,
  ProjectSnapshot,
  SavedImageAsset,
  UserSettings,
  ProjectImageAsset,
  LaunchState,
  SteamAchievementExportRequest,
  SteamAchievementExportResult,
} from '../shared/types';

export type PendingSnapshotRequest = {
  senderId: number;
  resolve: (snapshot: ProjectSnapshot | null) => void;
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
  exportSteamAchievementSet: (
    request: SteamAchievementExportRequest,
  ) => Promise<SteamAchievementExportResult>;
  exportCustomThemeToFile: (theme: CustomThemeDefinition) => Promise<boolean>;
  importCustomThemeFromFile: () => Promise<CustomThemeDefinition | null>;
  getLaunchState: () => Promise<LaunchState>;
  openProjectFile: () => Promise<boolean>;
  openRecentProject: (filePath: string) => Promise<boolean>;
  createNewProject: () => Promise<boolean>;
  checkForGithubUpdates: (manual: boolean) => Promise<void>;
  pendingSnapshotRequests: Map<number, PendingSnapshotRequest>;
};

export const registerIpcHandlers = ({
  loadTreeState,
  saveTreeState,
  loadUserSettings,
  saveUserSettings,
  saveImageAsset,
  listImageAssets,
  deleteImageAsset,
  exportSteamAchievementSet,
  exportCustomThemeToFile,
  importCustomThemeFromFile,
  getLaunchState,
  openProjectFile,
  openRecentProject,
  createNewProject,
  checkForGithubUpdates,
  pendingSnapshotRequests,
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
  ipcMain.handle(
    'steam-achievement:export-set',
    async (_event, request: SteamAchievementExportRequest) => exportSteamAchievementSet(request),
  );
  ipcMain.handle('themes:export-custom', async (_event, theme: CustomThemeDefinition) =>
    exportCustomThemeToFile(theme),
  );
  ipcMain.handle('themes:import-custom', async () => importCustomThemeFromFile());
  ipcMain.handle('project:launch-state', async () => getLaunchState());
  ipcMain.handle('project:open-dialog', async () => openProjectFile());
  ipcMain.handle('project:open-recent', async (_event, filePath: string) =>
    openRecentProject(filePath),
  );
  ipcMain.handle('project:new', async () => createNewProject());
  ipcMain.handle('app:check-updates', async () => {
    await checkForGithubUpdates(true);
  });
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
