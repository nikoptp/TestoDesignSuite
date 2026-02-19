import path from 'node:path';
import type { RecentProjectEntry } from '../shared/types';
import { loadJsonWithBackup, safeWriteFile } from './json-file-store';

export type RecentProjectsFile = {
  recentProjects: RecentProjectEntry[];
  lastActiveProjectPath: string | null;
};

const MAX_RECENT_PROJECTS = 12;

const sanitizeRecentProjects = (value: unknown): RecentProjectEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Map<string, RecentProjectEntry>();
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }

    const candidate = item as {
      filePath?: unknown;
      fileName?: unknown;
      lastOpenedAt?: unknown;
    };
    if (
      typeof candidate.filePath !== 'string' ||
      !candidate.filePath.trim() ||
      typeof candidate.fileName !== 'string' ||
      !candidate.fileName.trim() ||
      typeof candidate.lastOpenedAt !== 'number' ||
      !Number.isFinite(candidate.lastOpenedAt)
    ) {
      return;
    }

    const filePath = candidate.filePath.trim();
    const existing = unique.get(filePath);
    if (!existing || candidate.lastOpenedAt > existing.lastOpenedAt) {
      unique.set(filePath, {
        filePath,
        fileName: candidate.fileName.trim(),
        lastOpenedAt: candidate.lastOpenedAt,
      });
    }
  });

  return [...unique.values()]
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, MAX_RECENT_PROJECTS);
};

export const loadRecentProjectsState = async (
  recentProjectsPath: string,
): Promise<RecentProjectsFile> => {
  const raw = await loadJsonWithBackup<Partial<RecentProjectsFile>>(recentProjectsPath);
  const recentProjects = sanitizeRecentProjects(raw?.recentProjects);
  const lastActiveProjectPath =
    typeof raw?.lastActiveProjectPath === 'string' && raw.lastActiveProjectPath.trim()
      ? raw.lastActiveProjectPath.trim()
      : null;
  return {
    recentProjects,
    lastActiveProjectPath,
  };
};

export const saveRecentProjectsState = async (
  recentProjectsPath: string,
  state: RecentProjectsFile,
): Promise<void> => {
  await safeWriteFile(recentProjectsPath, JSON.stringify(state, null, 2));
};

export const upsertRecentProject = (
  current: RecentProjectsFile,
  filePath: string,
  at: number,
): RecentProjectsFile => {
  const fileName = path.basename(filePath);
  const nextRecentProjects = sanitizeRecentProjects([
    { filePath, fileName, lastOpenedAt: at },
    ...current.recentProjects,
  ]);

  return {
    recentProjects: nextRecentProjects,
    lastActiveProjectPath: filePath,
  };
};

export const removeRecentProjectPath = (
  current: RecentProjectsFile,
  filePath: string,
): RecentProjectsFile => ({
  recentProjects: current.recentProjects.filter((entry) => entry.filePath !== filePath),
  lastActiveProjectPath:
    current.lastActiveProjectPath === filePath ? null : current.lastActiveProjectPath,
});
