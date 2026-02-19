const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'src', 'index.ts');
const workspacePathsPath = path.join(projectRoot, 'src', 'main', 'workspace-paths.ts');
const projectBundlePath = path.join(projectRoot, 'src', 'main', 'project-bundle.ts');
const themeControllerPath = path.join(
  projectRoot,
  'src',
  'features',
  'theme',
  'hooks',
  'use-theme-studio-controller.ts',
);
const treeActionsPath = path.join(
  projectRoot,
  'src',
  'features',
  'navigation',
  'hooks',
  'use-tree-actions.ts',
);

const indexSource = fs.readFileSync(indexPath, 'utf8');
const workspacePathsSource = fs.readFileSync(workspacePathsPath, 'utf8');
const projectBundleSource = fs.readFileSync(projectBundlePath, 'utf8');
const themeControllerSource = fs.readFileSync(themeControllerPath, 'utf8');
const treeActionsSource = fs.readFileSync(treeActionsPath, 'utf8');

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

run('main process avoids process.cwd for workspace storage', () => {
  assert.match(
    workspacePathsSource,
    /const getDefaultWorkspaceRoot = \(\): string => path\.join\(app\.getPath\('userData'\), 'workspace'\);/,
    'Expected default workspace root to be derived from Electron userData path',
  );
  assert.match(
    workspacePathsSource,
    /const getProjectWorkspaceRoot = \(\): string => \{/,
    'Expected project workspace root resolver to exist',
  );
  assert.ok(
    !/path\.join\(process\.cwd\(\), 'project-assets', 'images'\)/.test(workspacePathsSource),
    'Did not expect project assets path to use process.cwd()',
  );
  assert.ok(
    !/path\.relative\(process\.cwd\(\), absolutePath\)/.test(workspacePathsSource),
    'Did not expect relative asset paths to be derived from process.cwd()',
  );
});

run('project bundle import clears stale persisted tree/settings when null', () => {
  assert.match(
    projectBundleSource,
    /if \(bundle\.treeState\) \{\s*await saveTreeState\(bundle\.treeState\);\s*\} else \{\s*await removeFileIfExists\(getTreeStatePath\(\)\);\s*\}/s,
    'Expected tree-state file cleanup when imported bundle omits treeState',
  );
  assert.match(
    projectBundleSource,
    /if \(bundle\.userSettings\) \{\s*await saveUserSettings\(bundle\.userSettings\);\s*\} else \{\s*await removeFileIfExists\(getUserSettingsPath\(\)\);\s*\}/s,
    'Expected user-settings file cleanup when imported bundle omits userSettings',
  );
});

run('theme creation at max limit shows status and avoids dangling draft id', () => {
  assert.match(
    themeControllerSource,
    /let createdThemeId: string \| null = null;/,
    'Expected theme creation flow to track whether creation actually succeeded',
  );
  assert.match(
    themeControllerSource,
    /if \(!createdThemeId\) \{\s*showStatus\(\{\s*status: 'error',/s,
    'Expected explicit error status when theme cap is reached',
  );
  assert.match(
    themeControllerSource,
    /settingsDraftCustomThemeId: createdThemeId \?\? ''/,
    'Expected draft custom theme id to be set from succeeded creation only',
  );
});

run('node creation validates parent before recording history', () => {
  assert.match(
    treeActionsSource,
    /if \(parentRef !== 'root' && !findNodeById\(state\.nodes, parentRef\)\) \{\s*setUiState\(\(prev\) => \(\{\s*\.\.\.prev,\s*pendingCreateParentRef: null,\s*\}\)\);\s*return;\s*\}\s*\n\s*\n\s*pushHistory\(\);/s,
    'Expected parent validation before pushHistory in create-node action',
  );
});
