export type EditorType =
  | 'noteboard'
  | 'kanban-board'
  | 'story-document'
  | 'story-presentation'
  | 'lore-document'
  | 'map-sketch'
  | 'level-design';

export type CategoryNode = {
  id: string;
  name: string;
  editorType: EditorType;
  children: CategoryNode[];
};

export type PersistedTreeState = {
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
  action: 'save' | 'save-as' | 'open' | 'new' | 'update';
  message: string;
  filePath?: string | null;
  at: number;
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
