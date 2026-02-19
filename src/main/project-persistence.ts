import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { PersistedTreeState, UserSettings } from '../shared/types';
import { loadJsonWithBackup, safeWriteFile } from './json-file-store';

type ProjectPersistencePaths = {
  treeStatePath: string;
  userSettingsPath: string;
  imageAssetsDir: string;
};

export const removeFileIfExists = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
};

export const loadTreeState = async (treeStatePath: string): Promise<PersistedTreeState | null> =>
  loadJsonWithBackup<PersistedTreeState>(treeStatePath);

export const saveTreeState = async (
  treeStatePath: string,
  state: PersistedTreeState,
): Promise<void> => {
  await safeWriteFile(treeStatePath, JSON.stringify(state, null, 2));
};

export const loadUserSettings = async (
  userSettingsPath: string,
): Promise<UserSettings | null> => loadJsonWithBackup<UserSettings>(userSettingsPath);

export const saveUserSettings = async (
  userSettingsPath: string,
  settings: UserSettings,
): Promise<void> => {
  await safeWriteFile(userSettingsPath, JSON.stringify(settings, null, 2));
};

export const clearCurrentProjectData = async ({
  treeStatePath,
  userSettingsPath,
  imageAssetsDir,
}: ProjectPersistencePaths): Promise<void> => {
  await removeFileIfExists(treeStatePath);
  await removeFileIfExists(userSettingsPath);

  await mkdir(imageAssetsDir, { recursive: true });
  const entries = await readdir(imageAssetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      await unlink(path.join(imageAssetsDir, entry.name));
    }
  }
};
