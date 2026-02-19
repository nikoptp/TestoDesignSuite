import { access, copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataBackupDir } from './workspace-paths';

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createBackupPath = (filePath: string): string => {
  const parsed = path.parse(filePath);
  return path.join(getDataBackupDir(), `${parsed.base}.${Date.now()}.bak`);
};

const maybeBackupFile = async (filePath: string): Promise<void> => {
  if (!(await fileExists(filePath))) {
    return;
  }
  const backupDir = getDataBackupDir();
  await mkdir(backupDir, { recursive: true });
  const backupPath = createBackupPath(filePath);
  await copyFile(filePath, backupPath);
};

export const safeWriteFile = async (filePath: string, content: string | Uint8Array): Promise<void> => {
  const folderPath = path.dirname(filePath);
  await mkdir(folderPath, { recursive: true });
  await maybeBackupFile(filePath);
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
};

const findNewestBackup = async (filePath: string): Promise<string | null> => {
  const backupDir = getDataBackupDir();
  if (!(await fileExists(backupDir))) {
    return null;
  }
  const base = path.parse(filePath).base;
  const entries = await readdir(backupDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${base}.`) && entry.name.endsWith('.bak'))
    .map((entry) => path.join(backupDir, entry.name));
  if (candidates.length === 0) {
    return null;
  }
  let newest: { filePath: string; mtime: number } | null = null;
  for (const candidate of candidates) {
    const metadata = await stat(candidate);
    if (!newest || metadata.mtimeMs > newest.mtime) {
      newest = {
        filePath: candidate,
        mtime: metadata.mtimeMs,
      };
    }
  }
  return newest?.filePath ?? null;
};

export const loadJsonWithBackup = async <T>(filePath: string): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, 'utf-8');
    return JSON.parse(contents) as T;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }

    const backupPath = await findNewestBackup(filePath);
    if (!backupPath) {
      throw error;
    }

    const backupContents = await readFile(backupPath, 'utf-8');
    return JSON.parse(backupContents) as T;
  }
};
