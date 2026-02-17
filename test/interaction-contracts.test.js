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
const rendererDir = path.join(projectRoot, 'src');

const shortcutsSource = fs.readFileSync(shortcutsPath, 'utf8');

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

