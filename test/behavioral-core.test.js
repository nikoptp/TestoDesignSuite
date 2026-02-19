const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

const historyStackModule = require(path.join(
  projectRoot,
  '.test-dist',
  'renderer',
  'history-stack.js',
));
const persistenceGuardsModule = require(path.join(
  projectRoot,
  '.test-dist',
  'renderer',
  'persistence-guards.js',
));
const themeSchemaModule = require(path.join(
  projectRoot,
  '.test-dist',
  'features',
  'theme',
  'theme-schema.js',
));
const themeControllerModule = require(path.join(
  projectRoot,
  '.test-dist',
  'features',
  'theme',
  'hooks',
  'use-theme-studio-controller.js',
));
const treeUtilsModule = require(path.join(
  projectRoot,
  '.test-dist',
  'shared',
  'tree-utils.js',
));
const appModelModule = require(path.join(
  projectRoot,
  '.test-dist',
  'features',
  'app',
  'app-model.js',
));

const { createHistoryStack } = historyStackModule;
const { isPersistedTreeState } = persistenceGuardsModule;
const { sanitizeThemeTokenOverrides, createCustomThemeDefinition } = themeSchemaModule;
const { buildImportedThemeState } = themeControllerModule;
const { createNode, removeNodeById, findNodeById } = treeUtilsModule;
const { KANBAN_DEFAULT_COLUMNS, ensureKanbanData } = appModelModule;

const run = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  }
};

run('history stack supports bounded undo/redo flow', () => {
  const history = createHistoryStack(2);
  history.push('A');
  history.push('B');
  history.push('C');

  assert.equal(history.undo('NOW'), 'C');
  assert.equal(history.undo('AFTER-C'), 'B');
  assert.equal(history.undo('AFTER-B'), null);
  assert.equal(history.redo('AFTER-UNDO'), 'AFTER-C');
});

run('persistence guard accepts modern noteboard payload with strokes/view', () => {
  const state = {
    nodes: [
      {
        id: 'node-1',
        name: 'Root',
        editorType: 'noteboard',
        children: [],
      },
    ],
    selectedNodeId: 'node-1',
    nextNodeNumber: 2,
    nodeDataById: {
      'node-1': {
        noteboard: {
          cards: [
            {
              id: 'card-1',
              text: 'hello',
              createdAt: Date.now(),
              x: 1,
              y: 2,
              width: 200,
              height: 100,
              color: '#ffffff',
            },
          ],
          strokes: [],
          view: {
            zoom: 1,
            offsetX: -100,
            offsetY: -100,
          },
        },
      },
    },
  };

  assert.equal(isPersistedTreeState(state), true);
});

