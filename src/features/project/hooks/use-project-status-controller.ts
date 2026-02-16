import React from 'react';
import type { ProjectStatusUi } from '../../app/app-model';
import { useProjectStatusListener } from './use-project-lifecycle';

type ProjectStatusController = {
  projectStatus: ProjectStatusUi | null;
  showTransientProjectStatus: (status: ProjectStatusUi['status'], message: string) => void;
};

export const useProjectStatusController = (): ProjectStatusController => {
  const [projectStatus, setProjectStatus] = React.useState<ProjectStatusUi | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useProjectStatusListener({
    setProjectStatus,
    timerRef,
  });

  const showTransientProjectStatus = React.useCallback(
    (status: ProjectStatusUi['status'], message: string): void => {
      const at = Date.now();
      setProjectStatus({
        status,
        message,
        at,
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const dismissDelay = status === 'error' ? 9000 : 4500;
      timerRef.current = setTimeout(() => {
        setProjectStatus((current) => {
          if (!current || current.at !== at) {
            return current;
          }
          return null;
        });
      }, dismissDelay);
    },
    [],
  );

  return {
    projectStatus,
    showTransientProjectStatus,
  };
};

