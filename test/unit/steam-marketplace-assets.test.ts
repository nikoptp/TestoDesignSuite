import { describe, expect, it } from 'vitest';
import {
  STEAM_MARKETPLACE_PRESETS,
  buildSteamMarketplaceExportFileName,
  buildSteamMarketplaceExportTargets,
  clampSteamMarketplaceCropTransform,
  createDefaultSteamMarketplaceOutputState,
  normalizeSteamMarketplaceAssetData,
  renderSteamMarketplaceBitmap,
} from '../../src/features/steam-marketplace/steam-marketplace-assets';

describe('steam-marketplace-assets helpers', () => {
  it('includes the expected Steam marketplace preset catalog', () => {
    expect(STEAM_MARKETPLACE_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        'header-capsule',
        'main-capsule',
        'library-hero',
        'library-logo',
        'app-icon',
        'screenshot-baseline',
      ]),
    );
    expect(STEAM_MARKETPLACE_PRESETS).toHaveLength(15);
  });

  it('normalizes missing data to an empty entry list', () => {
    expect(normalizeSteamMarketplaceAssetData(null)).toEqual({ entries: [], logoAssetRelativePaths: [] });
  });

  it('builds deterministic export names with preset suffixes', () => {
    const preset = STEAM_MARKETPLACE_PRESETS.find((item) => item.id === 'app-icon');
    expect(preset).toBeTruthy();
    if (!preset) {
      throw new Error('app-icon preset missing');
    }
    expect(buildSteamMarketplaceExportFileName('Boss Clear!', preset)).toBe('boss_clear-app-icon.jpg');
  });

  it('clamps marketplace crop transform to cover the preset', () => {
    const transform = clampSteamMarketplaceCropTransform(512, 256, { width: 920, height: 430 }, {
      zoom: 1,
      offsetX: 999,
      offsetY: 999,
    });

    expect(transform.offsetX).toBeLessThan(999);
    expect(transform.offsetY).toBeLessThan(999);
  });

  it('renders a transparent logo output and keeps alpha', () => {
    const preset = STEAM_MARKETPLACE_PRESETS.find((item) => item.id === 'library-logo');
    if (!preset) {
      throw new Error('library-logo preset missing');
    }
    const output = createDefaultSteamMarketplaceOutputState();
    const bitmap = renderSteamMarketplaceBitmap({
      preset,
      output,
      logoSourceWidth: 1,
      logoSourceHeight: 1,
      logoSourceBgra: new Uint8Array([0, 0, 255, 255]),
    });

    expect(bitmap).toHaveLength(preset.width * preset.height * 4);
    expect(Array.from(bitmap.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(bitmap.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });

  it('builds filtered export targets for selected entry and preset', () => {
    const output = createDefaultSteamMarketplaceOutputState();
    const targets = buildSteamMarketplaceExportTargets({
      nodeName: 'Steam Assets',
      entryIds: ['entry-1'],
      presetIds: ['header-capsule'],
      data: {
        entries: [
          {
            id: 'entry-1',
            name: 'capsule-art',
            presetId: 'header-capsule',
            sourceImageRelativePath: 'images/base.png',
            logoImageRelativePath: 'images/logo.png',
            outputsByPresetId: {
              'header-capsule': output,
            },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.preset.id).toBe('header-capsule');
  });

  it('exports only populated entries for their assigned preset', () => {
    const output = createDefaultSteamMarketplaceOutputState();
    const targets = buildSteamMarketplaceExportTargets({
      nodeName: 'Steam Assets',
      data: {
        entries: [
          {
            id: 'entry-1',
            name: 'header art',
            presetId: 'header-capsule',
            sourceImageRelativePath: 'images/base.png',
            logoImageRelativePath: null,
            outputsByPresetId: {
              'header-capsule': output,
            },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'entry-2',
            name: 'small art',
            presetId: 'small-capsule',
            sourceImageRelativePath: 'images/small.png',
            logoImageRelativePath: null,
            outputsByPresetId: {
              'small-capsule': output,
            },
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'entry-3',
            name: 'empty main',
            presetId: 'main-capsule',
            sourceImageRelativePath: null,
            logoImageRelativePath: null,
            outputsByPresetId: {
              'main-capsule': output,
            },
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.preset.id)).toEqual(['header-capsule', 'small-capsule']);
  });

  it('applies gradient and blur overlays in the rendered bitmap', () => {
    const preset = STEAM_MARKETPLACE_PRESETS.find((item) => item.id === 'header-capsule');
    if (!preset) {
      throw new Error('header-capsule preset missing');
    }
    const output = createDefaultSteamMarketplaceOutputState();
    output.overlays.gradient.opacity = 1;
    output.overlays.blur.enabled = true;
    output.overlays.blur.opacity = 1;
    output.overlays.blur.blurRadius = 8;

    const bitmap = renderSteamMarketplaceBitmap({
      preset,
      output,
      baseSourceWidth: 1,
      baseSourceHeight: 1,
      baseSourceBgra: new Uint8Array([0, 0, 255, 255]),
    });

    expect(bitmap[2]).toBeLessThan(255);
    expect(bitmap[3]).toBe(255);
  });
});
