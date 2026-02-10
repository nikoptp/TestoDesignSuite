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
  };

  if (typeof obj.noteboard === 'undefined') {
    return true;
  }

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

  return noteboard.cards.every((card) => {
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
  };

  const nodeDataValid =
    typeof obj.nodeDataById === 'undefined' ||
    (typeof obj.nodeDataById === 'object' &&
      obj.nodeDataById !== null &&
      Object.values(obj.nodeDataById as Record<string, unknown>).every((entry) =>
        isNodeWorkspaceData(entry),
      ));

  return (
    Array.isArray(obj.nodes) &&
    obj.nodes.every((node) => isNode(node)) &&
    (typeof obj.selectedNodeId === 'string' || obj.selectedNodeId === null) &&
    typeof obj.nextNodeNumber === 'number' &&
    Number.isInteger(obj.nextNodeNumber) &&
    obj.nextNodeNumber >= 1 &&
    nodeDataValid
  );
};
