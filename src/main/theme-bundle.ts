import type { CustomThemeDefinition } from '../shared/types';

type CustomThemeBundleV1 = {
  version: 1;
  exportedAt: number;
  theme: CustomThemeDefinition;
};

const isThemeTokenName = (value: string): boolean => /^--[a-z0-9-]+$/i.test(value.trim());

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

const isAppTheme = (value: unknown): value is CustomThemeDefinition['baseTheme'] =>
  value === 'parchment' || value === 'midnight' || value === 'evergreen';

export const parseCustomThemeBundle = (raw: string): CustomThemeDefinition | null => {
  const parsed = JSON.parse(raw) as Partial<CustomThemeBundleV1>;
  if (parsed.version !== 1 || typeof parsed.theme !== 'object' || parsed.theme === null) {
    return null;
  }

  const theme = parsed.theme as Partial<CustomThemeDefinition>;
  if (
    typeof theme.id !== 'string' ||
    !theme.id.trim() ||
    typeof theme.name !== 'string' ||
    !theme.name.trim() ||
    !isAppTheme(theme.baseTheme)
  ) {
    return null;
  }

  if (typeof theme.tokens !== 'object' || theme.tokens === null || Array.isArray(theme.tokens)) {
    return null;
  }

  const tokens = Object.fromEntries(
    Object.entries(theme.tokens as Record<string, unknown>).flatMap(
      ([tokenKey, tokenValue]): Array<[string, string]> => {
        if (
          isThemeTokenName(tokenKey) &&
          typeof tokenValue === 'string' &&
          isThemeTokenValue(tokenValue)
        ) {
          return [[tokenKey, tokenValue.trim()]];
        }
        return [];
      },
    ),
  );

  const createdAt =
    typeof theme.createdAt === 'number' && Number.isFinite(theme.createdAt)
      ? theme.createdAt
      : Date.now();
  const updatedAt =
    typeof theme.updatedAt === 'number' && Number.isFinite(theme.updatedAt)
      ? theme.updatedAt
      : createdAt;

  return {
    id: theme.id.trim(),
    name: theme.name.trim().slice(0, 64),
    baseTheme: theme.baseTheme,
    tokens,
    createdAt,
    updatedAt,
  };
};
