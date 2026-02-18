import React from 'react';
import type { RecentProjectEntry } from '../shared/types';

type StartupSplashProps = {
  recentProjects: RecentProjectEntry[];
  lastActiveProjectPath: string | null;
  isBusy: boolean;
  onContinue: () => void | Promise<void>;
  onOpenProject: () => void | Promise<void>;
  onBrowseProject: () => void | Promise<void>;
  onCreateNewProject: () => void | Promise<void>;
  onOpenRecentProject: (filePath: string) => void | Promise<void>;
};

export const StartupSplash = ({
  recentProjects,
  lastActiveProjectPath,
  isBusy,
  onContinue,
  onOpenProject,
  onBrowseProject,
  onCreateNewProject,
  onOpenRecentProject,
}: StartupSplashProps): React.ReactElement => (
  <div className="startup-splash" role="dialog" aria-modal="true" aria-label="Startup options">
    <div className="startup-splash-panel">
      <h2>Welcome Back</h2>
      <p>Choose how to begin this session.</p>
      <div className="startup-splash-actions">
        <button className="startup-action-card" onClick={onContinue} disabled={isBusy}>
          <i className="fa-solid fa-play"></i>
          <span className="startup-action-card-copy">
            <strong>Continue Last Session</strong>
            <small>Jump straight into your current local workspace.</small>
          </span>
        </button>
        <button className="startup-action-card" onClick={onOpenProject} disabled={isBusy}>
          <i className="fa-regular fa-folder-open"></i>
          <span className="startup-action-card-copy">
            <strong>Open Project File</strong>
            <small>Load a `.prjt` file from your recent flow.</small>
          </span>
        </button>
        <button className="startup-action-card" onClick={onBrowseProject} disabled={isBusy}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <span className="startup-action-card-copy">
            <strong>Browse File Browser</strong>
            <small>Pick any `.prjt` project file from disk.</small>
          </span>
        </button>
        <button className="startup-action-card" onClick={onCreateNewProject} disabled={isBusy}>
          <i className="fa-solid fa-file-circle-plus"></i>
          <span className="startup-action-card-copy">
            <strong>New Project</strong>
            <small>Start clean and create a fresh local workspace.</small>
          </span>
        </button>
      </div>
      {lastActiveProjectPath ? (
        <p className="startup-splash-last-path" title={lastActiveProjectPath}>
          Last active: {lastActiveProjectPath}
        </p>
      ) : null}
      <section className="startup-splash-recent">
        <h3>Recent Projects</h3>
        {recentProjects.length > 0 ? (
          <ul className="startup-splash-recent-list">
            {recentProjects.map((entry) => (
              <li key={entry.filePath}>
                <button
                  className="startup-splash-recent-item"
                  onClick={() => onOpenRecentProject(entry.filePath)}
                  disabled={isBusy}
                  title={entry.filePath}
                >
                  <span className="startup-splash-recent-main">
                    <span className="startup-splash-recent-icon" aria-hidden="true"></span>
                    <span>{entry.fileName}</span>
                  </span>
                  <small>{new Date(entry.lastOpenedAt).toLocaleString()}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="startup-splash-empty">No recent projects yet.</p>
        )}
      </section>
    </div>
  </div>
);
