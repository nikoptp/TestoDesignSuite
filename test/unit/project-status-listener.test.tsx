import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectStatusPayload } from '../../src/shared/types';
import { useProjectStatusController } from '../../src/features/project/hooks/use-project-status-controller';

describe('useProjectStatusController', () => {
  let projectStatusListener: ((payload: ProjectStatusPayload) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    window.testoApi = {
      ...(window.testoApi ?? {}),
      onProjectStatus: (listener: (payload: ProjectStatusPayload) => void) => {
        projectStatusListener = listener;
        return () => {
          projectStatusListener = null;
        };
      },
    };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    projectStatusListener = null;
  });

  it('keeps in-progress update states persistent', () => {
    const { result } = renderHook(() => useProjectStatusController());

    act(() => {
      projectStatusListener?.({
        status: 'info',
        action: 'update',
        message: 'Installing update and restarting...',
        updatePhase: 'installing',
        progressMode: 'indeterminate',
        at: 1,
      });
    });

    expect(result.current.projectStatus).toMatchObject({
      message: 'Installing update and restarting...',
      action: 'update',
      updatePhase: 'installing',
      progressMode: 'indeterminate',
      persistent: true,
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.projectStatus).not.toBeNull();
  });

  it('auto-dismisses non-persistent statuses after the normal delay', () => {
    const { result } = renderHook(() => useProjectStatusController());

    act(() => {
      projectStatusListener?.({
        status: 'success',
        action: 'save',
        message: 'Saved project.',
        at: 2,
      });
    });

    expect(result.current.projectStatus?.message).toBe('Saved project.');

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(result.current.projectStatus).toBeNull();
  });
});
