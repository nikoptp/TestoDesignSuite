import { describe, expect, it } from 'vitest';
import {
  STEAM_ACHIEVEMENT_256_PRESET_ID,
  applySteamAchievementBorderStyle,
  buildSteamAchievementBorderCss,
  buildSteamAchievementExportFileNames,
  clampSteamAchievementTransform,
  composeSteamAchievementFrameBitmap,
  createDefaultSteamAchievementBorderStyle,
  createGrayscaleBitmap,
  getSteamImagePreset,
  normalizeSteamAchievementArtData,
  normalizeSteamAchievementBorderStyle,
  renderSteamAchievementBitmap,
} from '../../src/features/steam-achievement/steam-achievement-art';

describe('steam-achievement-art helpers', () => {
  it('normalizes missing art payload to default preset and empty entries', () => {
    const normalized = normalizeSteamAchievementArtData(null);

    expect(normalized.presetId).toBe(STEAM_ACHIEVEMENT_256_PRESET_ID);
    expect(normalized.borderStyle).toEqual(createDefaultSteamAchievementBorderStyle());
    expect(normalized.entries).toEqual([]);
  });

  it('migrates legacy border preset ids to editable border styles', () => {
    const normalized = normalizeSteamAchievementArtData({
      presetId: STEAM_ACHIEVEMENT_256_PRESET_ID,
      borderOverlayId: 'gold-trim',
      entries: [],
    });

    expect(normalized.borderStyle.enabled).toBe(true);
    expect(normalized.borderStyle.color).toBe('#e4b850');
    expect(normalized.borderStyle.midColor).toBe('#c68e2f');
    expect(normalized.borderStyle.gradientColor).toBe('#5c380c');
  });

  it('falls back to default editable border style for invalid border values', () => {
    const borderStyle = normalizeSteamAchievementBorderStyle({
      enabled: true,
      thickness: 400,
      opacity: 10,
      margin: 200,
      radius: 300,
      gradientAngle: -30,
      color: 'invalid',
      midColor: '#123',
      gradientColor: '#abc',
      backgroundMode: 'gradient',
      backgroundOpacity: 4,
      backgroundAngle: -90,
      backgroundColor: '#0f0',
      backgroundMidColor: 'bad',
      backgroundGradientColor: '#456',
      backgroundImageRelativePath: 42,
    });

    expect(borderStyle.thickness).toBe(48);
    expect(borderStyle.opacity).toBe(1);
    expect(borderStyle.margin).toBe(72);
    expect(borderStyle.radius).toBe(96);
    expect(borderStyle.gradientAngle).toBe(330);
    expect(borderStyle.color).toBe('#d6e1f1');
    expect(borderStyle.midColor).toBe('#112233');
    expect(borderStyle.gradientColor).toBe('#aabbcc');
    expect(borderStyle.backgroundOpacity).toBe(1);
    expect(borderStyle.backgroundAngle).toBe(270);
    expect(borderStyle.backgroundMidColor).toBe('#22314f');
    expect(borderStyle.backgroundImageRelativePath).toBeNull();
  });

  it('clamps transform offsets to keep preset covered', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const transform = clampSteamAchievementTransform(512, 256, preset, {
      zoom: 1,
      offsetX: 500,
      offsetY: 200,
    });

    expect(transform.offsetX).toBeLessThanOrEqual(128);
    expect(transform.offsetY).toBe(0);
  });

  it('renders a covered bitmap at preset size', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const source = new Uint8Array([
      0, 0, 255, 255,
      0, 255, 0, 255,
      255, 0, 0, 255,
      255, 255, 255, 255,
    ]);

    const rendered = renderSteamAchievementBitmap({
      sourceWidth: 2,
      sourceHeight: 2,
      sourceBgra: source,
      preset: { ...preset, width: 2, height: 2 },
      transform: { zoom: 1, offsetX: 0, offsetY: 0 },
    });

    expect(rendered).toHaveLength(16);
    expect(Array.from(rendered.slice(0, 4))).toEqual([0, 0, 255, 255]);
  });

  it('creates grayscale pixels from BGRA source data', () => {
    const grayscale = createGrayscaleBitmap(new Uint8Array([0, 0, 255, 255]));

    expect(Array.from(grayscale)).toEqual([76, 76, 76, 255]);
  });

  it('applies a visible editable border overlay to the bitmap', () => {
    const bordered = applySteamAchievementBorderStyle(
      new Uint8Array([
        0, 0, 0, 255,
        0, 0, 0, 255,
        0, 0, 0, 255,
        0, 0, 0, 255,
      ]),
      2,
      2,
      {
        enabled: true,
        thickness: 1,
        opacity: 1,
        margin: 0,
        radius: 0,
        gradientAngle: 0,
        color: '#ffffff',
        midColor: '#ffffff',
        gradientColor: '#ffffff',
        backgroundMode: 'none',
        backgroundOpacity: 1,
        backgroundAngle: 0,
        backgroundColor: '#000000',
        backgroundMidColor: '#000000',
        backgroundGradientColor: '#000000',
        backgroundImageRelativePath: null,
      },
    );

    expect(Array.from(bordered.slice(0, 4))).not.toEqual([0, 0, 0, 255]);
  });

  it('builds CSS border instructions for preview use', () => {
    const css = buildSteamAchievementBorderCss({
      enabled: true,
      thickness: 8,
      opacity: 0.75,
      margin: 10,
      radius: 16,
      gradientAngle: 35,
      color: '#e4b850',
      midColor: '#c68e2f',
      gradientColor: '#5c380c',
      backgroundMode: 'none',
      backgroundOpacity: 1,
      backgroundAngle: 0,
      backgroundColor: '#000000',
      backgroundMidColor: '#000000',
      backgroundGradientColor: '#000000',
      backgroundImageRelativePath: null,
    });

    expect(css.backgroundImage).toContain('linear-gradient');
    expect(css.border).toContain('solid transparent');
  });

  it('composes background and border into the exported frame bitmap', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 255, 255]),
      preset: { ...preset, width: 6, height: 6 },
      transform: { zoom: 1, offsetX: 0, offsetY: 0 },
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: true,
        thickness: 1,
        margin: 1,
        radius: 0,
        opacity: 1,
        color: '#00ff00',
        midColor: '#00ff00',
        gradientColor: '#00ff00',
        backgroundMode: 'gradient',
        backgroundOpacity: 1,
        backgroundAngle: 0,
        backgroundColor: '#0000ff',
        backgroundMidColor: '#0000ff',
        backgroundGradientColor: '#0000ff',
      },
    });

    expect(Array.from(bitmap.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(bitmap.slice((1 * 6 + 1) * 4, (1 * 6 + 1) * 4 + 4))).toEqual([0, 255, 0, 255]);
    expect(Array.from(bitmap.slice((3 * 6 + 3) * 4, (3 * 6 + 3) * 4 + 4))).toEqual([0, 0, 255, 255]);
  });

  it('builds deterministic color and grayscale file names', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const fileNames = buildSteamAchievementExportFileNames('Boss Clear!', preset);

    expect(fileNames.color).toBe('boss_clear.png');
    expect(fileNames.grayscale).toBe('boss_clear_gray.png');
  });
});
