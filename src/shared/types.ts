export type EditorType =
  | 'noteboard'
  | 'kanban-board'
  | 'spreadsheet'
  | 'story-document'
  | 'steam-achievement-art'
  | 'steam-marketplace-assets'
  | 'terminal-command-center';

export type CategoryNode = {
  id: string;
  name: string;
  editorType: EditorType;
  children: CategoryNode[];
};

export type PersistedTreeState = {
  schemaVersion?: number;
  nodes: CategoryNode[];
  selectedNodeId: string | null;
  nextNodeNumber: number;
  nodeDataById: Record<string, NodeWorkspaceData>;
  sharedKanbanBacklogCards?: KanbanCard[];
  sidebarWidth?: number;
  collapsedNodeIds?: string[];
};

export type UserSettings = {
  theme: AppTheme;
  activeCustomThemeId?: string;
  drawingTool?: 'pen' | 'brush' | 'eraser';
  drawingBrush?: NoteboardBrushType;
  drawingSize?: number;
  drawingOpacity?: number;
  drawingColor?: string;
  drawingPresetColors?: string[];
  cardTemplates?: CardTemplate[];
  customThemes?: CustomThemeDefinition[];
};

export type AppTheme = 'parchment' | 'midnight' | 'evergreen';

export type NoteboardCard = {
  id: string;
  text: string;
  createdAt: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NoteboardBrushType = 'pen' | 'ink' | 'marker' | 'charcoal';

export type NoteboardStrokePoint = {
  x: number;
  y: number;
  pressure?: number;
  t?: number;
};

export type NoteboardStroke = {
  id: string;
  createdAt: number;
  brush: NoteboardBrushType;
  color: string;
  size: number;
  opacity: number;
  points: NoteboardStrokePoint[];
};

export type KanbanPriority = 'none' | 'low' | 'medium' | 'high';

export type KanbanColumn = {
  id: string;
  name: string;
  color: string;
};

export type KanbanCard = {
  id: string;
  title: string;
  markdown: string;
  taskNumber: number;
  priority: KanbanPriority;
  columnId: string;
  collaboration?: {
    assigneeId?: string | null;
    createdById?: string | null;
    watcherIds?: string[];
  };
  createdAt: number;
  updatedAt: number;
};

export type SpreadsheetCell = {
  raw: string;
};

export type SpreadsheetSheet = {
  id: string;
  name: string;
  cells: Record<string, SpreadsheetCell>;
};

export type SpreadsheetData = {
  sheets: SpreadsheetSheet[];
  activeSheetId: string;
  activeCellKey: string;
  rowCount: number;
  columnCount: number;
  rowHeights?: Record<string, number>;
  columnWidths?: Record<string, number>;
};

export type SteamImagePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  exportColor: boolean;
  exportGrayscale: boolean;
  grayscaleSuffix: string;
};

export type SteamAchievementBorderStyle = {
  enabled: boolean;
  thickness: number;
  opacity: number;
  margin: number;
  radius: number;
  gradientAngle: number;
  color: string;
  midColor: string;
  gradientColor: string;
  backgroundMode: 'none' | 'gradient' | 'image';
  backgroundOpacity: number;
  backgroundGradientOverlayEnabled: boolean;
  backgroundGradientOpacity: number;
  backgroundAngle: number;
  backgroundColor: string;
  backgroundMidColor: string;
  backgroundGradientColor: string;
  backgroundImageRelativePath: string | null;
};

export type SteamAchievementImageAdjustmentState = {
  saturation: number;
  contrast: number;
  blurEnabled: boolean;
  blurRadius: number;
  blurOpacity: number;
};

export type SteamAchievementShadowState = {
  enabled: boolean;
  blur: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
};

export type SteamAchievementBackgroundAdjustmentState = SteamAchievementImageAdjustmentState & {
  vignette: number;
};

export type SteamAchievementEntryImageStyle = {
  adjustments: SteamAchievementImageAdjustmentState;
  shadow: SteamAchievementShadowState;
};

export type SteamAchievementTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type SteamAchievementEntry = {
  id: string;
  name: string;
  sourceImageRelativePath: string | null;
  crop: SteamAchievementTransform;
  imageStyle: SteamAchievementEntryImageStyle;
  createdAt: number;
  updatedAt: number;
};

