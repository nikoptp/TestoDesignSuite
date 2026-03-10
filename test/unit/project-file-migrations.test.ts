import { describe, expect, it } from 'vitest';
import { migratePersistedTreeState, CURRENT_TREE_STATE_SCHEMA_VERSION } from '../../src/shared/project-file-migrations';
import { isPersistedTreeState } from '../../src/renderer/persistence-guards';
import type { PersistedTreeState } from '../../src/shared/types';

describe('project file migrations', () => {
  it('accepts legacy persisted editor types in guard checks', () => {
    const legacyState: unknown = {
      nodes: [
        {
          id: 'node-1',
          name: 'Legacy',
          editorType: 'map-sketch',
          children: [],
        },
      ],
      selectedNodeId: 'node-1',
      nextNodeNumber: 2,
      nodeDataById: {},
    };

    expect(isPersistedTreeState(legacyState)).toBe(true);
  });

  it('migrates legacy editor types to story-document and stamps schema version', () => {
    const legacyState = {
      nodes: [
        {
          id: 'node-1',
          name: 'Legacy 1',
          editorType: 'story-presentation',
          children: [
            {
              id: 'node-2',
              name: 'Legacy 2',
              editorType: 'lore-document',
              children: [],
            },
          ],
        },
      ],
      selectedNodeId: 'node-1',
      nextNodeNumber: 3,
      nodeDataById: {},
    } as unknown as PersistedTreeState;

    const migrated = migratePersistedTreeState(legacyState as PersistedTreeState & {
      nodes: Array<PersistedTreeState['nodes'][number] & { editorType: string }>;
    });

    expect(migrated.schemaVersion).toBe(CURRENT_TREE_STATE_SCHEMA_VERSION);
    expect(migrated.nodes[0]?.editorType).toBe('story-document');
    expect(migrated.nodes[0]?.children[0]?.editorType).toBe('story-document');
  });

  it('keeps current editor types unchanged while stamping schema version', () => {
    const state: PersistedTreeState = {
      nodes: [
        {
          id: 'node-1',
          name: 'Board',
          editorType: 'noteboard',
          children: [],
        },
      ],
      selectedNodeId: 'node-1',
      nextNodeNumber: 2,
      nodeDataById: {},
    };

    const migrated = migratePersistedTreeState(state as PersistedTreeState & {
      nodes: Array<PersistedTreeState['nodes'][number] & { editorType: string }>;
    });

    expect(migrated.nodes[0]?.editorType).toBe('noteboard');
    expect(migrated.schemaVersion).toBe(CURRENT_TREE_STATE_SCHEMA_VERSION);
  });
});
