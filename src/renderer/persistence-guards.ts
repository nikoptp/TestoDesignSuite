import type { CategoryNode, NodeWorkspaceData, PersistedTreeState } from '../shared/types';
import { isValidEditorType } from '../shared/editor-types';

const isNode = (value: unknown): value is CategoryNode => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    id?: unknown;
    name?: unknown;
    editorType?: unknown;
    children?: unknown;
  };

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isValidEditorType(obj.editorType) &&
    Array.isArray(obj.children) &&
    obj.children.every((child) => isNode(child))
  );
};

const isNodeWorkspaceData = (value: unknown): value is NodeWorkspaceData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    noteboard?: unknown;
    document?: unknown;
  };

  if (typeof obj.noteboard !== 'undefined') {
    if (typeof obj.noteboard !== 'object' || obj.noteboard === null) {
      return false;
    }

    const noteboard = obj.noteboard as { cards?: unknown };
    if (!Array.isArray(noteboard.cards)) {
      return false;
    }

    const view = (obj.noteboard as { view?: unknown }).view;
    if (typeof view !== 'undefined') {
      if (typeof view !== 'object' || view === null) {
        return false;
      }

      const viewObj = view as {
        zoom?: unknown;
        offsetX?: unknown;
        offsetY?: unknown;
      };

      if (
        typeof viewObj.zoom !== 'number' ||
        typeof viewObj.offsetX !== 'number' ||
        typeof viewObj.offsetY !== 'number'
      ) {
        return false;
      }
    }

    const cardsValid = noteboard.cards.every((card) => {
      if (typeof card !== 'object' || card === null) {
        return false;
      }

      const item = card as {
        id?: unknown;
        text?: unknown;
        createdAt?: unknown;
        x?: unknown;
        y?: unknown;
      };

      return (
        typeof item.id === 'string' &&
        typeof item.text === 'string' &&
        typeof item.createdAt === 'number' &&
        (typeof item.x === 'undefined' || typeof item.x === 'number') &&
        (typeof item.y === 'undefined' || typeof item.y === 'number')
      );
    });

    if (!cardsValid) {
      return false;
    }
  }

  if (typeof obj.document !== 'undefined') {
    if (typeof obj.document !== 'object' || obj.document === null) {
      return false;
    }
    const doc = obj.document as { markdown?: unknown };
    if (typeof doc.markdown !== 'string') {
      return false;
    }
  }

  return true;
};

export const isPersistedTreeState = (value: unknown): value is PersistedTreeState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    nodes?: unknown;
    selectedNodeId?: unknown;
    nextNodeNumber?: unknown;
    nodeDataById?: unknown;
    sidebarWidth?: unknown;
    collapsedNodeIds?: unknown;
  };

  const nodeDataValid =
    typeof obj.nodeDataById === 'undefined' ||
    (typeof obj.nodeDataById === 'object' &&
      obj.nodeDataById !== null &&
      Object.values(obj.nodeDataById as Record<string, unknown>).every((entry) =>
        isNodeWorkspaceData(entry),
      ));
  const sidebarWidthValid =
    typeof obj.sidebarWidth === 'undefined' ||
    (typeof obj.sidebarWidth === 'number' &&
      Number.isFinite(obj.sidebarWidth) &&
      obj.sidebarWidth >= 120 &&
      obj.sidebarWidth <= 920);
  const collapsedNodeIdsValid =
    typeof obj.collapsedNodeIds === 'undefined' ||
    (Array.isArray(obj.collapsedNodeIds) &&
      obj.collapsedNodeIds.every((id) => typeof id === 'string'));

  return (
    Array.isArray(obj.nodes) &&
    obj.nodes.every((node) => isNode(node)) &&
    (typeof obj.selectedNodeId === 'string' || obj.selectedNodeId === null) &&
    typeof obj.nextNodeNumber === 'number' &&
    Number.isInteger(obj.nextNodeNumber) &&
    obj.nextNodeNumber >= 1 &&
    nodeDataValid &&
    sidebarWidthValid &&
    collapsedNodeIdsValid
  );
};
