import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserSettings } from '../../src/shared/types';
import { useThemeRuntime } from '../../src/features/theme/hooks/use-theme-runtime';

const baseSettings = (): UserSettings => ({
  theme: 'parchment',
  cardTemplates: [],
  customThemes: [],
});

describe('useThemeRuntime', () => {
  it('applies data-theme from settings', () => {
    const settings = baseSettings();
    renderHook(() => useThemeRuntime(settings));
    expect(document.documentElement.getAttribute('data-theme')).toBe('parchment');
  });

  it('applies active custom theme tokens and grid toggle', () => {
    const settings: UserSettings = {
      ...baseSettings(),
      activeCustomThemeId: 'custom-1',
      customThemes: [
        {
          id: 'custom-1',
          name: 'Custom',
          baseTheme: 'parchment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tokens: {
            '--app-text': '#101010',
            '--grid-enabled': 'off',
          },
        },
      ],
    };

    renderHook(() => useThemeRuntime(settings));

    expect(document.documentElement.style.getPropertyValue('--app-text')).toBe('#101010');
    expect(document.documentElement.getAttribute('data-grid-effect')).toBe('off');
  });
});
