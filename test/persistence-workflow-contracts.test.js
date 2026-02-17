const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'src', 'index.ts');
const projectLifecyclePath = path.join(
  projectRoot,
  'src',
  'features',
  'project',
  'hooks',
  'use-project-lifecycle.ts',
);

const mainSource = fs.readFileSync(mainPath, 'utf8');
const projectLifecycleSource = fs.readFileSync(projectLifecyclePath, 'utf8');

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

run('safeWriteFile keeps temp-write + atomic rename pattern', () => {
  assert.match(
    mainSource,
    /const safeWriteFile = async[\s\S]*?await maybeBackupFile\(filePath\);[\s\S]*?const tempPath = `\$\{filePath\}\.tmp`[\s\S]*?await writeFile\(tempPath, content\);[\s\S]*?await rename\(tempPath, filePath\);/m,
    'Expected safeWriteFile to backup, write temp file, then rename atomically',
  );
});

run('project bootstrap always marks app bootstrapped in finally', () => {
  assert.match(
    projectLifecycleSource,
    /finally \{\s*if \(!cancelled\) \{\s*setIsBootstrapped\(true\);\s*\}\s*\}/s,
    'Expected useProjectBootstrap to always set bootstrapped in finally block',
  );
});

run('autosave hooks retain debounce windows for tree and settings', () => {
  assert.match(
    projectLifecycleSource,
    /void window\.testoApi\?\.saveTreeState\(state\);\s*\}, 180\);/s,
    'Expected tree autosave debounce to remain 180ms',
  );
  assert.match(
    projectLifecycleSource,
    /void window\.testoApi\?\.saveUserSettings\(settings\);\s*\}, 220\);/s,
    'Expected settings autosave debounce to remain 220ms',
  );
});

run('file menu keeps expected project lifecycle accelerators', () => {
  const expectedAccelerators = [
    'CmdOrCtrl+N',
    'CmdOrCtrl+O',
    'CmdOrCtrl+S',
    'CmdOrCtrl+Shift+S',
    'CmdOrCtrl+,',
  ];

  expectedAccelerators.forEach((accelerator) => {
    const escaped = accelerator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      mainSource,
      new RegExp(`accelerator:\\s*'${escaped}'`),
      `Expected menu accelerator ${accelerator} to be present`,
    );
  });
});

