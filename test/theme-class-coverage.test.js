const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const cssPath = path.join(projectRoot, 'src', 'index.css');
const dialogsPath = path.join(projectRoot, 'src', 'components', 'dialogs.tsx');

const collectTsxFiles = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
};

const sourceFiles = [
  path.join(projectRoot, 'src', 'app.tsx'),
  ...collectTsxFiles(path.join(projectRoot, 'src', 'components')),
];

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

const css = fs.readFileSync(cssPath, 'utf8');
const cssClassNames = new Set();
for (const match of css.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
  cssClassNames.add(match[1]);
}

const ignoredClassNames = new Set([
  'fa-solid',
  'fa-plus',
  'fa-pen',
  'fa-trash',
  'fa-clone',
  'fa-arrows-up-down-left-right',
  'fa-expand',
  'fa-folder-plus',
  'fa-book',
  'fa-file-lines',
  'fa-chalkboard',
  'fa-map',
  'fa-list',
  'fa-check',
  'fa-paintbrush',
  'fa-eraser',
  'fa-droplet',
  'fa-palette',
  'fa-image',
  'fa-download',
  'fa-upload',
  'fa-link',
  'fa-code',
  'fa-table',
  'fa-heading',
  'fa-bold',
  'fa-italic',
  'fa-quote-right',
  'fa-list-check',
  'fa-highlighter',
]);

run('static className values map to CSS selectors', () => {
  const missing = [];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(/className\s*=\s*["'`]([^"'`]*)["'`]/g)) {
      const classList = match[1]
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);

      for (const className of classList) {
        if (ignoredClassNames.has(className) || className.startsWith('fa-')) {
          continue;
        }
        if (!cssClassNames.has(className)) {
          missing.push(`${path.relative(projectRoot, filePath)} -> "${className}"`);
        }
      }
    }
  }

  assert.equal(
    missing.length,
    0,
    `Found className values without matching CSS selectors:\n${missing.join('\n')}`,
  );
});

run('theme studio classes are present in dialog markup and CSS', () => {
  const dialogs = fs.readFileSync(dialogsPath, 'utf8');
  const requiredClasses = [
    'settings-theme-studio',
    'settings-theme-studio-header',
    'settings-theme-studio-actions',
    'settings-theme-row',
    'settings-theme-token-groups',
    'settings-theme-token-group',
    'settings-theme-token-grid',
    'settings-theme-token-field',
    'settings-theme-studio-empty',
  ];

  const missingInDialogs = requiredClasses.filter(
    (className) => !dialogs.includes(`className="${className}"`),
  );
  const missingInCss = requiredClasses.filter((className) => !cssClassNames.has(className));

  assert.equal(
    missingInDialogs.length,
    0,
    `Missing required Theme Studio className usage in dialogs.tsx: ${missingInDialogs.join(', ')}`,
  );
  assert.equal(
    missingInCss.length,
    0,
    `Missing required Theme Studio CSS selectors in index.css: ${missingInCss.join(', ')}`,
  );
});
