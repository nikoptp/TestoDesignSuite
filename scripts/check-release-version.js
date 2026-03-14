const fs = require('node:fs');
const path = require('node:path');

const tagName = process.env.GITHUB_REF_NAME || '';
const packageJsonPath = path.resolve(process.cwd(), 'package.json');

try {
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageVersion = JSON.parse(packageJsonContent).version;

  if (typeof packageVersion !== 'string' || packageVersion.trim().length === 0) {
    throw new Error('package.json is missing a valid version string');
  }

  if (tagName !== `v${packageVersion}`) {
    throw new Error(`Tag/version mismatch: tag=${tagName} package=${packageVersion}`);
  }

  console.log(`Tag/version check passed for ${tagName}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
