import React from 'react';
import type {
  CategoryNode,
  ProjectImageAsset,
  SteamAchievementArtData,
  SteamAchievementBackgroundAdjustmentState,
  SteamAchievementBorderStyle,
  SteamAchievementEntryImageStyle,
  SteamAchievementTransform,
} from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { getImageAssetDragPayload } from '../shared/drag-payloads';
import { ImageAssetSidebar } from './image-asset-sidebar';
import {
  buildSteamAchievementBackgroundBlurCss,
  buildSteamAchievementBackgroundGradientOverlayCss,
  buildSteamAchievementBackgroundCss,
  buildSteamAchievementBackgroundVignetteCss,
  buildSteamAchievementBorderCss,
  buildSteamAchievementImageBlurCss,
  buildSteamAchievementImageCss,
  MAX_STEAM_ACHIEVEMENT_ZOOM,
  MIN_STEAM_ACHIEVEMENT_ZOOM,
  createDefaultSteamAchievementEntryImageStyle,
  createDefaultSteamAchievementTransform,
  getSteamAchievementAssetByPath,
  getSteamAchievementDrawRect,
  getSteamAchievementFrameRect,
  getSteamImagePreset,
} from '../features/steam-achievement/steam-achievement-art';
import { isTextEntryTargetElement } from '../features/app/app-model';

type SteamAchievementArtEditorProps = {
  node: CategoryNode;
  art: SteamAchievementArtData;
  assets: ProjectImageAsset[];
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onRenameEntry: (entryId: string, name: string) => void;
  onAssignAssetToEntry: (entryId: string, relativePath: string) => void;
  onCreateEntryFromAsset: (relativePath: string) => void;
  onImportFiles: (files: File[], target: 'entry' | 'background', targetEntryId?: string) => Promise<void>;
  onBeginCropInteraction: () => void;
  onCropChange: (entryId: string, transform: SteamAchievementTransform) => void;
  onResetCrop: (entryId: string) => void;
  onBorderStyleChange: (patch: Partial<SteamAchievementBorderStyle>) => void;
  onBackgroundAdjustmentsChange: (patch: Partial<SteamAchievementBackgroundAdjustmentState>) => void;
  onEntryImageStyleChange: (entryId: string, patch: Partial<SteamAchievementEntryImageStyle>) => void;
  onAssignBackgroundAsset: (relativePath: string | null) => void;
  onRemoveBackgroundAsset: (relativePath: string) => void;
  onExport: () => Promise<void>;
  onDeleteImageAsset: (relativePath: string) => void;
};

const isImageFile = (file: File): boolean =>
  file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name);

const scaleRect = (
  rect: { width: number; height: number; left: number; top: number },
  scale: number,
): { width: number; height: number; left: number; top: number } => ({
  width: rect.width * scale,
  height: rect.height * scale,
  left: rect.left * scale,
  top: rect.top * scale,
});

const rectToPercentStyle = (
  rect: { width: number; height: number; left: number; top: number },
  preset: { width: number; height: number },
): React.CSSProperties => ({
  width: `${(rect.width / preset.width) * 100}%`,
  height: `${(rect.height / preset.height) * 100}%`,
  left: `${(rect.left / preset.width) * 100}%`,
  top: `${(rect.top / preset.height) * 100}%`,
});

const SNAP_THRESHOLD = 12;

const snapAxisOffset = (
  offset: number,
  drawSize: number,
  frameSize: number,
): number => {
  const halfDelta = (drawSize - frameSize) * 0.5;
  const candidates = [-halfDelta, 0, halfDelta];
  const snapped = candidates.find((candidate) => Math.abs(offset - candidate) <= SNAP_THRESHOLD);
  return snapped ?? offset;
};

type PreviewFrameProps = {
  asset: ProjectImageAsset | null;
  assetAlt: string;
  drawStyle: React.CSSProperties | null;
  backgroundStyle: React.CSSProperties;
  backgroundGradientStyle: React.CSSProperties;
  backgroundBlurStyle?: React.CSSProperties;
  backgroundVignetteStyle?: React.CSSProperties;
  imageFrameStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
  imageStyle?: React.CSSProperties;
  imageBlurStyle?: React.CSSProperties;
  grayscale?: boolean;
  emptyLabel?: string;
};

const PreviewFrame = ({
  asset,
  assetAlt,
  drawStyle,
  backgroundStyle,
  backgroundGradientStyle,
  backgroundBlurStyle,
  backgroundVignetteStyle,
  imageFrameStyle,
  borderStyle,
  imageStyle,
  imageBlurStyle,
  grayscale = false,
  emptyLabel,
}: PreviewFrameProps): React.ReactElement => (
  <div className={`steam-achievement-preview-shell ${grayscale ? 'is-grayscale' : ''}`}>
    <div className="steam-achievement-preview-background" style={backgroundStyle}></div>
    {backgroundBlurStyle ? (
      <div className="steam-achievement-preview-background" style={backgroundBlurStyle}></div>
    ) : null}
    {backgroundVignetteStyle ? (
      <div className="steam-achievement-preview-background" style={backgroundVignetteStyle}></div>
    ) : null}
    <div className="steam-achievement-preview-background" style={backgroundGradientStyle}></div>
    <div className="steam-achievement-preview-frame" style={imageFrameStyle}>
      {asset && drawStyle ? (
        <>
          <img src={asset.assetUrl} alt={assetAlt} style={{ ...drawStyle, ...imageStyle }} />
          {imageBlurStyle && (imageBlurStyle.opacity as number) > 0 ? (
            <img src={asset.assetUrl} alt="" aria-hidden="true" style={{ ...drawStyle, ...imageBlurStyle }} />
          ) : null}
        </>
      ) : (
        <span>{emptyLabel ?? 'Drop image'}</span>
      )}
    </div>
    <div className="steam-achievement-preview-border" style={borderStyle}></div>
  </div>
);

