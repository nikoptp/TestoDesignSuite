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
