import { app } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const getInstallConfigPath = (): string => path.join(app.getPath('userData'), 'data', 'install-config.json');
const getDefaultWorkspaceRoot = (): string => path.join(app.getPath('userData'), 'workspace');
const getInstallerFallbackConfigPath = (): string => {
  const localAppData =
    process.env.LOCALAPPDATA ?? path.join(app.getPath('home'), 'AppData', 'Local');
  return path.join(localAppData, app.getName(), 'data', 'install-config.json');
};

let resolvedWorkspaceRoot: string | null = null;

export const getTreeStatePath = (): string =>
  path.join(app.getPath('userData'), 'data', 'tree-state.json');
export const getUserSettingsPath = (): string =>
  path.join(app.getPath('userData'), 'data', 'user-settings.json');
export const getDataBackupDir = (): string => path.join(app.getPath('userData'), 'data', 'backups');
export const getRecentProjectsPath = (): string =>
  path.join(app.getPath('userData'), 'data', 'recent-projects.json');
export const normalizeRelativePath = (value: string): string => value.split(path.sep).join('/');
export const getWindowIconPath = (): string => path.join(app.getAppPath(), 'images', 'icon.png');

export const readInstallerWorkspaceRoot = (): string | null => {
  const candidates = [getInstallConfigPath(), getInstallerFallbackConfigPath()];
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as {
        workspaceRoot?: unknown;
      };
      if (typeof parsed.workspaceRoot === 'string' && parsed.workspaceRoot.trim()) {
        return path.resolve(parsed.workspaceRoot.trim());
      }
    } catch {
      // Ignore malformed installer config and fall back to defaults.
    }
  }

  return null;
};

const isPermissionError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ((error as { code?: string }).code === 'EPERM' || (error as { code?: string }).code === 'EACCES');

const canWriteToWorkspaceRoot = async (candidate: string): Promise<boolean> => {
  try {
    await mkdir(candidate, { recursive: true });
    const probePath = path.join(candidate, '.testo-write-probe');
    await writeFile(probePath, 'ok');
    await unlink(probePath);
    return true;
  } catch (error: unknown) {
    if (isPermissionError(error)) {
      return false;
    }
    return false;
  }
};

export const getProjectWorkspaceRoot = (): string => {
  if (resolvedWorkspaceRoot) {
    return resolvedWorkspaceRoot;
  }

  resolvedWorkspaceRoot = path.resolve(readInstallerWorkspaceRoot() ?? getDefaultWorkspaceRoot());
  return resolvedWorkspaceRoot;
};

export const ensureWritableWorkspaceRoot = async (): Promise<string> => {
  const configured = readInstallerWorkspaceRoot();
  const fallback = getDefaultWorkspaceRoot();
  const candidates = [configured, fallback].filter((value): value is string => Boolean(value));
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    if (await canWriteToWorkspaceRoot(normalized)) {
      resolvedWorkspaceRoot = normalized;
      return normalized;
    }
  }

  await mkdir(fallback, { recursive: true });
  resolvedWorkspaceRoot = path.resolve(fallback);
  return resolvedWorkspaceRoot;
};

export const getProjectImageAssetsDir = (): string =>
  path.join(getProjectWorkspaceRoot(), 'project-assets', 'images');
export const getProjectRootPath = (): string => path.resolve(getProjectWorkspaceRoot());
