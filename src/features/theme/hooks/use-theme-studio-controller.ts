import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CustomThemeDefinition, UserSettings } from '../../../shared/types';
import type { UiState } from '../../app/app-model';
import {
  MAX_CUSTOM_THEMES,
  sanitizeCustomThemes,
  themeOptions,
} from '../../app/app-model';
import {
  THEME_TOKEN_KEYS,
  createCustomThemeDefinition,
  sanitizeThemeTokenOverrides,
  type ThemeTokenKey,
} from '../theme-schema';

type ThemeStudioStatus = {
  status: 'success' | 'error' | 'info';
  message: string;
};

type UseThemeStudioControllerOptions = {
  settings: UserSettings;
  uiState: UiState;
  setSettings: Dispatch<SetStateAction<UserSettings>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  showStatus: (payload: ThemeStudioStatus) => void;
};

type ThemeStudioController = {
  selectedCustomThemeForDraft: CustomThemeDefinition | null;
  onCreateCustomTheme: () => void;
  onRenameCustomTheme: (name: string) => void;
  onDeleteCustomTheme: () => void;
  onCustomThemeTokenChange: (tokenKey: ThemeTokenKey, tokenValue: string) => void;
  onImportCustomTheme: () => Promise<void>;
  onExportCustomTheme: () => Promise<void>;
};

type ImportCustomThemeResult = {
  nextThemes: CustomThemeDefinition[];
  importedThemeId: string | null;
  errorMessage: string | null;
};

const buildImportedThemeState = (
  currentThemes: CustomThemeDefinition[],
  normalizedTheme: CustomThemeDefinition,
): ImportCustomThemeResult => {
  if (currentThemes.length >= MAX_CUSTOM_THEMES) {
    return {
      nextThemes: currentThemes,
      importedThemeId: null,
      errorMessage: `Theme import failed: maximum of ${MAX_CUSTOM_THEMES} custom themes reached.`,
    };
  }

  const existingIds = new Set(currentThemes.map((theme) => theme.id));
  let nextId = normalizedTheme.id;
  if (existingIds.has(nextId)) {
    let suffix = 2;
    while (existingIds.has(`${normalizedTheme.id}-${suffix}`)) {
      suffix += 1;
    }
    nextId = `${normalizedTheme.id}-${suffix}`;
  }

  const nextTheme =
    nextId === normalizedTheme.id ? normalizedTheme : { ...normalizedTheme, id: nextId };
  return {
    nextThemes: [...currentThemes, nextTheme],
    importedThemeId: nextTheme.id,
    errorMessage: null,
  };
};

