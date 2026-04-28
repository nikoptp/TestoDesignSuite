import { createNode, findNodeById, walkNodes } from '../shared/tree-utils';
import type {
  CreateProjectNodeRequest,
  PersistedTreeState,
  ProjectEditorNodeEntry,
  NodeWorkspaceData,
} from '../shared/types';

const createEmptyState = (): PersistedTreeState => ({
  nodes: [],
  selectedNodeId: null,
  nextNodeNumber: 1,
  nodeDataById: {},
  sharedKanbanBacklogCards: [],
  sidebarWidth: 320,
  collapsedNodeIds: [],
});

const normalizeNodeName = (inputName: string | undefined, fallbackNumber: number): string => {
  const trimmed = inputName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Untitled Node ${fallbackNumber}`;
};

export const listEditorNodes = (state: PersistedTreeState): ProjectEditorNodeEntry[] => {
  const output: ProjectEditorNodeEntry[] = [];
  walkNodes(state.nodes, (node, parent) => {
    output.push({
      id: node.id,
      name: node.name,
      editorType: node.editorType,
      parentId: parent?.id ?? null,
    });
    return false;
  });
  return output;
};

export const createEditorNode = (
  inputState: PersistedTreeState | null,
  request: CreateProjectNodeRequest,
): { nextState: PersistedTreeState; createdNode: ProjectEditorNodeEntry } => {
  const state: PersistedTreeState = inputState ?? createEmptyState();
  const name = normalizeNodeName(request.name, state.nextNodeNumber);
  const nextNode = createNode(name, request.editorType);
  const nextNodes = [...state.nodes];

  if (request.parentId) {
    const parent = findNodeById(nextNodes, request.parentId);
    if (!parent) {
      throw new Error('Parent node not found.');
    }
    parent.children.push(nextNode);
  } else {
    nextNodes.push(nextNode);
  }

  const nextNodeDataById: Record<string, NodeWorkspaceData> = {
    ...state.nodeDataById,
    [nextNode.id]: {},
  };
  if (request.editorType === 'story-document') {
    nextNodeDataById[nextNode.id] = {
      ...nextNodeDataById[nextNode.id],
      document: {
        markdown: typeof request.initialMarkdown === 'string' ? request.initialMarkdown : '',
      },
    };
  }

  const nextState: PersistedTreeState = {
    ...state,
    nodes: nextNodes,
    selectedNodeId: nextNode.id,
    nextNodeNumber: state.nextNodeNumber + 1,
    nodeDataById: nextNodeDataById,
    collapsedNodeIds: request.parentId
      ? (state.collapsedNodeIds ?? []).filter((id) => id !== request.parentId)
      : state.collapsedNodeIds ?? [],
  };

  return {
    nextState,
    createdNode: {
      id: nextNode.id,
      name: nextNode.name,
      editorType: nextNode.editorType,
      parentId: request.parentId ?? null,
    },
  };
};
