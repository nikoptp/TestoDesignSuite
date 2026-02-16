const fs = require('node:fs');
const path = require('node:path');

const testDir = __dirname;
const files = fs
  .readdirSync(testDir)
  .filter((fileName) => fileName.endsWith('.test.js'))
  .sort();

for (const fileName of files) {
  require(path.join(testDir, fileName));
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
