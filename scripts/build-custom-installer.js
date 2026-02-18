const { existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const packageJson = require(join(root, 'package.json'));
const appVersion = packageJson.version;

const packagedDir = join(root, 'out', 'testo-design-suite-win32-x64');
if (!existsSync(packagedDir)) {
  console.error('Packaged app not found. Run `npm run package` first.');
  process.exit(1);
}
mkdirSync(join(root, 'out', 'custom-installer'), { recursive: true });

const scriptPath = join(root, 'installer', 'windows', 'testo-custom-installer.nsi');
const makensisCandidates = [
  process.env.MAKENSIS_PATH,
  process.env.NSIS_PATH,
  'C:\\Program Files (x86)\\NSIS\\makensis.exe',
  'C:\\Program Files\\NSIS\\makensis.exe',
].filter(Boolean);

const makensisPath = makensisCandidates.find((candidate) => existsSync(candidate));
if (!makensisPath) {
  console.error(
    'NSIS compiler not found. Install NSIS or set MAKENSIS_PATH to makensis.exe.',
  );
  process.exit(1);
}

const result = spawnSync(
  makensisPath,
  [`/DAPP_VERSION=${appVersion}`, scriptPath],
  {
    stdio: 'inherit',
    cwd: root,
  },
);

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}
