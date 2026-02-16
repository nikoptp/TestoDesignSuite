import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { UserSettings } from '../../../shared/types';
import type { UiState } from '../../app/app-model';

type UseSettingsDialogControllerOptions = {
  settings: UserSettings;
  settingsRef: MutableRefObject<UserSettings>;
  setUiState: Dispatch<SetStateAction<UiState>>;
};

type SettingsDialogController = {
  onSidebarWidthDraftChange: (value: string) => void;
  onThemeDraftChange: (value: UserSettings['theme']) => void;
  onCustomThemeDraftChange: (value: string) => void;
  onCancelSettingsDialog: () => void;
};

export const useSettingsDialogController = ({
  settings,
  settingsRef,
  setUiState,
}: UseSettingsDialogControllerOptions): SettingsDialogController => {
  React.useEffect(() => {
    const unsubscribe = window.testoApi?.onOpenSettings(() => {
      setUiState((prev) => ({
        ...prev,
        isSettingsDialogOpen: true,
        settingsDraftSidebarWidth: String(settingsRef.current.sidebarWidth),
        settingsDraftTheme: settingsRef.current.theme,
        settingsDraftCustomThemeId: settingsRef.current.activeCustomThemeId ?? '',
      }));
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setUiState, settingsRef]);

  const onSidebarWidthDraftChange = React.useCallback(
    (value: string): void => {
      setUiState((prev) => ({
        ...prev,
        settingsDraftSidebarWidth: value,
      }));
    },
    [setUiState],
  );

  const onThemeDraftChange = React.useCallback(
    (value: UserSettings['theme']): void => {
      setUiState((prev) => ({
        ...prev,
        settingsDraftTheme: value,
        settingsDraftCustomThemeId:
          (settings.customThemes ?? []).some(
            (theme) => theme.id === prev.settingsDraftCustomThemeId && theme.baseTheme === value,
          )
            ? prev.settingsDraftCustomThemeId
            : '',
      }));
    },
    [setUiState, settings.customThemes],
  );

  const onCustomThemeDraftChange = React.useCallback(
    (value: string): void => {
      setUiState((prev) => ({
        ...prev,
        settingsDraftCustomThemeId: value,
      }));
    },
    [setUiState],
  );

  const onCancelSettingsDialog = React.useCallback((): void => {
    setUiState((prev) => ({
      ...prev,
      isSettingsDialogOpen: false,
      settingsDraftSidebarWidth: String(settings.sidebarWidth),
      settingsDraftTheme: settings.theme,
      settingsDraftCustomThemeId: settings.activeCustomThemeId ?? '',
    }));
  }, [setUiState, settings.activeCustomThemeId, settings.sidebarWidth, settings.theme]);

  return {
    onSidebarWidthDraftChange,
    onThemeDraftChange,
    onCustomThemeDraftChange,
    onCancelSettingsDialog,
  };
};

