import React from 'react';
import type { UserSettings } from '../../../shared/types';

export const useThemeRuntime = (settings: UserSettings): void => {
  const appliedTokenKeysRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.removeAttribute('data-grid-effect');

    // Remove previously applied custom overrides before applying a new theme selection.
    appliedTokenKeysRef.current.forEach((tokenKey) => {
      root.style.removeProperty(tokenKey);
    });
    appliedTokenKeysRef.current = [];

    const activeTheme =
      typeof settings.activeCustomThemeId === 'string'
        ? (settings.customThemes ?? []).find(
            (theme) =>
              theme.id === settings.activeCustomThemeId && theme.baseTheme === settings.theme,
          )
        : undefined;
    if (!activeTheme) {
      return;
    }

    const appliedKeys: string[] = [];
    Object.entries(activeTheme.tokens).forEach(([tokenKey, tokenValue]) => {
      if (!tokenKey.startsWith('--') || typeof tokenValue !== 'string') {
        return;
      }
      root.style.setProperty(tokenKey, tokenValue);
      appliedKeys.push(tokenKey);
    });
    const rawGridToggle = activeTheme.tokens['--grid-enabled']?.trim().toLowerCase();
    if (rawGridToggle === 'off' || rawGridToggle === 'false' || rawGridToggle === '0') {
      root.setAttribute('data-grid-effect', 'off');
    }
    appliedTokenKeysRef.current = appliedKeys;

    return () => {
      appliedKeys.forEach((tokenKey) => {
        root.style.removeProperty(tokenKey);
      });
      root.removeAttribute('data-grid-effect');
    };
  }, [settings.activeCustomThemeId, settings.customThemes, settings.theme]);
};
