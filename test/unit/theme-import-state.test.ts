import { describe, expect, it } from 'vitest';
import { createCustomThemeDefinition } from '../../src/features/theme/theme-schema';
import { buildImportedThemeState } from '../../src/features/theme/hooks/use-theme-studio-controller';

describe('buildImportedThemeState', () => {
  it('deduplicates imported theme id', () => {
    const existing = createCustomThemeDefinition('Theme A', 'parchment', {
      '--app-text': '#ffffff',
    });
    const imported = { ...existing };

    const result = buildImportedThemeState([existing], imported);
    expect(result.importedThemeId).toMatch(new RegExp(`^${existing.id}-\\d+$`));
    expect(result.nextThemes).toHaveLength(2);
    expect(result.errorMessage).toBeNull();
  });

  it('rejects import when max custom themes reached', () => {
    const themes = Array.from({ length: 24 }, (_, index) =>
      createCustomThemeDefinition(`Theme ${index}`, 'parchment', {}),
    );
    const imported = createCustomThemeDefinition('Overflow', 'parchment', {});

    const result = buildImportedThemeState(themes, imported);
    expect(result.importedThemeId).toBeNull();
    expect(result.nextThemes).toHaveLength(24);
    expect(result.errorMessage).toContain('maximum of 24 custom themes reached');
  });
});