export type SteamAchievementArtData = {
  presetId: string;
  borderStyle: SteamAchievementBorderStyle;
  backgroundAdjustments: SteamAchievementBackgroundAdjustmentState;
  backgroundAssetRelativePaths?: string[];
  entries: SteamAchievementEntry[];
};

export type SteamMarketplaceOutputFormat = 'png' | 'jpg';

export type SteamMarketplacePresetKind = 'image' | 'logo';

export type SteamMarketplacePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  format: SteamMarketplaceOutputFormat;
  fileStem: string;
  kind: SteamMarketplacePresetKind;
  backgroundTransparent?: boolean;
  allowLogoOverlay?: boolean;
};

export type SteamMarketplaceCropTransform = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type SteamMarketplaceLogoTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export type SteamMarketplaceGradientOverlayState = {
  enabled: boolean;
  angle: number;
  opacity: number;
  color: string;
  midColor: string;
  endColor: string;
};

export type SteamMarketplaceBlurOverlayState = {
  enabled: boolean;
  blurRadius: number;
  opacity: number;
};

export type SteamMarketplaceImageAdjustmentState = {
  saturation: number;
  contrast: number;
  vignette: number;
};

export type SteamMarketplaceLogoOverlayState = {
  enabled: boolean;
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowOpacity: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

export type SteamMarketplaceOverlayState = {
  gradient: SteamMarketplaceGradientOverlayState;
  blur: SteamMarketplaceBlurOverlayState;
  image: SteamMarketplaceImageAdjustmentState;
  logo: SteamMarketplaceLogoOverlayState;
};

export type SteamMarketplaceOutputState = {
  enabled: boolean;
  crop: SteamMarketplaceCropTransform;
  overlays: SteamMarketplaceOverlayState;
};

export type SteamMarketplaceEntry = {
  id: string;
  name: string;
  presetId: string;
  sourceImageRelativePath: string | null;
  logoImageRelativePath: string | null;
  outputsByPresetId: Record<string, SteamMarketplaceOutputState>;
  createdAt: number;
  updatedAt: number;
};

export type SteamMarketplaceAssetData = {
  entries: SteamMarketplaceEntry[];
  logoAssetRelativePaths?: string[];
};

export type TerminalCommandPreset = {
  id: string;
  name: string;
  command: string;
  executionFolder: string;
  createdAt: number;
  updatedAt: number;
};

export type TerminalPanelLayout = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultExecutionFolder: string | null;
};

export type TerminalCommandCenterData = {
  commands: TerminalCommandPreset[];
  panels: TerminalPanelLayout[];
};

export type TerminalSessionState = 'idle' | 'running' | 'stopped' | 'error';

export type TerminalSessionErrorCode =
  | 'INVALID_EXECUTION_FOLDER'
  | 'SESSION_NOT_FOUND'
  | 'SPAWN_FAILED'
  | 'PROCESS_EXITED'
  | 'UNKNOWN';

export type TerminalSessionStatusPayload = {
  sessionId: string;
  commandId: string | null;
  panelId: string | null;
  state: TerminalSessionState;
  exitCode?: number | null;
  errorCode?: TerminalSessionErrorCode;
  message?: string;
  at: number;
};

export type TerminalOutputPayload = {
  sessionId: string;
  stream: 'stdout' | 'stderr' | 'system';
  chunk: string;
  at: number;
};

export type TerminalCreateSessionRequest = {
  panelId?: string | null;
  commandId?: string | null;
  executionFolder?: string | null;
  cols?: number;
  rows?: number;
};

export type TerminalCreateSessionResult =
  | {
      ok: true;
      sessionId: string;
      state: TerminalSessionState;
      executionFolder: string;
      commandId: string | null;
      panelId: string | null;
    }
  | {
      ok: false;
      errorCode: TerminalSessionErrorCode;
      message: string;
    };

export type TerminalCommandRequest = {
  sessionId: string;
  command: string;
};

export type TerminalWriteRequest = {
  sessionId: string;
  data: string;
};

export type TerminalResizeRequest = {
  sessionId: string;
  cols: number;
  rows: number;
};

export type TerminalStopByCommandRequest = {
  commandId: string;
};

export type TerminalActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: TerminalSessionErrorCode;
      message: string;
    };

export type TerminalStopByCommandResult =
  | {
      ok: true;
      stoppedSessionIds: string[];
    }
  | {
      ok: false;
      errorCode: TerminalSessionErrorCode;
      message: string;
      stoppedSessionIds: string[];
    };

