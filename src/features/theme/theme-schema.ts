import type { AppTheme, CustomThemeDefinition } from '../../shared/types';

export const GRID_ENABLED_TOKEN = '--grid-enabled' as const;

export const THEME_TOKEN_GROUPS = {
  foundation: [
    '--app-text',
    '--app-bg',
    '--panel-bg-start',
    '--panel-bg-end',
    '--muted-text',
  ],
  chrome: [
    '--sidebar-bg-start',
    '--sidebar-bg-end',
    '--button-bg',
    '--button-bg-hover',
    '--button-text',
    '--dialog-bg',
  ],
  accents: [
    '--link-color',
    '--link-hover',
    '--active-item-border',
    '--active-item-bg',
  ],
  canvas: [
    '--canvas-bg',
    '--grid-major-color',
    '--grid-minor-color',
    GRID_ENABLED_TOKEN,
    '--card-bg-start',
    '--card-bg-end',
    '--card-border',
  ],
} as const;

export const THEME_TOKEN_KEYS = Object.freeze(
  Array.from(new Set(Object.values(THEME_TOKEN_GROUPS).flat())),
);

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokenOverrides = Partial<Record<ThemeTokenKey, string>>;

export const MAX_CUSTOM_THEME_NAME_LENGTH = 64;
export const MAX_CUSTOM_THEME_OVERRIDES = 256;

const isThemeTokenName = (value: string): value is ThemeTokenKey =>
  THEME_TOKEN_KEYS.includes(value as ThemeTokenKey);

const isThemeTokenValue = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) {
    return false;
  }
  if (/[{};]/.test(trimmed)) {
    return false;
  }
  return true;
};

export const sanitizeThemeTokenOverrides = (input: unknown): ThemeTokenOverrides => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  const next: ThemeTokenOverrides = {};
  Object.entries(input as Record<string, unknown>)
    .slice(0, MAX_CUSTOM_THEME_OVERRIDES)
    .forEach(([key, value]) => {
      if (!isThemeTokenName(key) || typeof value !== 'string' || !isThemeTokenValue(value)) {
        return;
      }
      next[key] = value.trim();
    });

  return next;
};

export const createCustomThemeDefinition = (
  name: string,
  baseTheme: AppTheme,
  overrides: ThemeTokenOverrides = {},
): CustomThemeDefinition => {
  const createdAt = Date.now();
  return {
    id: `custom-theme-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, MAX_CUSTOM_THEME_NAME_LENGTH) || 'Custom Theme',
    baseTheme,
    tokens: { ...overrides },
    createdAt,
    updatedAt: createdAt,
  };
};
