export type EditorType =
  | 'noteboard'
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
};

export type UserSettings = {
  sidebarWidth: number;
};

export type NoteboardCard = {
  id: string;
  text: string;
  createdAt: number;
  x: number;
  y: number;
};

export type NodeWorkspaceData = {
  noteboard?: {
    cards: NoteboardCard[];
    view?: {
      zoom: number;
      offsetX: number;
      offsetY: number;
    };
  };
};
