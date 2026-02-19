const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const shortcutsPath = path.join(
  projectRoot,
  'src',
  'features',
  'noteboard',
  'hooks',
  'use-noteboard-global-events.ts',
);
const kanbanBoardPath = path.join(projectRoot, 'src', 'components', 'kanban-board.tsx');
const rendererDir = path.join(projectRoot, 'src');

const shortcutsSource = fs.readFileSync(shortcutsPath, 'utf8');
const kanbanBoardSource = fs.readFileSync(kanbanBoardPath, 'utf8');

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

const collectFiles = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      return;
    }
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  });
  return files;
};

run('noteboard keyboard shortcuts remain wired for undo/redo/delete/copy', () => {
  const expectedPatterns = [
    /key === 'z' \|\| key === 'y'/,
    /event\.key === 'Delete'/,
    /key === 'c' && selectedIds\.length > 0/,
    /event\.key === 'Tab' && !isTextEntryTarget/,
  ];

  expectedPatterns.forEach((pattern) => {
    assert.match(
      shortcutsSource,
      pattern,
      `Expected shortcut pattern missing: ${pattern.toString()}`,
    );
  });
});

run('renderer source does not use window.prompt/window.alert', () => {
  const sourceFiles = collectFiles(rendererDir);
  const violations = [];

  sourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    if (/\bwindow\.prompt\s*\(/.test(content) || /\bwindow\.alert\s*\(/.test(content)) {
      violations.push(path.relative(projectRoot, filePath));
    }
  });

  assert.equal(
    violations.length,
    0,
    `Disallowed renderer dialog APIs found in:\n${violations.join('\n')}`,
  );
});

run('kanban board keeps double-click create on empty column surface', () => {
  assert.match(
    kanbanBoardSource,
    /onDoubleClick=\{\(event\) => \{[\s\S]*?event\.target\.closest\([\s\S]*?'\.kanban-card,[\s\S]*?onCreateCard\(column\.id\);[\s\S]*?\}\}/s,
    'Expected double-click handler to ignore interactive targets and create a card for the column',
  );
});

run('kanban sidebar closes on outside pointer down', () => {
  assert.match(
    kanbanBoardSource,
    /window\.addEventListener\('pointerdown', onGlobalPointerDown, true\)/,
    'Expected global pointerdown listener for sidebar outside-click handling',
  );
  assert.match(
    kanbanBoardSource,
    /if \(sidebarRef\.current\?\.contains\(target\)\) \{\s*return;\s*\}/s,
    'Expected sidebar containment guard before close',
  );
  assert.match(
    kanbanBoardSource,
    /setSelectedCardRef\(null\);/,
    'Expected outside click to collapse card details sidebar',
  );
});

run('kanban board exposes right-click context menu actions', () => {
  assert.match(
    kanbanBoardSource,
    /onContextMenu=\{\(event\) => \{/,
    'Expected kanban card context menu handler',
  );
  assert.match(
    kanbanBoardSource,
    /className="kanban-context-menu"/,
    'Expected kanban context menu container',
  );
  assert.match(
    kanbanBoardSource,
    /Copy[\s\S]*Cut[\s\S]*Paste[\s\S]*Delete/s,
    'Expected core quick actions in kanban context menu',
  );
});

run('kanban keyboard quick actions support delete/copy/cut/paste', () => {
  assert.match(
    kanbanBoardSource,
    /event\.key === 'Delete' \|\| event\.key === 'Backspace'/,
    'Expected delete key handling for selected kanban cards',
  );
  assert.match(
    kanbanBoardSource,
    /if \(key === 'c'\)/,
    'Expected copy shortcut handler',
  );
  assert.match(
    kanbanBoardSource,
    /if \(key === 'x'\)/,
    'Expected cut shortcut handler',
  );
  assert.match(
    kanbanBoardSource,
    /if \(key === 'v' && clipboardDraft\)/,
    'Expected paste shortcut handler',
  );
});
