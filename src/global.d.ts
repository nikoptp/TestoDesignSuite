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
  UserSettings,
} from './shared/types';

declare global {
  interface Window {
    testoApi?: {
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
      exportCustomTheme: (theme: CustomThemeDefinition) => Promise<boolean>;
      importCustomTheme: () => Promise<CustomThemeDefinition | null>;
      onRequestProjectSnapshot: (
        listener: () => ProjectSnapshot | Promise<ProjectSnapshot>,
      ) => () => void;
      onOpenSettings: (listener: () => void) => () => void;
      onProjectStatus: (listener: (payload: ProjectStatusPayload) => void) => () => void;
      getLaunchState: () => Promise<LaunchState>;
      openProjectFileDialog: () => Promise<boolean>;
      openRecentProject: (filePath: string) => Promise<boolean>;
      createNewProject: () => Promise<boolean>;
      checkForUpdates: () => Promise<void>;
    };
  }
}

export {};