export const SteamAchievementArtEditor = ({
  node,
  art,
  assets,
  onAddEntry,
  onDeleteEntry,
  onRenameEntry,
  onAssignAssetToEntry,
  onCreateEntryFromAsset,
  onImportFiles,
  onBeginCropInteraction,
  onCropChange,
  onResetCrop,
  onBorderStyleChange,
  onBackgroundAdjustmentsChange,
  onEntryImageStyleChange,
  onAssignBackgroundAsset,
  onRemoveBackgroundAsset,
  onExport,
  onDeleteImageAsset,
}: SteamAchievementArtEditorProps): React.ReactElement => {
  const meta = editorTypeMeta(node.editorType);
  const preset = React.useMemo(() => getSteamImagePreset(art.presetId), [art.presetId]);
  const [activeStyleTab, setActiveStyleTab] = React.useState<'background' | 'image'>('image');
  const [isSnapEnabled, setIsSnapEnabled] = React.useState(false);
  const [isDraggingCropImage, setIsDraggingCropImage] = React.useState(false);
  const [isCenterGridEnabled, setIsCenterGridEnabled] = React.useState(false);
  const frameRect = React.useMemo(
    () => getSteamAchievementFrameRect(preset.width, preset.height, art.borderStyle),
    [art.borderStyle, preset.height, preset.width],
  );
  const framePreset = React.useMemo(
    () => ({
      ...preset,
      width: frameRect.width,
      height: frameRect.height,
    }),
    [frameRect.height, frameRect.width, preset],
  );
  const backgroundAsset = getSteamAchievementAssetByPath(
    assets,
    art.borderStyle.backgroundImageRelativePath,
  );
  const backgroundAssets = React.useMemo(() => {
    const knownBackgroundPaths = new Set(art.backgroundAssetRelativePaths ?? []);
    return assets.filter((asset) => knownBackgroundPaths.has(asset.relativePath));
  }, [art.backgroundAssetRelativePaths, assets]);
  const hasBackgroundAsset = Boolean(backgroundAsset);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(art.entries[0]?.id ?? null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [cropFrameScale, setCropFrameScale] = React.useState(1);
  const [cropFrameOffset, setCropFrameOffset] = React.useState({ left: 0, top: 0 });
  const backgroundFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cropStageRef = React.useRef<HTMLDivElement | null>(null);
  const cropFrameRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    pointerId: number;
    entryId: string;
    startX: number;
    startY: number;
    startTransform: SteamAchievementTransform;
  } | null>(null);

  React.useEffect(() => {
    if (art.entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    if (!selectedEntryId || !art.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(art.entries[0]?.id ?? null);
    }
  }, [art.entries, selectedEntryId]);

  const selectedEntry =
    art.entries.find((entry) => entry.id === selectedEntryId) ?? art.entries[0] ?? null;
  const selectedAsset = getSteamAchievementAssetByPath(
    assets,
    selectedEntry?.sourceImageRelativePath ?? null,
  );

  React.useEffect(() => {
    const stage = cropStageRef.current;
    const frame = cropFrameRef.current;
    if (!frame || !stage) {
      return;
    }

    const updateScales = (): void => {
      const nextScale = Math.max(0.01, frame.clientWidth / preset.width);
      const nextOffset = {
        left: (stage.clientWidth - frame.clientWidth) * 0.5,
        top: (stage.clientHeight - frame.clientHeight) * 0.5,
      };
      setCropFrameScale((current) => (Math.abs(current - nextScale) < 0.0001 ? current : nextScale));
      setCropFrameOffset((current) =>
        Math.abs(current.left - nextOffset.left) < 0.5 && Math.abs(current.top - nextOffset.top) < 0.5
          ? current
          : nextOffset,
      );
    };

    updateScales();
    const observer = new ResizeObserver(() => {
      updateScales();
    });
    observer.observe(frame);
    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, [preset.width, selectedEntry?.id]);

  const importClipboardImages = React.useCallback(
    async (clipboardData: DataTransfer | null): Promise<boolean> => {
      if (!clipboardData) {
        return false;
      }

      const files = Array.from(clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));

      if (files.length === 0) {
        return false;
      }

      await onImportFiles(files, 'entry', selectedEntry?.id);
      return true;
    },
    [onImportFiles, selectedEntry?.id],
  );

  const handleDrop = React.useCallback(
    async (
      event: React.DragEvent<HTMLElement>,
      targetEntryId?: string,
    ): Promise<void> => {
      event.preventDefault();
      const draggedAsset = getImageAssetDragPayload(event.dataTransfer);
      if (draggedAsset) {
        if (targetEntryId) {
          onAssignAssetToEntry(targetEntryId, draggedAsset.relativePath);
        } else {
          onCreateEntryFromAsset(draggedAsset.relativePath);
        }
        return;
      }

      const files = Array.from(event.dataTransfer.files).filter(isImageFile);
      if (files.length > 0) {
        await onImportFiles(files, 'entry', targetEntryId);
      }
    },
    [onAssignAssetToEntry, onCreateEntryFromAsset, onImportFiles],
  );

  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      if (isTextEntryTargetElement(event.target)) {
        return;
      }

      const hasImage = Array.from(event.clipboardData?.items ?? []).some(
        (item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'),
      );
      if (!hasImage) {
        return;
      }

      event.preventDefault();
      void importClipboardImages(event.clipboardData ?? null);
    };

    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  }, [importClipboardImages]);

  const onCropPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!selectedEntry || !selectedAsset) {
        return;
      }

      event.preventDefault();
      onBeginCropInteraction();
      setIsDraggingCropImage(true);
      const nextDrag = {
        pointerId: event.pointerId,
        entryId: selectedEntry.id,
        startX: event.clientX,
        startY: event.clientY,
        startTransform: selectedEntry.crop,
      };
      dragStateRef.current = nextDrag;
      event.currentTarget.setPointerCapture(event.pointerId);
      const onPointerMove = (moveEvent: PointerEvent): void => {
        if (dragStateRef.current?.pointerId !== moveEvent.pointerId) {
          return;
        }

        const frame = cropFrameRef.current;
        if (!frame) {
          return;
        }

        const frameWidth = Math.max(1, frame.clientWidth);
        const frameHeight = Math.max(1, frame.clientHeight);
        const rawTransform = {
          ...nextDrag.startTransform,
          offsetX:
            nextDrag.startTransform.offsetX +
            (moveEvent.clientX - nextDrag.startX) * (framePreset.width / frameWidth),
          offsetY:
            nextDrag.startTransform.offsetY +
            (moveEvent.clientY - nextDrag.startY) * (framePreset.height / frameHeight),
        };
        if (!isSnapEnabled) {
          onCropChange(nextDrag.entryId, rawTransform);
          return;
        }

        const drawRect = getSteamAchievementDrawRect(
          selectedAsset.width,
          selectedAsset.height,
          framePreset,
          rawTransform,
        );
        onCropChange(nextDrag.entryId, {
          ...rawTransform,
          offsetX: snapAxisOffset(rawTransform.offsetX, drawRect.width, framePreset.width),
          offsetY: snapAxisOffset(rawTransform.offsetY, drawRect.height, framePreset.height),
        });
      };
      const onPointerEnd = (endEvent: PointerEvent): void => {
        if (dragStateRef.current?.pointerId !== endEvent.pointerId) {
          return;
        }
        dragStateRef.current = null;
        setIsDraggingCropImage(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerEnd);
        window.removeEventListener('pointercancel', onPointerEnd);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);
    },
    [
      framePreset,
      isSnapEnabled,
      onBeginCropInteraction,
      onCropChange,
      selectedAsset,
      selectedEntry,
    ],
  );

  React.useEffect(() => {
    const frame = cropFrameRef.current;
    if (!frame) {
      return;
    }

    const onWheel = (event: WheelEvent): void => {
      if (!selectedEntry || !selectedAsset) {
        return;
      }

      event.preventDefault();
      onBeginCropInteraction();
      const zoomDelta = event.deltaY < 0 ? 0.14 : -0.14;
      onCropChange(selectedEntry.id, {
        ...selectedEntry.crop,
        zoom: Math.max(
          MIN_STEAM_ACHIEVEMENT_ZOOM,
          Math.min(MAX_STEAM_ACHIEVEMENT_ZOOM, selectedEntry.crop.zoom + zoomDelta),
        ),
      });
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [onBeginCropInteraction, onCropChange, selectedAsset, selectedEntry]);

  const backdropRect =
    selectedAsset && selectedEntry
      ? (() => {
          const rect = scaleRect(
            getSteamAchievementDrawRect(
              selectedAsset.width,
              selectedAsset.height,
              framePreset,
              selectedEntry.crop ?? createDefaultSteamAchievementTransform(),
            ),
            cropFrameScale,
          );
          return {
            ...rect,
            left: rect.left + cropFrameOffset.left + frameRect.left * cropFrameScale,
            top: rect.top + cropFrameOffset.top + frameRect.top * cropFrameScale,
          };
        })()
      : null;
  const previewRect =
    selectedAsset && selectedEntry
      ? (() => {
          const rect = getSteamAchievementDrawRect(
            selectedAsset.width,
            selectedAsset.height,
            framePreset,
            selectedEntry.crop ?? createDefaultSteamAchievementTransform(),
          );
          return scaleRect(rect, cropFrameScale);
        })()
      : null;
  const previewBackgroundStyle = React.useMemo(
    () =>
      buildSteamAchievementBackgroundCss(
        art.borderStyle,
        art.backgroundAdjustments,
        backgroundAsset?.assetUrl ?? null,
      ),
    [art.backgroundAdjustments, art.borderStyle, backgroundAsset?.assetUrl],
  );
  const previewBackgroundGradientStyle = React.useMemo(
    () => buildSteamAchievementBackgroundGradientOverlayCss(art.borderStyle),
    [art.borderStyle],
  );
  const previewBackgroundVignetteStyle = React.useMemo(
    () => buildSteamAchievementBackgroundVignetteCss(art.backgroundAdjustments),
    [art.backgroundAdjustments],
  );
  const previewBackgroundBlurStyle = React.useMemo(
    () =>
      buildSteamAchievementBackgroundBlurCss(
        art.borderStyle,
        art.backgroundAdjustments,
        backgroundAsset?.assetUrl ?? null,
      ),
    [art.backgroundAdjustments, art.borderStyle, backgroundAsset?.assetUrl],
  );
  const previewFrameStyle = React.useMemo(
    () => ({
      left: `${frameRect.left * cropFrameScale}px`,
      top: `${frameRect.top * cropFrameScale}px`,
      width: `${frameRect.width * cropFrameScale}px`,
      height: `${frameRect.height * cropFrameScale}px`,
      borderRadius: `${frameRect.radius * cropFrameScale}px`,
    }),
    [cropFrameScale, frameRect.height, frameRect.left, frameRect.radius, frameRect.top, frameRect.width],
  );
  const previewBorderStyle = React.useMemo(
    () => ({
      ...buildSteamAchievementBorderCss(art.borderStyle, cropFrameScale),
      ...previewFrameStyle,
    }),
    [art.borderStyle, cropFrameScale, previewFrameStyle],
  );
  const thumbFrameStyle = React.useMemo(() => rectToPercentStyle(frameRect, preset), [frameRect, preset]);
  const thumbBackgroundStyle = React.useMemo(
    () =>
      buildSteamAchievementBackgroundCss(
        art.borderStyle,
        art.backgroundAdjustments,
        backgroundAsset?.assetUrl ?? null,
      ),
    [art.backgroundAdjustments, art.borderStyle, backgroundAsset?.assetUrl],
  );
  const thumbBackgroundGradientStyle = React.useMemo(
    () => buildSteamAchievementBackgroundGradientOverlayCss(art.borderStyle),
    [art.borderStyle],
  );
  const thumbBackgroundVignetteStyle = React.useMemo(
    () => buildSteamAchievementBackgroundVignetteCss(art.backgroundAdjustments),
    [art.backgroundAdjustments],
  );
  const thumbBackgroundBlurStyle = React.useMemo(
    () =>
      buildSteamAchievementBackgroundBlurCss(
        art.borderStyle,
        art.backgroundAdjustments,
        backgroundAsset?.assetUrl ?? null,
      ),
    [art.backgroundAdjustments, art.borderStyle, backgroundAsset?.assetUrl],
  );
  const thumbImageFrameStyle = React.useMemo(
    () => ({
      ...thumbFrameStyle,
      borderRadius: `${(frameRect.radius / Math.max(1, frameRect.width)) * 100}%`,
    }),
    [frameRect.radius, frameRect.width, thumbFrameStyle],
  );
  const thumbBorderStyle = React.useMemo(
    () => ({
      ...buildSteamAchievementBorderCss(art.borderStyle, 0.35),
      ...thumbImageFrameStyle,
    }),
    [art.borderStyle, thumbImageFrameStyle],
  );
  const selectedImageStyle = selectedEntry?.imageStyle ?? createDefaultSteamAchievementEntryImageStyle();
  const previewImageStyle = React.useMemo(
    () => buildSteamAchievementImageCss(selectedImageStyle),
    [selectedImageStyle],
  );
  const previewImageBlurStyle = React.useMemo(
    () => buildSteamAchievementImageBlurCss(selectedImageStyle, 0.12),
    [selectedImageStyle],
  );
  const stylePanel = (
    <div className="steam-achievement-style-sidebar">
      <div className="draw-sidebar-header">
        <h3>Frame Style</h3>
      </div>
      <div className="tool-style-grid steam-achievement-tab-grid">
        {([
          { key: 'background', label: 'Background', icon: 'fa-layer-group' },
          { key: 'image', label: 'Artwork', icon: 'fa-sliders' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tool-style-option ${activeStyleTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveStyleTab(tab.key)}
          >
            <span className="tool-style-icon"><i className={`fa-solid ${tab.icon}`}></i></span>
            <span className="tool-style-name">{tab.label}</span>
          </button>
        ))}
      </div>
      {activeStyleTab === 'background' ? (
        <>
      <label className="settings-field">
        <span className="settings-field-label">Background Image Opacity ({Math.round(art.borderStyle.backgroundOpacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          disabled={!hasBackgroundAsset}
          value={art.borderStyle.backgroundOpacity}
          onChange={(event) => onBorderStyleChange({ backgroundOpacity: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Gradient Overlay</span>
        <div className="tool-style-grid steam-achievement-toggle-grid">
          <button
            type="button"
            className={`tool-style-option ${art.borderStyle.backgroundGradientOverlayEnabled ? 'active' : ''}`}
            onClick={() =>
              onBorderStyleChange({
                backgroundGradientOverlayEnabled: true,
              })
            }
          >
            <span className="tool-style-icon"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
            <span className="tool-style-name">On</span>
          </button>
          <button
            type="button"
            className={`tool-style-option ${!art.borderStyle.backgroundGradientOverlayEnabled ? 'active' : ''}`}
            onClick={() =>
              onBorderStyleChange({
                backgroundGradientOverlayEnabled: false,
              })
            }
          >
            <span className="tool-style-icon"><i className="fa-regular fa-square-minus"></i></span>
            <span className="tool-style-name">Off</span>
          </button>
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Angle ({Math.round(art.borderStyle.backgroundAngle)}deg)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="359"
          step="1"
          disabled={!art.borderStyle.backgroundGradientOverlayEnabled}
          value={art.borderStyle.backgroundAngle}
          onChange={(event) => onBorderStyleChange({ backgroundAngle: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Gradient Opacity ({Math.round(art.borderStyle.backgroundGradientOpacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          disabled={!art.borderStyle.backgroundGradientOverlayEnabled}
          value={art.borderStyle.backgroundGradientOpacity}
          onChange={(event) => onBorderStyleChange({ backgroundGradientOpacity: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Colors</span>
        <div className="preset-color-grid steam-achievement-color-grid">
          {[
            { value: art.borderStyle.backgroundColor, key: 'backgroundColor' as const },
            { value: art.borderStyle.backgroundMidColor, key: 'backgroundMidColor' as const },
            { value: art.borderStyle.backgroundGradientColor, key: 'backgroundGradientColor' as const },
          ].map((colorStop) => (
            <input
              key={colorStop.key}
              className="settings-input color-input"
              type="color"
              disabled={!art.borderStyle.backgroundGradientOverlayEnabled}
              value={colorStop.value}
              onChange={(event) => onBorderStyleChange({ [colorStop.key]: event.target.value })}
            />
          ))}
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Saturation ({Math.round(art.backgroundAdjustments.saturation * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="2"
          step="0.01"
          disabled={!hasBackgroundAsset}
          value={art.backgroundAdjustments.saturation}
          onChange={(event) => onBackgroundAdjustmentsChange({ saturation: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Contrast ({Math.round(art.backgroundAdjustments.contrast * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0.4"
          max="2"
          step="0.01"
          disabled={!hasBackgroundAsset}
          value={art.backgroundAdjustments.contrast}
          onChange={(event) => onBackgroundAdjustmentsChange({ contrast: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Vignette ({Math.round(art.backgroundAdjustments.vignette * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          disabled={!hasBackgroundAsset}
          value={art.backgroundAdjustments.vignette}
          onChange={(event) => onBackgroundAdjustmentsChange({ vignette: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Blur Opacity ({Math.round(art.backgroundAdjustments.blurOpacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          disabled={!hasBackgroundAsset}
          value={art.backgroundAdjustments.blurOpacity}
          onChange={(event) =>
            onBackgroundAdjustmentsChange({
              blurOpacity: Number(event.target.value),
              blurEnabled:
                Number(event.target.value) > 0 || art.backgroundAdjustments.blurRadius > 0,
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Blur Radius ({Math.round(art.backgroundAdjustments.blurRadius)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="64"
          step="1"
          disabled={!hasBackgroundAsset}
          value={art.backgroundAdjustments.blurRadius}
          onChange={(event) =>
            onBackgroundAdjustmentsChange({
              blurRadius: Number(event.target.value),
              blurEnabled:
                Number(event.target.value) > 0 || art.backgroundAdjustments.blurOpacity > 0,
            })
          }
        />
      </label>
      <div
        className="steam-marketplace-logo-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const draggedAsset = getImageAssetDragPayload(event.dataTransfer);
          if (draggedAsset) {
            onAssignBackgroundAsset(draggedAsset.relativePath);
            return;
          }
          const files = Array.from(event.dataTransfer.files).filter(isImageFile);
          if (files.length > 0) {
            void onImportFiles(files, 'background');
          }
        }}
      >
        <strong>Drop background here</strong>
        <span>Assign a dragged asset or upload a new image for the frame background.</span>
      </div>
      <div className="settings-field">
        <span className="settings-field-label">Background Assets</span>
        <div className="steam-marketplace-logo-list">
          {backgroundAssets.length === 0 ? (
            <p className="steam-marketplace-logo-empty">Upload and assign a background to add it here.</p>
          ) : (
          backgroundAssets.map((asset) => (
            <div key={asset.relativePath} className="steam-marketplace-logo-list-row">
              <button
                type="button"
                className={`steam-marketplace-logo-list-item ${art.borderStyle.backgroundImageRelativePath === asset.relativePath ? 'active' : ''}`}
                onClick={() => onAssignBackgroundAsset(asset.relativePath)}
                title={asset.relativePath.split('/').pop()}
              >
                <img src={asset.assetUrl} alt={asset.relativePath} loading="lazy" />
                <span>{asset.relativePath.split('/').pop() ?? asset.relativePath}</span>
              </button>
              <button
                type="button"
                className="icon-action danger steam-marketplace-logo-delete"
                onClick={() => {
                  onRemoveBackgroundAsset(asset.relativePath);
                }}
                title="Remove background from list"
                aria-label="Remove background from list"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          )))}
        </div>
      </div>
      <div className="steam-marketplace-upload-actions">
        <button type="button" onClick={() => backgroundFileInputRef.current?.click()}>
          Upload Background
        </button>
      </div>
      <input
        ref={backgroundFileInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.currentTarget.value = '';
          if (files.length > 0) {
            void onImportFiles(files, 'background');
          }
        }}
      />
        </>
      ) : null}
      {activeStyleTab === 'image' && selectedEntry ? (
        <>
      <label className="settings-field">
        <span className="settings-field-label">Border</span>
        <div className="tool-style-grid steam-achievement-toggle-grid">
          <button
            type="button"
            className={`tool-style-option ${art.borderStyle.enabled ? 'active' : ''}`}
            onClick={() => onBorderStyleChange({ enabled: true })}
          >
            <span className="tool-style-icon"><i className="fa-regular fa-square"></i></span>
            <span className="tool-style-name">On</span>
          </button>
          <button
            type="button"
            className={`tool-style-option ${!art.borderStyle.enabled ? 'active' : ''}`}
            onClick={() => onBorderStyleChange({ enabled: false })}
          >
            <span className="tool-style-icon"><i className="fa-regular fa-square-minus"></i></span>
            <span className="tool-style-name">Off</span>
          </button>
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Border Angle ({Math.round(art.borderStyle.gradientAngle)}deg)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="359"
          step="1"
          value={art.borderStyle.gradientAngle}
          onChange={(event) => onBorderStyleChange({ gradientAngle: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Thickness ({Math.round(art.borderStyle.thickness)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="1"
          max="48"
          step="1"
          value={art.borderStyle.thickness}
          onChange={(event) => onBorderStyleChange({ thickness: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Border Opacity ({Math.round(art.borderStyle.opacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={art.borderStyle.opacity}
          onChange={(event) => onBorderStyleChange({ opacity: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Border Margin ({Math.round(art.borderStyle.margin)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="72"
          step="1"
          value={art.borderStyle.margin}
          onChange={(event) => onBorderStyleChange({ margin: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Border Rounding ({Math.round(art.borderStyle.radius)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="96"
          step="1"
          value={art.borderStyle.radius}
          onChange={(event) => onBorderStyleChange({ radius: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Border Colors</span>
        <div className="preset-color-grid steam-achievement-color-grid">
          {[
            { value: art.borderStyle.color, key: 'color' as const },
            { value: art.borderStyle.midColor, key: 'midColor' as const },
            { value: art.borderStyle.gradientColor, key: 'gradientColor' as const },
          ].map((colorStop) => (
            <input
              key={colorStop.key}
              className="settings-input color-input"
              type="color"
              value={colorStop.value}
              onChange={(event) => onBorderStyleChange({ [colorStop.key]: event.target.value })}
            />
          ))}
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Artwork Saturation ({Math.round(selectedImageStyle.adjustments.saturation * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={selectedImageStyle.adjustments.saturation}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              adjustments: {
                ...selectedImageStyle.adjustments,
                saturation: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Artwork Contrast ({Math.round(selectedImageStyle.adjustments.contrast * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0.4"
          max="2"
          step="0.01"
          value={selectedImageStyle.adjustments.contrast}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              adjustments: {
                ...selectedImageStyle.adjustments,
                contrast: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Artwork Blur Opacity ({Math.round(selectedImageStyle.adjustments.blurOpacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={selectedImageStyle.adjustments.blurOpacity}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              adjustments: {
                ...selectedImageStyle.adjustments,
                blurOpacity: Number(event.target.value),
                blurEnabled:
                  Number(event.target.value) > 0 || selectedImageStyle.adjustments.blurRadius > 0,
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Artwork Blur Radius ({Math.round(selectedImageStyle.adjustments.blurRadius)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="64"
          step="1"
          value={selectedImageStyle.adjustments.blurRadius}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              adjustments: {
                ...selectedImageStyle.adjustments,
                blurRadius: Number(event.target.value),
                blurEnabled:
                  Number(event.target.value) > 0 || selectedImageStyle.adjustments.blurOpacity > 0,
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Shadow Blur ({Math.round(selectedImageStyle.shadow.blur)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="96"
          step="1"
          value={selectedImageStyle.shadow.blur}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              shadow: {
                ...selectedImageStyle.shadow,
                blur: Number(event.target.value),
                enabled: Number(event.target.value) > 0 || selectedImageStyle.shadow.opacity > 0,
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Shadow Opacity ({Math.round(selectedImageStyle.shadow.opacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={selectedImageStyle.shadow.opacity}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              shadow: {
                ...selectedImageStyle.shadow,
                opacity: Number(event.target.value),
                enabled: Number(event.target.value) > 0 || selectedImageStyle.shadow.blur > 0,
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Shadow X ({Math.round(selectedImageStyle.shadow.offsetX)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="-64"
          max="64"
          step="1"
          value={selectedImageStyle.shadow.offsetX}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              shadow: {
                ...selectedImageStyle.shadow,
                offsetX: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Shadow Y ({Math.round(selectedImageStyle.shadow.offsetY)}px)</span>
        <input
          className="settings-input"
          type="range"
          min="-64"
          max="64"
          step="1"
          value={selectedImageStyle.shadow.offsetY}
          onChange={(event) =>
            onEntryImageStyleChange(selectedEntry.id, {
              shadow: {
                ...selectedImageStyle.shadow,
                offsetY: Number(event.target.value),
              },
            })
          }
        />
      </label>
        </>
      ) : null}
    </div>
  );

  return (
    <section className="steam-achievement-editor">
      <header className="steam-achievement-header">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">
            Editor type: {meta.label} | Preset: {preset.label}
          </p>
        </div>
      </header>

      <div className="steam-achievement-layout">
        <aside
          className="steam-achievement-entry-list"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            if (event.target instanceof Element && event.target.closest('.steam-achievement-entry-card')) {
              return;
            }
            void handleDrop(event);
          }}
        >
          <div className="steam-achievement-entry-list-header">
            <div className="steam-achievement-entry-list-title">
              <h3>Achievements</h3>
              <span>{art.entries.length}</span>
            </div>
            <div className="steam-achievement-entry-list-actions">
              <button
                type="button"
                className="steam-achievement-export-button"
                onClick={() => {
                  setIsExporting(true);
                  void onExport().finally(() => setIsExporting(false));
                }}
                disabled={isExporting || art.entries.length === 0}
              >
                <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-export'}`}></i>
                <span>{isExporting ? 'Exporting' : 'Export'}</span>
              </button>
              <button type="button" className="steam-achievement-list-add" onClick={onAddEntry}>
                +
              </button>
            </div>
          </div>
          {art.entries.length === 0 ? (
            <div
              className="steam-achievement-empty-list"
            >
              Drop images here to create entries.
            </div>
          ) : (
            art.entries.map((entry) => {
              const asset = getSteamAchievementAssetByPath(assets, entry.sourceImageRelativePath);
              const entryImageStyle = entry.imageStyle ?? createDefaultSteamAchievementEntryImageStyle();
              const rect = asset
                ? getSteamAchievementDrawRect(asset.width, asset.height, framePreset, entry.crop)
                : null;
              const thumbStyle = asset && rect
                ? rectToPercentStyle(rect, framePreset)
                : null;
              return (
                <article
                  key={entry.id}
                  className={`steam-achievement-entry-card ${entry.id === selectedEntry?.id ? 'active' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    void handleDrop(event, entry.id);
                  }}
                >
                  <div className="steam-achievement-entry-preview-grid">
                    <div className="steam-achievement-thumb">
                      <PreviewFrame
                        asset={asset}
                        assetAlt={entry.name}
                        drawStyle={thumbStyle}
                        backgroundStyle={thumbBackgroundStyle}
                        backgroundBlurStyle={thumbBackgroundBlurStyle}
                        backgroundVignetteStyle={thumbBackgroundVignetteStyle}
                        backgroundGradientStyle={thumbBackgroundGradientStyle}
                        imageFrameStyle={thumbImageFrameStyle}
                        borderStyle={thumbBorderStyle}
                        imageStyle={buildSteamAchievementImageCss(entryImageStyle)}
                        imageBlurStyle={buildSteamAchievementImageBlurCss(entryImageStyle, 0.06)}
                      />
                    </div>
                    <div className="steam-achievement-thumb">
                      <PreviewFrame
                        asset={asset}
                        assetAlt={`${entry.name} grayscale preview`}
                        drawStyle={thumbStyle}
                        backgroundStyle={thumbBackgroundStyle}
                        backgroundBlurStyle={thumbBackgroundBlurStyle}
                        backgroundVignetteStyle={thumbBackgroundVignetteStyle}
                        backgroundGradientStyle={thumbBackgroundGradientStyle}
                        imageFrameStyle={thumbImageFrameStyle}
                        borderStyle={thumbBorderStyle}
                        imageStyle={buildSteamAchievementImageCss(entryImageStyle)}
                        imageBlurStyle={buildSteamAchievementImageBlurCss(entryImageStyle, 0.06)}
                        grayscale
                        emptyLabel="Gray"
                      />
                    </div>
                  </div>
                  <input
                    className="steam-achievement-entry-name"
                    value={entry.name}
                    onChange={(event) => onRenameEntry(entry.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    placeholder="achievement_name"
                  />
                  <div className="steam-achievement-entry-footer">
                    <span className="steam-achievement-entry-source">
                      {asset ? asset.relativePath.split('/').pop() : 'No source image'}
                    </span>
                    <button
                      type="button"
                      className="icon-action danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      aria-label="Delete achievement entry"
                      title="Delete achievement entry"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </aside>

        <section
          className="steam-achievement-workbench"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            void handleDrop(event, selectedEntry?.id);
          }}
        >
          {selectedEntry ? (
            <>
              <div className="steam-achievement-crop-header">
                <div>
                  <h3>{selectedEntry.name}</h3>
                  <p>
                    Output {preset.width}x{preset.height} color + grayscale
                  </p>
                </div>
                <div className="steam-achievement-crop-actions">
                  <button type="button" onClick={() => onResetCrop(selectedEntry.id)}>
                    Fit Image
                  </button>
                  <button
                    type="button"
                    className={isCenterGridEnabled ? 'active' : undefined}
                    onClick={() => setIsCenterGridEnabled((current) => !current)}
                    title="Toggle center grid guides"
                  >
                    Grid {isCenterGridEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className={isSnapEnabled ? 'active' : undefined}
                    onClick={() => setIsSnapEnabled((current) => !current)}
                    title="Snap movement to center and crop edges"
                  >
                    Snap {isSnapEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div
                ref={cropStageRef}
                className={`steam-achievement-crop-stage ${selectedAsset ? 'has-image' : ''}`}
              >
                <div className="steam-achievement-crop-stage-backdrop">
                  {selectedAsset && backdropRect ? (
                    <img
                      src={selectedAsset.assetUrl}
                      alt=""
                      aria-hidden="true"
                      className="steam-achievement-crop-backdrop-image"
                      style={{
                        width: `${backdropRect.width}px`,
                        height: `${backdropRect.height}px`,
                        left: `${backdropRect.left}px`,
                        top: `${backdropRect.top}px`,
                      }}
                    />
                  ) : null}
                </div>
                <div
                  ref={cropFrameRef}
                  className={`steam-achievement-crop-surface ${selectedAsset ? 'has-image' : ''}`}
                  onPointerDown={onCropPointerDown}
                >
                  <div className="steam-achievement-preview-background" style={previewBackgroundStyle}></div>
                  <div className="steam-achievement-preview-background" style={previewBackgroundBlurStyle}></div>
                  <div className="steam-achievement-preview-background" style={previewBackgroundVignetteStyle}></div>
                  <div className="steam-achievement-preview-background" style={previewBackgroundGradientStyle}></div>
                  <div className="steam-achievement-preview-frame" style={previewFrameStyle}>
                  {selectedAsset && previewRect ? (
                    <>
                      <img
                        src={selectedAsset.assetUrl}
                        alt={selectedEntry.name}
                        className="steam-achievement-crop-image"
                        style={{
                          width: `${previewRect.width}px`,
                          height: `${previewRect.height}px`,
                          left: `${previewRect.left}px`,
                          top: `${previewRect.top}px`,
                          ...previewImageStyle,
                        }}
                      />
                      {(previewImageBlurStyle.opacity as number) > 0 ? (
                        <img
                          src={selectedAsset.assetUrl}
                          alt=""
                          aria-hidden="true"
                          className="steam-achievement-crop-image"
                          style={{
                            width: `${previewRect.width}px`,
                            height: `${previewRect.height}px`,
                            left: `${previewRect.left}px`,
                            top: `${previewRect.top}px`,
                            ...previewImageBlurStyle,
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <div className="steam-achievement-drop-hint">
                      <strong>Drop an image here</strong>
                      <span>Drag a file from your desktop, paste with Ctrl/Cmd+V, or use an asset from the Images list.</span>
                    </div>
                  )}
                  </div>
                  {isSnapEnabled && isDraggingCropImage && previewRect ? (
                    <div
                      className="steam-achievement-snap-image-bounds"
                      style={{
                        width: `${previewRect.width}px`,
                        height: `${previewRect.height}px`,
                        left: `${frameRect.left * cropFrameScale + previewRect.left}px`,
                        top: `${frameRect.top * cropFrameScale + previewRect.top}px`,
                      }}
                      aria-hidden="true"
                    >
                      <span className="steam-achievement-snap-image-line vertical"></span>
                      <span className="steam-achievement-snap-image-line horizontal"></span>
                    </div>
                  ) : null}
                  <div className="steam-achievement-preview-border steam-achievement-crop-border" style={previewBorderStyle}></div>
                  <div className="steam-achievement-crop-guides" aria-hidden="true">
                    {isCenterGridEnabled ? (
                      <>
                        <span className="steam-achievement-guide-line vertical"></span>
                        <span className="steam-achievement-guide-line horizontal"></span>
                      </>
                    ) : null}
                    <span className="steam-achievement-guide-corner top-left"></span>
                    <span className="steam-achievement-guide-corner top-right"></span>
                    <span className="steam-achievement-guide-corner bottom-left"></span>
                    <span className="steam-achievement-guide-corner bottom-right"></span>
                  </div>
                </div>
              </div>
              <label className="steam-achievement-zoom-control">
                <span>Zoom</span>
                <input
                  type="range"
                  min={String(MIN_STEAM_ACHIEVEMENT_ZOOM)}
                  max={String(MAX_STEAM_ACHIEVEMENT_ZOOM)}
                  step="0.01"
                  value={selectedEntry.crop.zoom}
                  onPointerDown={() => onBeginCropInteraction()}
                  onChange={(event) =>
                    onCropChange(selectedEntry.id, {
                      ...selectedEntry.crop,
                      zoom: Number(event.target.value),
                    })
                  }
                />
                <strong>{selectedEntry.crop.zoom.toFixed(2)}x</strong>
              </label>
              <div className="steam-achievement-catalog-panel">
                <ImageAssetSidebar assets={assets} onDeleteAsset={onDeleteImageAsset} variant="grid" />
              </div>
            </>
          ) : (
            <div
              className="steam-achievement-empty-state"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                void handleDrop(event);
              }}
            >
              <h3>Steam Achievement Art</h3>
              <p>Create an entry or drop images here to start a batch.</p>
            </div>
          )}
        </section>

        <aside className="steam-achievement-assets">
          <div className="steam-achievement-assets-scroll">
            {stylePanel}
          </div>
        </aside>
      </div>
    </section>
  );
};
