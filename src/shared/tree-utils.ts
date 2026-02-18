import type { CategoryNode, EditorType } from './types';

export const createId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const createNode = (name: string, editorType: EditorType): CategoryNode => ({
  id: createId('node'),
  name,
  editorType,
  children: [],
});

export const walkNodes = (
  nodes: CategoryNode[],
  cb: (node: CategoryNode, parent: CategoryNode | null) => boolean | void,
  parent: CategoryNode | null = null,
): boolean => {
  for (const node of nodes) {
    const result = cb(node, parent);
    if (result === true) {
      return true;
    }

    if (walkNodes(node.children, cb, node)) {
      return true;
    }
  }

  return false;
};

export const findNodeById = (
  nodes: CategoryNode[],
  id: string | null,
): CategoryNode | undefined => {
  if (!id) {
    return undefined;
  }

  let found: CategoryNode | undefined;
  walkNodes(nodes, (node) => {
    if (node.id === id) {
      found = node;
      return true;
    }
    return false;
  });

  return found;
};

type NodeLocation = {
  container: CategoryNode[];
  index: number;
};

const findNodeLocationById = (
  nodes: CategoryNode[],
  id: string,
): NodeLocation | undefined => {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    return { container: nodes, index };
  }

  for (const node of nodes) {
    const nested = findNodeLocationById(node.children, id);
    if (nested) {
      return nested;
    }
  }

  return undefined;
};

export const moveNodeById = (
  nodes: CategoryNode[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after' | 'inside',
): boolean => {
  if (sourceId === targetId) {
    return false;
  }

  const sourceNode = findNodeById(nodes, sourceId);
  if (!sourceNode) {
    return false;
  }

  const targetInsideSource = walkNodes([sourceNode], (node) => node.id === targetId);
  if (targetInsideSource) {
    return false;
  }

  const sourceLocation = findNodeLocationById(nodes, sourceId);
  if (!sourceLocation) {
    return false;
  }

  const [movedNode] = sourceLocation.container.splice(sourceLocation.index, 1);
  if (!movedNode) {
    return false;
  }

  const targetLocation = findNodeLocationById(nodes, targetId);
  if (!targetLocation) {
    sourceLocation.container.splice(sourceLocation.index, 0, movedNode);
    return false;
  }

  if (position === 'inside') {
    const targetNode = targetLocation.container[targetLocation.index];
    if (!targetNode) {
      sourceLocation.container.splice(sourceLocation.index, 0, movedNode);
      return false;
    }
    targetNode.children.push(movedNode);
    return true;
  }

  const insertIndex = position === 'before' ? targetLocation.index : targetLocation.index + 1;
  targetLocation.container.splice(insertIndex, 0, movedNode);
  return true;
};

export const removeNodeById = (nodes: CategoryNode[], id: string): boolean => {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    nodes.splice(index, 1);
    return true;
  }

  for (const node of nodes) {
    if (removeNodeById(node.children, id)) {
      return true;
    }
  }

  return false;
};

export const countDescendants = (node: CategoryNode): number =>
  node.children.reduce((count, child) => count + 1 + countDescendants(child), 0);

export const findFirstNodeId = (nodes: CategoryNode[]): string | null => {
  if (nodes.length === 0) {
    return null;
  }

  return nodes[0].id;
};