export type NodeWorkspaceData = {
  noteboard?: {
    cards: NoteboardCard[];
    strokes?: NoteboardStroke[];
    view?: {
      zoom: number;
      offsetX: number;
      offsetY: number;
    };
  };
  document?: {
    markdown: string;
  };
  kanban?: {
    columns: KanbanColumn[];
    cards: KanbanCard[];
    nextTaskNumber: number;
    collapsedColumnIds?: string[];
  };
  spreadsheet?: SpreadsheetData;
  steamAchievementArt?: SteamAchievementArtData;
  steamMarketplaceAssets?: SteamMarketplaceAssetData;
  terminalCommandCenter?: TerminalCommandCenterData;
};

export type CardTemplate = {
  id: string;
  name: string;
  markdown: string;
};

export type CustomThemeDefinition = {
  id: string;
  name: string;
  baseTheme: AppTheme;
  tokens: Record<string, string>;
  createdAt: number;
  updatedAt: number;
};

export type SavedImageAsset = {
  absolutePath: string;
  relativePath: string;
  assetUrl: string;
  fileUrl: string;
  deduplicated: boolean;
};

export type ProjectImageAsset = {
  absolutePath: string;
  relativePath: string;
  assetUrl: string;
  fileUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  updatedAt: number;
};

export type ProjectSnapshot = {
  treeState: PersistedTreeState;
  userSettings: UserSettings;
};

export type ProjectStatusPayload = {
  status: 'success' | 'error' | 'info';
  action: 'save' | 'save-as' | 'open' | 'new' | 'update' | 'export';
  message: string;
  updatePhase?: 'available' | 'downloading' | 'verifying' | 'installing';
  progressMode?: 'indeterminate';
  filePath?: string | null;
  at: number;
};

export type SteamAchievementExportRequest = {
  nodeName: string;
  data: SteamAchievementArtData;
};

export type SteamAchievementExportResult = {
  canceled: boolean;
  outputDir: string | null;
  exportedEntryCount: number;
  skippedEntryCount: number;
  writtenFileCount: number;
};

export type SteamMarketplaceExportRequest = {
  nodeName: string;
  data: SteamMarketplaceAssetData;
  entryIds?: string[];
  presetIds?: string[];
};

export type SteamMarketplaceExportResult = {
  canceled: boolean;
  outputDir: string | null;
  exportedEntryCount: number;
  skippedEntryCount: number;
  writtenFileCount: number;
};

export type RecentProjectEntry = {
  filePath: string;
  fileName: string;
  lastOpenedAt: number;
};

export type LaunchState = {
  recentProjects: RecentProjectEntry[];
  lastActiveProjectPath: string | null;
};

export type ProjectDocFileEntry = {
  relativePath: string;
  name: string;
  directory: string;
  sizeBytes: number;
  updatedAt: number;
};

export type DocsReadResult = {
  relativePath: string;
  content: string;
  updatedAt: number;
  hash: string;
};

export type DocsWriteRequest = {
  relativePath: string;
  content: string;
  expectedHash?: string;
};

export type DocsRenameRequest = {
  fromRelativePath: string;
  toRelativePath: string;
};

export type ProjectEditorNodeEntry = {
  id: string;
  name: string;
  editorType: EditorType;
  parentId: string | null;
};

export type CreateProjectNodeRequest = {
  editorType: EditorType;
  name?: string;
  parentId?: string | null;
  initialMarkdown?: string;
};

export type ExternalNodeCreateRequestPayload = {
  requestId: number;
  request: CreateProjectNodeRequest;
};

export type ExternalNodeCreateResponsePayload = {
  requestId: number;
  ok: boolean;
  createdNodeId?: string;
  error?: string;
};

export type ApiCapabilityMethod = {
  name: string;
  description: string;
  params: string[];
  returns: string;
};

export type ApiCapabilityError = {
  code: string;
  message: string;
};

export type ApiCapabilities = {
  name: string;
  apiVersion: string;
  generatedAt: number;
  docs: {
    scope: string;
    extensions: string[];
    methods: ApiCapabilityMethod[];
    errors: ApiCapabilityError[];
  };
  nodes: {
    methods: ApiCapabilityMethod[];
    errors: ApiCapabilityError[];
  };
};
