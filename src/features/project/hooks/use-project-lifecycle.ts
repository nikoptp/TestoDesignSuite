import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState, ProjectImageAsset, ProjectSnapshot, UserSettings } from '../../../shared/types';
import { isPersistedTreeState } from '../../../renderer/persistence-guards';
import { type ProjectStatusUi } from '../../app/app-model';

type ProjectBootstrapOptions = {
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setSettings: Dispatch<SetStateAction<UserSettings>>;
  setImageAssets: Dispatch<SetStateAction<ProjectImageAsset[]>>;
  setIsBootstrapped: Dispatch<SetStateAction<boolean>>;
  clampSidebarWidth: (value: number) => number;
  isUserSettings: (value: unknown) => value is UserSettings;
  defaultSettings: UserSettings;
  sanitizeDrawingPresetColors: (input: unknown) => string[];
  sanitizeCardTemplates: (input: unknown) => UserSettings['cardTemplates'];
  sanitizeCustomThemes: (input: unknown) => UserSettings['customThemes'];
};

type TreeAutosaveOptions = {
  isBootstrapped: boolean;
  state: PersistedTreeState;
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

type SettingsAutosaveOptions = {
  isBootstrapped: boolean;
  settings: UserSettings;
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

type ProjectStatusListenerOptions = {
  setProjectStatus: Dispatch<SetStateAction<ProjectStatusUi | null>>;
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
};

export const useProjectSnapshotResponder = (
  stateRef: MutableRefObject<PersistedTreeState>,
  settingsRef: MutableRefObject<UserSettings>,
): void => {
  React.useEffect(() => {
    const unsubscribe = window.testoApi?.onRequestProjectSnapshot((): ProjectSnapshot => {
      return {
        treeState: stateRef.current,
        userSettings: settingsRef.current,
      };
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [settingsRef, stateRef]);
};

export const useProjectBootstrap = ({
  setState,
  setSettings,
  setImageAssets,
  setIsBootstrapped,
  clampSidebarWidth,
  isUserSettings,
  defaultSettings,
  sanitizeDrawingPresetColors,
  sanitizeCardTemplates,
  sanitizeCustomThemes,
}: ProjectBootstrapOptions): void => {
  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      if (!window.testoApi) {
        return;
      }

      try {
        const [loadedState, loadedSettings, loadedImageAssets] = await Promise.all([
          window.testoApi.loadTreeState(),
          window.testoApi.loadUserSettings(),
          window.testoApi.listImageAssets ? window.testoApi.listImageAssets() : Promise.resolve([]),
        ]);

        if (!cancelled && loadedState && isPersistedTreeState(loadedState)) {
          setState({
            nodes: loadedState.nodes,
            selectedNodeId: loadedState.selectedNodeId,
            nextNodeNumber: loadedState.nextNodeNumber,
            nodeDataById: loadedState.nodeDataById ?? {},
          });
        }

        if (!cancelled && loadedSettings && isUserSettings(loadedSettings)) {
          const customThemes = sanitizeCustomThemes(loadedSettings.customThemes);
          const activeCustomThemeId =
            typeof loadedSettings.activeCustomThemeId === 'string' &&
            customThemes.some((theme) => theme.id === loadedSettings.activeCustomThemeId)
              ? loadedSettings.activeCustomThemeId
              : undefined;
          setSettings({
            sidebarWidth: clampSidebarWidth(loadedSettings.sidebarWidth),
            theme: loadedSettings.theme ?? defaultSettings.theme,
            activeCustomThemeId,
            drawingTool: loadedSettings.drawingTool ?? defaultSettings.drawingTool,
            drawingBrush: loadedSettings.drawingBrush ?? defaultSettings.drawingBrush,
            drawingSize: loadedSettings.drawingSize ?? defaultSettings.drawingSize,
            drawingOpacity: loadedSettings.drawingOpacity ?? defaultSettings.drawingOpacity,
            drawingColor: loadedSettings.drawingColor ?? defaultSettings.drawingColor,
            drawingPresetColors: sanitizeDrawingPresetColors(loadedSettings.drawingPresetColors),
            cardTemplates: sanitizeCardTemplates(loadedSettings.cardTemplates),
            customThemes,
          });
        }

        if (!cancelled) {
          setImageAssets(loadedImageAssets);
        }
      } catch {
        // Keep in-memory defaults if persisted state/settings fail to load.
      } finally {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    clampSidebarWidth,
    defaultSettings,
    isUserSettings,
    sanitizeCardTemplates,
    sanitizeCustomThemes,
    sanitizeDrawingPresetColors,
    setImageAssets,
    setIsBootstrapped,
    setSettings,
    setState,
  ]);
};

export const useTreeAutosave = ({ isBootstrapped, state, timerRef }: TreeAutosaveOptions): void => {
  React.useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    if (!window.testoApi) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void window.testoApi?.saveTreeState(state);
    }, 180);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isBootstrapped, state, timerRef]);
};

export const useSettingsAutosave = ({
  isBootstrapped,
  settings,
  timerRef,
}: SettingsAutosaveOptions): void => {
  React.useEffect(() => {
    if (!isBootstrapped) {
      return;
    }

    if (!window.testoApi) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void window.testoApi?.saveUserSettings(settings);
    }, 220);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isBootstrapped, settings, timerRef]);
};

export const useProjectStatusListener = ({
  setProjectStatus,
  timerRef,
}: ProjectStatusListenerOptions): void => {
  React.useEffect(() => {
    const unsubscribe = window.testoApi?.onProjectStatus((payload) => {
      setProjectStatus({
        status: payload.status,
        message: payload.message,
        at: payload.at,
      });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const dismissDelay = payload.status === 'error' ? 9000 : 4500;
      timerRef.current = setTimeout(() => {
        setProjectStatus((current) => {
          if (!current || current.at !== payload.at) {
            return current;
          }
          return null;
        });
      }, dismissDelay);
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setProjectStatus, timerRef]);
};
