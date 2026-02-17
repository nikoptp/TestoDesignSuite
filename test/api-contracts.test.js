const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const preloadPath = path.join(projectRoot, 'src', 'preload.ts');
const globalTypesPath = path.join(projectRoot, 'src', 'global.d.ts');

const preloadSource = fs.readFileSync(preloadPath, 'utf8');
const globalTypesSource = fs.readFileSync(globalTypesPath, 'utf8');

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

const collectApiMethodNames = (source) => {
  const names = new Set();
  for (const match of source.matchAll(/^\s+([a-zA-Z0-9_]+):\s*\(/gm)) {
    names.add(match[1]);
  }
  return names;
};

run('testoApi method names match between preload and global.d.ts', () => {
  const preloadMethods = collectApiMethodNames(preloadSource);
  const declaredMethods = collectApiMethodNames(globalTypesSource);

  const missingFromTypes = [...preloadMethods].filter((name) => !declaredMethods.has(name));
  const missingFromPreload = [...declaredMethods].filter((name) => !preloadMethods.has(name));

  assert.equal(
    missingFromTypes.length,
    0,
    `Methods exposed in preload but missing in global.d.ts: ${missingFromTypes.join(', ')}`,
  );
  assert.equal(
    missingFromPreload.length,
    0,
    `Methods declared in global.d.ts but missing from preload: ${missingFromPreload.join(', ')}`,
  );
});

run('event subscription APIs return unsubscribe callbacks in global.d.ts', () => {
  const expectedSubscriptions = [
    'onRequestProjectSnapshot',
    'onOpenSettings',
    'onProjectStatus',
  ];

  expectedSubscriptions.forEach((name) => {
    const pattern = new RegExp(`${name}:\\s*\\([\\s\\S]*?\\)\\s*=>\\s*\\(\\)\\s*=>\\s*void;`, 'm');
    assert.match(
      globalTypesSource,
      pattern,
      `Expected ${name} to be typed as returning an unsubscribe callback`,
    );
  });
});