export const useThemeStudioController = ({
  settings,
  uiState,
  setSettings,
  setUiState,
  showStatus,
}: UseThemeStudioControllerOptions): ThemeStudioController => {
  const selectedCustomThemeForDraft = React.useMemo(
    () =>
      (settings.customThemes ?? []).find(
        (theme) =>
          theme.id === uiState.settingsDraftCustomThemeId &&
          theme.baseTheme === uiState.settingsDraftTheme,
      ) ?? null,
    [settings.customThemes, uiState.settingsDraftCustomThemeId, uiState.settingsDraftTheme],
  );

  const onCreateCustomTheme = React.useCallback((): void => {
    const baseTheme = uiState.settingsDraftTheme;
    const baseLabel =
      themeOptions.find((themeOption) => themeOption.value === baseTheme)?.label ?? 'Theme';
    const existingCount = (settings.customThemes ?? []).filter(
      (theme) => theme.baseTheme === baseTheme,
    ).length;
    const rootStyles = window.getComputedStyle(document.documentElement);
    const seededOverrides = sanitizeThemeTokenOverrides(
      Object.fromEntries(
        THEME_TOKEN_KEYS.map((tokenKey) => [tokenKey, rootStyles.getPropertyValue(tokenKey).trim()]),
      ),
    );
    const created = createCustomThemeDefinition(
      `Custom ${baseLabel} ${existingCount + 1}`,
      baseTheme,
      seededOverrides,
    );
    setSettings((prev) => {
      const current = prev.customThemes ?? [];
      if (current.length >= MAX_CUSTOM_THEMES) {
        return prev;
      }
      return {
        ...prev,
        customThemes: [...current, created],
      };
    });
    setUiState((prev) => ({
      ...prev,
      settingsDraftCustomThemeId: created.id,
    }));
  }, [setSettings, setUiState, settings.customThemes, uiState.settingsDraftTheme]);

  const onRenameCustomTheme = React.useCallback(
    (name: string): void => {
      const nextName = name.trim();
      if (!nextName || !uiState.settingsDraftCustomThemeId) {
        return;
      }
      setSettings((prev) => {
        const themes = prev.customThemes ?? [];
        let changed = false;
        const nextThemes = themes.map((theme) => {
          if (theme.id !== uiState.settingsDraftCustomThemeId) {
            return theme;
          }
          changed = true;
          return {
            ...theme,
            name: nextName.slice(0, 64),
            updatedAt: Date.now(),
          };
        });
        return changed ? { ...prev, customThemes: nextThemes } : prev;
      });
    },
    [setSettings, uiState.settingsDraftCustomThemeId],
  );

  const onDeleteCustomTheme = React.useCallback((): void => {
    const targetId = uiState.settingsDraftCustomThemeId;
    if (!targetId) {
      return;
    }
    setSettings((prev) => {
      const themes = prev.customThemes ?? [];
      const nextThemes = themes.filter((theme) => theme.id !== targetId);
      if (nextThemes.length === themes.length) {
        return prev;
      }
      return {
        ...prev,
        customThemes: nextThemes,
        activeCustomThemeId: prev.activeCustomThemeId === targetId ? undefined : prev.activeCustomThemeId,
      };
    });
    setUiState((prev) => ({
      ...prev,
      settingsDraftCustomThemeId: '',
    }));
  }, [setSettings, setUiState, uiState.settingsDraftCustomThemeId]);

  const onCustomThemeTokenChange = React.useCallback(
    (tokenKey: ThemeTokenKey, tokenValue: string): void => {
      const themeId = uiState.settingsDraftCustomThemeId;
      if (!themeId) {
        return;
      }

      setSettings((prev) => {
        const themes = prev.customThemes ?? [];
        let changed = false;
        const nextThemes = themes.map((theme) => {
          if (theme.id !== themeId) {
            return theme;
          }

          const currentTokens = { ...theme.tokens };
          const nextRaw = tokenValue.trim();
          if (!nextRaw) {
            if (tokenKey in currentTokens) {
              delete currentTokens[tokenKey];
              changed = true;
            }
          } else {
            const sanitized = sanitizeThemeTokenOverrides({ [tokenKey]: nextRaw });
            const nextSanitizedValue = sanitized[tokenKey];
            if (!nextSanitizedValue) {
              return theme;
            }
            if (currentTokens[tokenKey] !== nextSanitizedValue) {
              currentTokens[tokenKey] = nextSanitizedValue;
              changed = true;
            }
          }

          if (!changed) {
            return theme;
          }
          return {
            ...theme,
            tokens: currentTokens,
            updatedAt: Date.now(),
          };
        });

        return changed ? { ...prev, customThemes: nextThemes } : prev;
      });
    },
    [setSettings, uiState.settingsDraftCustomThemeId],
  );

  const onImportCustomTheme = React.useCallback(async (): Promise<void> => {
    if (!window.testoApi?.importCustomTheme) {
      return;
    }

    try {
      const imported = await window.testoApi.importCustomTheme();
      if (!imported) {
        return;
      }

      const sanitized = sanitizeCustomThemes([imported])[0];
      if (!sanitized) {
        showStatus({
          status: 'error',
          message: 'Theme import failed: invalid theme format.',
        });
        return;
      }

      const draftBaseTheme = uiState.settingsDraftTheme;
      const normalizedTheme: CustomThemeDefinition =
        sanitized.baseTheme === draftBaseTheme
          ? sanitized
          : {
              ...sanitized,
              baseTheme: draftBaseTheme,
              updatedAt: Date.now(),
            };

      let importResult: ImportCustomThemeResult | null = null;

      setSettings((prev) => {
        const currentThemes = prev.customThemes ?? [];
        const result = buildImportedThemeState(currentThemes, normalizedTheme);
        importResult = result;
        if (!result.importedThemeId) {
          return prev;
        }
        return {
          ...prev,
          customThemes: result.nextThemes,
        };
      });

      const result = importResult;
      if (!result) {
        return;
      }

      if (!result.importedThemeId) {
        if (result.errorMessage) {
          showStatus({
            status: 'error',
            message: result.errorMessage,
          });
        }
        return;
      }

      setUiState((prev) => ({
        ...prev,
        settingsDraftTheme: draftBaseTheme,
        settingsDraftCustomThemeId: result.importedThemeId ?? '',
      }));
      showStatus({
        status: 'success',
        message: `Imported custom theme "${normalizedTheme.name}".`,
      });
    } catch (error: unknown) {
      showStatus({
        status: 'error',
        message: `Theme import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [setSettings, setUiState, showStatus, uiState.settingsDraftTheme]);

  const onExportCustomTheme = React.useCallback(async (): Promise<void> => {
    if (!window.testoApi?.exportCustomTheme) {
      return;
    }

    const selectedTheme = (settings.customThemes ?? []).find(
      (theme) =>
        theme.id === uiState.settingsDraftCustomThemeId &&
        theme.baseTheme === uiState.settingsDraftTheme,
    );
    if (!selectedTheme) {
      return;
    }

    try {
      const exported = await window.testoApi.exportCustomTheme(selectedTheme);
      if (exported) {
        showStatus({
          status: 'success',
          message: `Exported custom theme "${selectedTheme.name}".`,
        });
      }
    } catch (error: unknown) {
      showStatus({
        status: 'error',
        message: `Theme export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [
    settings.customThemes,
    showStatus,
    uiState.settingsDraftCustomThemeId,
    uiState.settingsDraftTheme,
  ]);

  return {
    selectedCustomThemeForDraft,
    onCreateCustomTheme,
    onRenameCustomTheme,
    onDeleteCustomTheme,
    onCustomThemeTokenChange,
    onImportCustomTheme,
    onExportCustomTheme,
  };
};
