import { describe, expect, it } from 'vitest';
import {
  STEAM_ACHIEVEMENT_256_PRESET_ID,
  applySteamAchievementBorderStyle,
  buildSteamAchievementBackgroundGradientOverlayCss,
  buildSteamAchievementBorderCss,
  buildSteamAchievementExportFileNames,
  buildSteamAchievementImageCss,
  clampSteamAchievementTransform,
  composeSteamAchievementFrameBitmap,
  createDefaultSteamAchievementBorderStyle,
  createDefaultSteamAchievementEntryImageStyle,
  createGrayscaleBitmap,
  getSteamImagePreset,
  normalizeSteamAchievementArtData,
  normalizeSteamAchievementBorderStyle,
  renderSteamAchievementBitmap,
} from '../../src/features/steam-achievement/steam-achievement-art';

const getPixel = (bitmap: Uint8Array, width: number, x: number, y: number): [number, number, number, number] => {
  const offset = (y * width + x) * 4;
  return [
    bitmap[offset] ?? 0,
    bitmap[offset + 1] ?? 0,
    bitmap[offset + 2] ?? 0,
    bitmap[offset + 3] ?? 0,
  ];
};

const channelSpread = (pixel: [number, number, number, number]): number =>
  Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2]);

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
      backgroundGradientOverlayEnabled: true,
      backgroundGradientOpacity: 4,
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
    expect(borderStyle.backgroundGradientOverlayEnabled).toBe(true);
    expect(borderStyle.backgroundGradientOpacity).toBe(1);
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

  it('allows moving undersized zoomed-out images within crop bounds', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const transform = clampSteamAchievementTransform(256, 256, preset, {
      zoom: 0.5,
      offsetX: 500,
      offsetY: -500,
    });

    expect(transform.offsetX).toBe(64);
    expect(transform.offsetY).toBe(-64);
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
        backgroundGradientOverlayEnabled: false,
        backgroundGradientOpacity: 0.42,
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
      backgroundGradientOverlayEnabled: false,
      backgroundGradientOpacity: 0.42,
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
      imageStyle: {
        adjustments: {
          saturation: 1,
          contrast: 1,
          blurEnabled: false,
          blurRadius: 0,
          blurOpacity: 0,
        },
        shadow: {
          enabled: false,
          blur: 0,
          opacity: 0,
          offsetX: 0,
          offsetY: 0,
        },
      },
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
        backgroundMode: 'image',
        backgroundOpacity: 0,
        backgroundGradientOverlayEnabled: true,
        backgroundGradientOpacity: 1,
        backgroundAngle: 0,
        backgroundColor: '#0000ff',
        backgroundMidColor: '#0000ff',
        backgroundGradientColor: '#0000ff',
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
    });

    expect(Array.from(bitmap.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(bitmap.slice((1 * 6 + 1) * 4, (1 * 6 + 1) * 4 + 4))).toEqual([0, 255, 0, 255]);
    expect(Array.from(bitmap.slice((3 * 6 + 3) * 4, (3 * 6 + 3) * 4 + 4))).toEqual([0, 0, 255, 255]);
  });

  it('builds deterministic color and grayscale file names', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const fileNames = buildSteamAchievementExportFileNames('Boss Clear!', preset);

    expect(fileNames.color).toBe('boss_clear.jpg');
    expect(fileNames.grayscale).toBe('boss_clear_gray.jpg');
  });

  it('normalizes new achievement image style fields for entries', () => {
    const normalized = normalizeSteamAchievementArtData({
      presetId: STEAM_ACHIEVEMENT_256_PRESET_ID,
      entries: [
        {
          id: 'entry-1',
          name: 'Boss',
          sourceImageRelativePath: 'project-assets/images/boss.png',
          crop: { zoom: 1, offsetX: 0, offsetY: 0 },
          imageStyle: {
            adjustments: { saturation: 5, contrast: 0.1, blurEnabled: 'bad', blurRadius: 100, blurOpacity: 5 },
            shadow: { enabled: true, blur: 200, opacity: 5, offsetX: 12, offsetY: -6 },
          },
        },
      ],
    });

    expect(normalized.backgroundAdjustments).toBeDefined();
    expect(normalized.entries[0]?.imageStyle.adjustments.saturation).toBe(2);
    expect(normalized.entries[0]?.imageStyle.adjustments.contrast).toBe(0.4);
    expect(normalized.entries[0]?.imageStyle.adjustments.blurEnabled).toBe(false);
    expect(normalized.entries[0]?.imageStyle.shadow.blur).toBe(96);
    expect(normalized.entries[0]?.imageStyle.shadow.opacity).toBe(1);
  });

  it('preserves explicitly empty achievement entry names during normalization', () => {
    const normalized = normalizeSteamAchievementArtData({
      presetId: STEAM_ACHIEVEMENT_256_PRESET_ID,
      entries: [
        {
          id: 'entry-empty-name',
          name: '',
          sourceImageRelativePath: null,
          crop: { zoom: 1, offsetX: 0, offsetY: 0 },
        },
      ],
    });

    expect(normalized.entries[0]?.name).toBe('');
  });

  it('builds gradient overlay and image styles for preview use', () => {
    const backgroundCss = buildSteamAchievementBackgroundGradientOverlayCss({
      ...createDefaultSteamAchievementBorderStyle(),
      backgroundMode: 'image',
      backgroundGradientOverlayEnabled: true,
      backgroundGradientOpacity: 0.5,
    });
    const imageCss = buildSteamAchievementImageCss(createDefaultSteamAchievementEntryImageStyle());

    expect(backgroundCss.backgroundImage).toContain('linear-gradient');
    expect(imageCss.filter).toContain('saturate');
  });

  it('uses CSS-style gradient angles in exported background overlays', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 0, 0]),
      preset: { ...preset, width: 5, height: 5 },
      transform: { zoom: 1, offsetX: 0, offsetY: 0 },
      imageStyle: createDefaultSteamAchievementEntryImageStyle(),
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 0,
        radius: 0,
        backgroundMode: 'image',
        backgroundOpacity: 0,
        backgroundGradientOverlayEnabled: true,
        backgroundGradientOpacity: 1,
        backgroundAngle: 90,
        backgroundColor: '#ff0000',
        backgroundMidColor: '#ff0000',
        backgroundGradientColor: '#0000ff',
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
    });

    const leftPixel = Array.from(bitmap.slice(0, 4));
    const rightPixel = Array.from(bitmap.slice((4 * 4), (4 * 4) + 4));

    expect(leftPixel[2]).toBeGreaterThan(leftPixel[0]);
    expect(rightPixel[0]).toBeGreaterThan(rightPixel[2]);
  });

  it('applies background export controls for image opacity, adjustments, blur, vignette, and gradient overlay', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const backgroundBitmap = new Uint8Array([
      0, 0, 255, 255,
      255, 0, 0, 255,
      0, 255, 0, 255,
      255, 255, 255, 255,
    ]);

    const baseline = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 0, 0]),
      preset: { ...preset, width: 8, height: 8 },
      transform: { zoom: 0.1, offsetX: 0, offsetY: 0 },
      imageStyle: createDefaultSteamAchievementEntryImageStyle(),
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 0,
        radius: 0,
        backgroundMode: 'image',
        backgroundOpacity: 1,
        backgroundGradientOverlayEnabled: false,
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
      backgroundImageBgra: backgroundBitmap,
      backgroundImageWidth: 2,
      backgroundImageHeight: 2,
    });

    const adjusted = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 0, 0]),
      preset: { ...preset, width: 8, height: 8 },
      transform: { zoom: 0.1, offsetX: 0, offsetY: 0 },
      imageStyle: createDefaultSteamAchievementEntryImageStyle(),
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 0,
        radius: 0,
        backgroundMode: 'image',
        backgroundOpacity: 0.5,
        backgroundGradientOverlayEnabled: true,
        backgroundGradientOpacity: 0.75,
        backgroundAngle: 90,
        backgroundColor: '#ff0000',
        backgroundMidColor: '#ff0000',
        backgroundGradientColor: '#0000ff',
      },
      backgroundAdjustments: {
        saturation: 0,
        contrast: 0.4,
        blurEnabled: true,
        blurRadius: 8,
        blurOpacity: 1,
        vignette: 1,
      },
      backgroundImageBgra: backgroundBitmap,
      backgroundImageWidth: 2,
      backgroundImageHeight: 2,
    });

    const baselineTopLeft = getPixel(baseline, 8, 0, 0);
    const adjustedTopLeft = getPixel(adjusted, 8, 0, 0);
    const adjustedCenter = getPixel(adjusted, 8, 4, 4);
    const adjustedLeftMid = getPixel(adjusted, 8, 1, 4);
    const adjustedRightMid = getPixel(adjusted, 8, 6, 4);

    expect(adjustedTopLeft[3]).toBeGreaterThan(0);
    expect(adjustedTopLeft[3]).toBeLessThanOrEqual(255);
    expect(channelSpread(adjustedCenter)).toBeLessThan(channelSpread(baselineTopLeft));
    expect(adjustedTopLeft[0] + adjustedTopLeft[1] + adjustedTopLeft[2]).toBeLessThan(
      adjustedCenter[0] + adjustedCenter[1] + adjustedCenter[2],
    );
    expect(adjustedLeftMid[2]).toBeGreaterThan(adjustedRightMid[2]);
    expect(adjustedRightMid[0]).toBeGreaterThan(adjustedLeftMid[0]);
  });

  it('renders vignette overlay in exports even when no background image is assigned', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 0, 0]),
      preset: { ...preset, width: 8, height: 8 },
      transform: { zoom: 0.1, offsetX: 0, offsetY: 0 },
      imageStyle: createDefaultSteamAchievementEntryImageStyle(),
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 0,
        radius: 0,
        backgroundMode: 'image',
        backgroundOpacity: 0,
        backgroundGradientOverlayEnabled: false,
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 1,
      },
      backgroundImageBgra: null,
      backgroundImageWidth: 0,
      backgroundImageHeight: 0,
    });

    const centerPixel = getPixel(bitmap, 8, 4, 4);
    const edgePixel = getPixel(bitmap, 8, 0, 0);
    expect(centerPixel[3]).toBeLessThan(edgePixel[3]);
    expect(edgePixel[3]).toBeGreaterThan(0);
  });

  it('renders gradient overlay in exports when no background image is assigned', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 0, 0]),
      preset: { ...preset, width: 8, height: 8 },
      transform: { zoom: 0.1, offsetX: 0, offsetY: 0 },
      imageStyle: createDefaultSteamAchievementEntryImageStyle(),
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 0,
        radius: 0,
        backgroundMode: 'none',
        backgroundOpacity: 0,
        backgroundGradientOverlayEnabled: true,
        backgroundGradientOpacity: 1,
        backgroundAngle: 90,
        backgroundColor: '#ff0000',
        backgroundMidColor: '#ff0000',
        backgroundGradientColor: '#0000ff',
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
      backgroundImageBgra: null,
      backgroundImageWidth: 0,
      backgroundImageHeight: 0,
    });

    const leftPixel = getPixel(bitmap, 8, 0, 4);
    const rightPixel = getPixel(bitmap, 8, 7, 4);
    expect(leftPixel[3]).toBe(255);
    expect(rightPixel[3]).toBe(255);
    expect(leftPixel[2]).toBeGreaterThan(leftPixel[0]);
    expect(rightPixel[0]).toBeGreaterThan(rightPixel[2]);
  });

  it('applies artwork transform, adjustments, shadow, and border layers during export', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 255, 255]),
      preset: { ...preset, width: 10, height: 10 },
      transform: { zoom: 0.5, offsetX: 2, offsetY: 2 },
      imageStyle: {
        adjustments: {
          saturation: 0,
          contrast: 0.4,
          blurEnabled: true,
          blurRadius: 6,
          blurOpacity: 1,
        },
        shadow: {
          enabled: true,
          blur: 4,
          opacity: 1,
          offsetX: 2,
          offsetY: 2,
        },
      },
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: true,
        margin: 1,
        radius: 0,
        thickness: 1,
        opacity: 1,
        gradientAngle: 90,
        color: '#ff0000',
        midColor: '#ff0000',
        gradientColor: '#0000ff',
        backgroundMode: 'none',
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
    });

    const outsidePixel = getPixel(bitmap, 10, 0, 0);
    const imagePixel = getPixel(bitmap, 10, 6, 6);
    const shadowPixel = getPixel(bitmap, 10, 8, 8);
    const leftBorderPixel = getPixel(bitmap, 10, 1, 5);
    const rightBorderPixel = getPixel(bitmap, 10, 8, 5);

    expect(outsidePixel[3]).toBe(0);
    expect(imagePixel[3]).toBe(255);
    expect(channelSpread(imagePixel)).toBeLessThan(5);
    expect(shadowPixel[3]).toBeGreaterThan(0);
    expect(leftBorderPixel[2]).toBeGreaterThan(leftBorderPixel[0]);
    expect(rightBorderPixel[0]).toBeGreaterThan(rightBorderPixel[2]);
  });

  it('renders shadow in exports when shadow blur is zero', () => {
    const preset = getSteamImagePreset(STEAM_ACHIEVEMENT_256_PRESET_ID);
    const bitmap = composeSteamAchievementFrameBitmap({
      sourceWidth: 1,
      sourceHeight: 1,
      sourceBgra: new Uint8Array([0, 0, 255, 255]),
      preset: { ...preset, width: 10, height: 10 },
      transform: { zoom: 0.5, offsetX: 2, offsetY: 2 },
      imageStyle: {
        adjustments: {
          saturation: 1,
          contrast: 1,
          blurEnabled: false,
          blurRadius: 0,
          blurOpacity: 0,
        },
        shadow: {
          enabled: true,
          blur: 0,
          opacity: 1,
          offsetX: 2,
          offsetY: 2,
        },
      },
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: false,
        margin: 1,
        radius: 0,
        backgroundMode: 'none',
      },
      backgroundAdjustments: {
        saturation: 1,
        contrast: 1,
        blurEnabled: false,
        blurRadius: 0,
        blurOpacity: 0,
        vignette: 0,
      },
    });

    const shadowPixel = getPixel(bitmap, 10, 8, 8);
    expect(shadowPixel[3]).toBeGreaterThan(0);
  });

});
