import type { LaunchState } from '../shared/types';
import type { RecentProjectsFile } from './recent-projects';
import { removeRecentProjectPath, upsertRecentProject } from './recent-projects';

export const getLaunchState = async ({
  loadRecentProjects,
  saveRecentProjects,
  fileExists,
}: {
  loadRecentProjects: () => Promise<RecentProjectsFile>;
  saveRecentProjects: (state: RecentProjectsFile) => Promise<void>;
  fileExists: (filePath: string) => Promise<boolean>;
}): Promise<LaunchState> => {
  const recentState = await loadRecentProjects();
  const existingEntries = [];
  for (const entry of recentState.recentProjects) {
    if (await fileExists(entry.filePath)) {
      existingEntries.push(entry);
    }
  }

  const hasLastActive =
    recentState.lastActiveProjectPath && (await fileExists(recentState.lastActiveProjectPath));
  const nextState: RecentProjectsFile = {
    recentProjects: existingEntries,
    lastActiveProjectPath: hasLastActive ? recentState.lastActiveProjectPath : null,
  };

  const changed =
    nextState.recentProjects.length !== recentState.recentProjects.length ||
    nextState.lastActiveProjectPath !== recentState.lastActiveProjectPath;
  if (changed) {
    await saveRecentProjects(nextState);
  }

  return {
    recentProjects: nextState.recentProjects,
    lastActiveProjectPath: nextState.lastActiveProjectPath,
  };
};

export const markProjectAsRecent = async (
  filePath: string,
  {
    loadRecentProjects,
    saveRecentProjects,
  }: {
    loadRecentProjects: () => Promise<RecentProjectsFile>;
    saveRecentProjects: (state: RecentProjectsFile) => Promise<void>;
  },
): Promise<void> => {
  const current = await loadRecentProjects();
  const next = upsertRecentProject(current, filePath, Date.now());
  await saveRecentProjects(next);
};

export const removeRecentProject = async (
  filePath: string,
  {
    loadRecentProjects,
    saveRecentProjects,
  }: {
    loadRecentProjects: () => Promise<RecentProjectsFile>;
    saveRecentProjects: (state: RecentProjectsFile) => Promise<void>;
  },
): Promise<void> => {
  const current = await loadRecentProjects();
  const next = removeRecentProjectPath(current, filePath);
  await saveRecentProjects(next);
};