run('persistence guard accepts kanban state with shared backlog cards', () => {
  const state = {
    nodes: [
      {
        id: 'node-kanban',
        name: 'Kanban',
        editorType: 'kanban-board',
        children: [],
      },
    ],
    selectedNodeId: 'node-kanban',
    nextNodeNumber: 2,
    nodeDataById: {
      'node-kanban': {
        kanban: {
          columns: KANBAN_DEFAULT_COLUMNS.map((column) => ({ ...column })),
          cards: [
            {
              id: 'board-card-1',
              title: 'Board task',
              markdown: 'Board details',
              taskNumber: 1,
              priority: 'medium',
              columnId: 'todo',
              collaboration: {
                assigneeId: 'user-1',
                createdById: 'user-2',
                watcherIds: ['user-3'],
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          nextTaskNumber: 2,
        },
      },
    },
    sharedKanbanBacklogCards: [
      {
        id: 'shared-1',
        title: 'Shared task',
        markdown: 'Shared details',
        taskNumber: 99,
        priority: 'low',
        columnId: 'backlog',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };

  assert.equal(isPersistedTreeState(state), true);
});

run('persistence guard rejects kanban state with invalid card markdown', () => {
  const invalidState = {
    nodes: [
      {
        id: 'node-kanban',
        name: 'Kanban',
        editorType: 'kanban-board',
        children: [],
      },
    ],
    selectedNodeId: 'node-kanban',
    nextNodeNumber: 2,
    nodeDataById: {
      'node-kanban': {
        kanban: {
          columns: KANBAN_DEFAULT_COLUMNS.map((column) => ({ ...column })),
          cards: [
            {
              id: 'broken-card',
              title: 'Broken task',
              markdown: 123,
              taskNumber: 1,
              priority: 'none',
              columnId: 'todo',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          nextTaskNumber: 2,
        },
      },
    },
  };

  assert.equal(isPersistedTreeState(invalidState), false);
});

run('ensureKanbanData migrates legacy Backlog column ids to canonical backlog', () => {
  const now = Date.now();
  const legacyState = {
    nodes: [
      {
        id: 'node-kanban',
        name: 'Legacy Kanban',
        editorType: 'kanban-board',
        children: [],
      },
    ],
    selectedNodeId: 'node-kanban',
    nextNodeNumber: 2,
    nodeDataById: {
      'node-kanban': {
        kanban: {
          columns: [
            { id: 'legacy-backlog', name: 'Backlog', color: '#5f6f8a' },
            { id: 'todo', name: 'To Do', color: '#4e6d91' },
          ],
          cards: [
            {
              id: 'task-1',
              title: 'Task from legacy backlog',
              markdown: '',
              taskNumber: 1,
              priority: 'none',
              columnId: 'legacy-backlog',
              createdAt: now,
              updatedAt: now,
            },
          ],
          nextTaskNumber: 2,
        },
      },
    },
    sharedKanbanBacklogCards: [],
  };

  const normalized = ensureKanbanData(legacyState, 'node-kanban');
  const columns = normalized.nodeDataById['node-kanban'].kanban.columns;
  const backlogColumns = columns.filter((column) => column.id === 'backlog');

  assert.equal(backlogColumns.length, 1);
  assert.equal(normalized.nodeDataById['node-kanban'].kanban.cards[0].columnId, 'backlog');
});

run('theme token sanitizer drops unknown and unsafe values', () => {
  const tokens = sanitizeThemeTokenOverrides({
    '--app-text': '#ffffff',
    '--unknown-token': '#ff0000',
    '--card-bg-start': 'rgb(1, 2, 3)',
    '--button-bg': 'x; background:red;',
  });

  assert.equal(tokens['--app-text'], '#ffffff');
  assert.equal(tokens['--card-bg-start'], 'rgb(1, 2, 3)');
  assert.equal(tokens['--unknown-token'], undefined);
  assert.equal(tokens['--button-bg'], undefined);
});

run('theme import helper enforces unique IDs and max limit', () => {
  const baseTheme = createCustomThemeDefinition('Theme 1', 'parchment', {
    '--app-text': '#fff',
  });
  const duplicate = { ...baseTheme };
  const resultWithDuplicate = buildImportedThemeState([baseTheme], duplicate);
  assert.match(
    String(resultWithDuplicate.importedThemeId),
    new RegExp(`^${baseTheme.id}-\\d+$`),
  );
  assert.equal(resultWithDuplicate.nextThemes.length, 2);

  const maxThemes = Array.from({ length: 24 }).map((_, index) =>
    createCustomThemeDefinition(`Theme ${index}`, 'parchment', {}),
  );
  const rejected = buildImportedThemeState(maxThemes, duplicate);
  assert.equal(rejected.importedThemeId, null);
  assert.ok(rejected.errorMessage);
});

run('tree utils can create/find/remove nested nodes', () => {
  const root = createNode('Root', 'noteboard');
  const child = createNode('Child', 'story-document');
  root.children.push(child);
  const nodes = [root];

  assert.ok(findNodeById(nodes, child.id));
  assert.equal(removeNodeById(nodes, child.id), true);
  assert.equal(findNodeById(nodes, child.id), undefined);
});
