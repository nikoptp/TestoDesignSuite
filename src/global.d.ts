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
      listDocs: () => Promise<ProjectDocFileEntry[]>;
      readDoc: (relativePath: string) => Promise<DocsReadResult>;
      writeDoc: (request: DocsWriteRequest) => Promise<DocsReadResult>;
      createDoc: (request: Omit<DocsWriteRequest, 'expectedHash'>) => Promise<DocsReadResult>;
      renameDoc: (request: DocsRenameRequest) => Promise<{ relativePath: string }>;
      deleteDoc: (relativePath: string) => Promise<void>;
      getCapabilities: () => Promise<ApiCapabilities>;
      exportSteamAchievementSet: (
        request: SteamAchievementExportRequest,
      ) => Promise<SteamAchievementExportResult>;
      exportSteamMarketplaceAssets: (
        request: SteamMarketplaceExportRequest,
      ) => Promise<SteamMarketplaceExportResult>;
      terminalCreateSession: (
        request: TerminalCreateSessionRequest,
      ) => Promise<TerminalCreateSessionResult>;
      terminalRunPreset: (request: TerminalCommandRequest) => Promise<TerminalActionResult>;
      terminalWrite: (request: TerminalWriteRequest) => Promise<TerminalActionResult>;
      terminalResize: (request: TerminalResizeRequest) => Promise<TerminalActionResult>;
      terminalStopSession: (sessionId: string) => Promise<TerminalActionResult>;
      terminalStopByCommand: (
        request: TerminalStopByCommandRequest,
      ) => Promise<TerminalStopByCommandResult>;
      terminalCloseSession: (sessionId: string) => Promise<TerminalActionResult>;
      terminalOnOutput: (listener: (payload: TerminalOutputPayload) => void) => () => void;
      terminalOnStatus: (listener: (payload: TerminalSessionStatusPayload) => void) => () => void;
      exportCustomTheme: (theme: CustomThemeDefinition) => Promise<boolean>;
      importCustomTheme: () => Promise<CustomThemeDefinition | null>;
      onRequestProjectSnapshot: (
        listener: () => ProjectSnapshot | Promise<ProjectSnapshot>,
      ) => () => void;
      onOpenSettings: (listener: () => void) => () => void;
      onProjectStatus: (listener: (payload: ProjectStatusPayload) => void) => () => void;
      onExternalNodeCreateRequest: (
        listener: (
          payload: ExternalNodeCreateRequestPayload,
        ) =>
          | Promise<Omit<ExternalNodeCreateResponsePayload, 'requestId'>>
          | Omit<ExternalNodeCreateResponsePayload, 'requestId'>,
      ) => () => void;
      getLaunchState: () => Promise<LaunchState>;
      openProjectFileDialog: () => Promise<boolean>;
      terminalPickExecutionFolder: (defaultPath?: string) => Promise<string | null>;
      openRecentProject: (filePath: string) => Promise<boolean>;
      createNewProject: () => Promise<boolean>;
      checkForUpdates: () => Promise<void>;
    };
  }
}

export {};
