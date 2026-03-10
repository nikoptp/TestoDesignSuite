import type { CategoryNode, EditorType, PersistedTreeState } from './types';
import { coercePersistedEditorType } from './editor-types';

export const CURRENT_TREE_STATE_SCHEMA_VERSION = 2;

type PersistedCategoryNodeLike = Omit<CategoryNode, 'editorType' | 'children'> & {
  editorType: string;
  children: PersistedCategoryNodeLike[];
};

type PersistedTreeStateLike = Omit<PersistedTreeState, 'nodes'> & {
  nodes: PersistedCategoryNodeLike[];
};

const migrateNode = (node: PersistedCategoryNodeLike): CategoryNode => {
  const normalizedEditorType: EditorType =
    coercePersistedEditorType(node.editorType) ?? 'story-document';

  return {
    ...node,
    editorType: normalizedEditorType,
    children: node.children.map(migrateNode),
  };
};

export const migratePersistedTreeState = (
  input: PersistedTreeStateLike,
): PersistedTreeState => ({
  ...input,
  nodes: input.nodes.map(migrateNode),
  schemaVersion: CURRENT_TREE_STATE_SCHEMA_VERSION,
});
