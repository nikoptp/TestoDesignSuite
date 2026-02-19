import { BrowserWindow } from 'electron';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  PersistedTreeState,
  ProjectImageAsset,
  ProjectSnapshot,
  UserSettings,
} from '../shared/types';
import type { PendingSnapshotRequest } from './ipc-handlers';
import { safeWriteFile } from './json-file-store';

export type ProjectBundleV1 = {
  version: 1;
  exportedAt: number;
  treeState: PersistedTreeState | null;
  userSettings: UserSettings | null;
  images: Array<{
    relativePath: string;
    mimeType: string;
    dataBase64: string;
  }>;
};

type WriteProjectBundleDeps = {
  loadTreeState: () => Promise<PersistedTreeState | null>;
  loadUserSettings: () => Promise<UserSettings | null>;
  listImageAssets: () => Promise<ProjectImageAsset[]>;
  mimeTypeFromExtension: (extension: string) => string;
  requestRendererProjectSnapshot: (window: BrowserWindow) => Promise<ProjectSnapshot | null>;
};

type ApplyProjectBundleDeps = {
  saveTreeState: (state: PersistedTreeState) => Promise<void>;
  saveUserSettings: (settings: UserSettings) => Promise<void>;
  removeFileIfExists: (filePath: string) => Promise<void>;
  getTreeStatePath: () => string;
  getUserSettingsPath: () => string;
  getProjectImageAssetsDir: () => string;
  normalizeRelativePath: (value: string) => string;
  resolveImageAssetPath: (relativePath: string) => string | null;
};

export const readProjectBundle = async (filePath: string): Promise<ProjectBundleV1> => {
  const content = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(content) as Partial<ProjectBundleV1>;
  if (parsed.version !== 1 || !Array.isArray(parsed.images)) {
    throw new Error('Invalid project file format.');
  }
  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
    treeState: parsed.treeState ?? null,
    userSettings: parsed.userSettings ?? null,
    images: parsed.images
      .filter(
        (item) =>
          item &&
          typeof item.relativePath === 'string' &&
          typeof item.mimeType === 'string' &&
          typeof item.dataBase64 === 'string',
      )
      .map((item) => ({
        relativePath: item.relativePath,
        mimeType: item.mimeType,
        dataBase64: item.dataBase64,
      })),
  };
};

export const writeProjectBundle = async (
  filePath: string,
  {
    loadTreeState,
    loadUserSettings,
    listImageAssets,
    mimeTypeFromExtension,
    requestRendererProjectSnapshot,
  }: WriteProjectBundleDeps,
): Promise<void> => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const snapshot = focusedWindow ? await requestRendererProjectSnapshot(focusedWindow) : null;

  const [treeState, userSettings, assets] = await Promise.all([
    snapshot ? Promise.resolve(snapshot.treeState) : loadTreeState(),
    snapshot ? Promise.resolve(snapshot.userSettings) : loadUserSettings(),
    listImageAssets(),
  ]);

  const images: ProjectBundleV1['images'] = [];
  for (const asset of assets) {
    const bytes = await readFile(asset.absolutePath);
    images.push({
      relativePath: asset.relativePath,
      mimeType: mimeTypeFromExtension(path.extname(asset.absolutePath)),
      dataBase64: bytes.toString('base64'),
    });
  }

  const bundle: ProjectBundleV1 = {
    version: 1,
    exportedAt: Date.now(),
    treeState,
    userSettings,
    images,
  };

  await safeWriteFile(filePath, JSON.stringify(bundle));
};

export const requestRendererProjectSnapshot = async (
  window: BrowserWindow,
  {
    nextRequestId,
    timeoutMs,
    pendingSnapshotRequests,
  }: {
    nextRequestId: () => number;
    timeoutMs: number;
    pendingSnapshotRequests: Map<number, PendingSnapshotRequest>;
  },
): Promise<ProjectSnapshot | null> => {
  const requestId = nextRequestId();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const pending = pendingSnapshotRequests.get(requestId);
      if (!pending) {
        return;
      }
      pendingSnapshotRequests.delete(requestId);
      pending.resolve(null);
    }, timeoutMs);

    pendingSnapshotRequests.set(requestId, {
      senderId: window.webContents.id,
      resolve,
      timeout,
    });

    window.webContents.send('project:request-snapshot', requestId);
  });
};

export const reloadSkippingSplashOnce = async (
  window: BrowserWindow,
  queryParam: string,
): Promise<boolean> => {
  if (window.isDestroyed()) {
    return false;
  }

  try {
    const currentUrl = window.webContents.getURL();
    if (!currentUrl) {
      return false;
    }
    const nextUrl = new URL(currentUrl);
    nextUrl.searchParams.set(queryParam, '1');
    await window.loadURL(nextUrl.toString());
    return true;
  } catch {
    return false;
  }
};

export const applyProjectBundle = async (
  bundle: ProjectBundleV1,
  {
    saveTreeState,
    saveUserSettings,
    removeFileIfExists,
    getTreeStatePath,
    getUserSettingsPath,
    getProjectImageAssetsDir,
    normalizeRelativePath,
    resolveImageAssetPath,
  }: ApplyProjectBundleDeps,
): Promise<void> => {
  if (bundle.treeState) {
    await saveTreeState(bundle.treeState);
  } else {
    await removeFileIfExists(getTreeStatePath());
  }
  if (bundle.userSettings) {
    await saveUserSettings(bundle.userSettings);
  } else {
    await removeFileIfExists(getUserSettingsPath());
  }

  const imageDir = getProjectImageAssetsDir();
  await mkdir(imageDir, { recursive: true });
  const existing = await readdir(imageDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isFile()) {
      await unlink(path.join(imageDir, entry.name));
    }
  }

  for (const image of bundle.images) {
    const normalized = normalizeRelativePath(image.relativePath).replace(/^[/\\]+/, '');
    const resolved = resolveImageAssetPath(normalized);
    if (!resolved) {
      continue;
    }
    const folderPath = path.dirname(resolved);
    await mkdir(folderPath, { recursive: true });
    const bytes = Buffer.from(image.dataBase64, 'base64');
    await writeFile(resolved, bytes);
  }
};
