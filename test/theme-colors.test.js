const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.resolve(__dirname, '..', 'src', 'index.css');
const css = fs.readFileSync(cssPath, 'utf8');

const colorTokenRegex =
  /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const themeSelectorRegex = /^:root(?:\[data-theme='[^']+'\])?$/;

const stripComments = (input) => input.replace(/\/\*[\s\S]*?\*\//g, '');

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

run('index.css uses raw colors only in theme declaration blocks', () => {
  const lines = stripComments(css).split(/\r?\n/);
  const stack = [];
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const openBraceIndex = line.indexOf('{');
    if (openBraceIndex >= 0) {
      const selector = line.slice(0, openBraceIndex).trim();
      const allowRawColors = themeSelectorRegex.test(selector);
      stack.push(allowRawColors);
    }

    const inThemeDeclaration = stack.length > 0 && stack[stack.length - 1];
    const colorMatches = line.match(colorTokenRegex);
    if (!inThemeDeclaration && colorMatches) {
      violations.push(
        `line ${i + 1}: ${colorMatches.join(', ')} -> ${line.trim()}`,
      );
    }

    const closeBraceCount = (line.match(/}/g) || []).length;
    for (let n = 0; n < closeBraceCount; n += 1) {
      stack.pop();
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found non-themed color literals outside :root blocks:\n${violations.join('\n')}`,
  );
});

run('all theme blocks define the same CSS variables', () => {
  const blockRegex = /:root(?:\[data-theme='([^']+)'\])?\s*\{([\s\S]*?)\}/g;
  const themeVariables = new Map();
  let match;

  while ((match = blockRegex.exec(css)) !== null) {
    const themeName = match[1] ?? 'default';
    const body = match[2];
    const vars = new Set();
    const varRegex = /^\s*(--[a-z0-9-]+)\s*:/gim;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      vars.add(varMatch[1]);
    }
    themeVariables.set(themeName, vars);
  }

  assert.ok(themeVariables.has('default'), 'Missing default :root theme block');
  const baseVars = themeVariables.get('default');

  for (const [themeName, vars] of themeVariables.entries()) {
    const missing = [...baseVars].filter((name) => !vars.has(name));
    const extra = [...vars].filter((name) => !baseVars.has(name));
    assert.equal(
      missing.length + extra.length,
      0,
      `Theme "${themeName}" has variable mismatch. Missing: ${missing.join(', ') || 'none'}; Extra: ${extra.join(', ') || 'none'}`,
    );
  }
});
