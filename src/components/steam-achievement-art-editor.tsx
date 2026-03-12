import React from 'react';
import type {
  CategoryNode,
  ProjectImageAsset,
  SteamAchievementArtData,
  SteamAchievementBorderStyle,
  SteamAchievementTransform,
} from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { getImageAssetDragPayload } from '../shared/drag-payloads';
import { ImageAssetSidebar } from './image-asset-sidebar';
import {
  buildSteamAchievementBackgroundCss,
  buildSteamAchievementBorderCss,
  MAX_STEAM_ACHIEVEMENT_ZOOM,
  MIN_STEAM_ACHIEVEMENT_ZOOM,
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
  onImportFiles: (files: File[], targetEntryId?: string) => Promise<void>;
  onBeginCropInteraction: () => void;
  onCropChange: (entryId: string, transform: SteamAchievementTransform) => void;
  onResetCrop: (entryId: string) => void;
  onBorderStyleChange: (patch: Partial<SteamAchievementBorderStyle>) => void;
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

type PreviewFrameProps = {
  asset: ProjectImageAsset | null;
  assetAlt: string;
  drawStyle: React.CSSProperties | null;
  backgroundStyle: React.CSSProperties;
  imageFrameStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
  grayscale?: boolean;
  emptyLabel?: string;
};

const PreviewFrame = ({
  asset,
  assetAlt,
  drawStyle,
  backgroundStyle,
  imageFrameStyle,
  borderStyle,
  grayscale = false,
  emptyLabel,
}: PreviewFrameProps): React.ReactElement => (
  <div className={`steam-achievement-preview-shell ${grayscale ? 'is-grayscale' : ''}`}>
    <div className="steam-achievement-preview-background" style={backgroundStyle}></div>
    <div className="steam-achievement-preview-frame" style={imageFrameStyle}>
      {asset && drawStyle ? (
        <img src={asset.assetUrl} alt={assetAlt} style={drawStyle} />
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
  onExport,
  onDeleteImageAsset,
}: SteamAchievementArtEditorProps): React.ReactElement => {
  const meta = editorTypeMeta(node.editorType);
  const preset = React.useMemo(() => getSteamImagePreset(art.presetId), [art.presetId]);
  const [activeStyleTab, setActiveStyleTab] = React.useState<'border' | 'background'>('border');
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
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(art.entries[0]?.id ?? null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [cropFrameScale, setCropFrameScale] = React.useState(1);
  const [cropFrameOffset, setCropFrameOffset] = React.useState({ left: 0, top: 0 });
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
      setCropFrameScale(Math.max(0.01, frame.clientWidth / preset.width));
      setCropFrameOffset({
        left: (stage.clientWidth - frame.clientWidth) * 0.5,
        top: (stage.clientHeight - frame.clientHeight) * 0.5,
      });
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

      await onImportFiles(files, selectedEntry?.id);
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
        await onImportFiles(files, targetEntryId);
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
        const nextTransform = {
          ...nextDrag.startTransform,
          offsetX:
            nextDrag.startTransform.offsetX +
            (moveEvent.clientX - nextDrag.startX) * (framePreset.width / frameWidth),
          offsetY:
            nextDrag.startTransform.offsetY +
            (moveEvent.clientY - nextDrag.startY) * (framePreset.height / frameHeight),
        };
        onCropChange(nextDrag.entryId, nextTransform);
      };
      const onPointerEnd = (endEvent: PointerEvent): void => {
        if (dragStateRef.current?.pointerId !== endEvent.pointerId) {
          return;
        }
        dragStateRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerEnd);
        window.removeEventListener('pointercancel', onPointerEnd);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerEnd);
      window.addEventListener('pointercancel', onPointerEnd);
    },
    [framePreset.height, framePreset.width, onBeginCropInteraction, onCropChange, selectedAsset, selectedEntry],
  );

  const onCropWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>): void => {
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
    },
    [onBeginCropInteraction, onCropChange, selectedAsset, selectedEntry],
  );

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
    () => buildSteamAchievementBackgroundCss(art.borderStyle, backgroundAsset?.assetUrl ?? null),
    [art.borderStyle, backgroundAsset?.assetUrl],
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
    () => buildSteamAchievementBackgroundCss(art.borderStyle, backgroundAsset?.assetUrl ?? null),
    [art.borderStyle, backgroundAsset?.assetUrl],
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
  const stylePanel = (
    <div className="steam-achievement-style-sidebar">
      <div className="draw-sidebar-header">
        <h3>Frame Style</h3>
      </div>
      <div className="tool-style-grid steam-achievement-tab-grid">
        {([
          { key: 'border', label: 'Border', icon: 'fa-draw-polygon' },
          { key: 'background', label: 'Background', icon: 'fa-layer-group' },
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
      {activeStyleTab === 'border' ? (
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
        <span className="settings-field-label">Opacity ({Math.round(art.borderStyle.opacity * 100)}%)</span>
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
        <span className="settings-field-label">Margin ({Math.round(art.borderStyle.margin)}px)</span>
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
        <span className="settings-field-label">Rounding ({Math.round(art.borderStyle.radius)}px)</span>
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
        </>
      ) : null}
      {activeStyleTab === 'background' ? (
        <>
      <label className="settings-field">
        <span className="settings-field-label">Background</span>
        <div className="tool-style-grid steam-achievement-bgmode-grid">
          {([
            { value: 'none', label: 'None', icon: 'fa-ban' },
            { value: 'gradient', label: 'Gradient', icon: 'fa-swatchbook' },
            { value: 'image', label: 'Image', icon: 'fa-image' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`tool-style-option ${art.borderStyle.backgroundMode === option.value ? 'active' : ''}`}
              onClick={() =>
                onBorderStyleChange({
                  backgroundMode: option.value,
                })
              }
            >
              <span className="tool-style-icon"><i className={`fa-solid ${option.icon}`}></i></span>
              <span className="tool-style-name">{option.label}</span>
            </button>
          ))}
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Opacity ({Math.round(art.borderStyle.backgroundOpacity * 100)}%)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={art.borderStyle.backgroundOpacity}
          onChange={(event) => onBorderStyleChange({ backgroundOpacity: Number(event.target.value) })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Angle ({Math.round(art.borderStyle.backgroundAngle)}deg)</span>
        <input
          className="settings-input"
          type="range"
          min="0"
          max="359"
          step="1"
          disabled={art.borderStyle.backgroundMode !== 'gradient'}
          value={art.borderStyle.backgroundAngle}
          onChange={(event) => onBorderStyleChange({ backgroundAngle: Number(event.target.value) })}
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
              disabled={art.borderStyle.backgroundMode !== 'gradient'}
              value={colorStop.value}
              onChange={(event) => onBorderStyleChange({ [colorStop.key]: event.target.value })}
            />
          ))}
        </div>
      </label>
      <label className="settings-field">
        <span className="settings-field-label">Background Image</span>
        <select
          className="settings-input"
          disabled={art.borderStyle.backgroundMode !== 'image'}
          value={art.borderStyle.backgroundImageRelativePath ?? ''}
          onChange={(event) =>
            onBorderStyleChange({
              backgroundImageRelativePath: event.target.value || null,
            })
          }
        >
          <option value="">Select image</option>
          {assets.map((asset) => (
            <option key={asset.relativePath} value={asset.relativePath}>
              {asset.relativePath.split('/').pop()}
            </option>
          ))}
        </select>
      </label>
      <p className="steam-achievement-sidebar-hint">
        Select a project image to fill the background layer behind the cropped artwork.
      </p>
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
                        imageFrameStyle={thumbImageFrameStyle}
                        borderStyle={thumbBorderStyle}
                      />
                    </div>
                    <div className="steam-achievement-thumb">
                      <PreviewFrame
                        asset={asset}
                        assetAlt={`${entry.name} grayscale preview`}
                        drawStyle={thumbStyle}
                        backgroundStyle={thumbBackgroundStyle}
                        imageFrameStyle={thumbImageFrameStyle}
                        borderStyle={thumbBorderStyle}
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
                  onWheel={onCropWheel}
                >
                  <div className="steam-achievement-preview-background" style={previewBackgroundStyle}></div>
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
                        }}
                      />
                    </>
                  ) : (
                    <div className="steam-achievement-drop-hint">
                      <strong>Drop an image here</strong>
                      <span>Drag a file from your desktop, paste with Ctrl/Cmd+V, or use an asset from the Images list.</span>
                    </div>
                  )}
                  </div>
                  <div className="steam-achievement-preview-border steam-achievement-crop-border" style={previewBorderStyle}></div>
                  <div className="steam-achievement-crop-guides" aria-hidden="true">
                    <span className="steam-achievement-guide-line vertical"></span>
                    <span className="steam-achievement-guide-line horizontal"></span>
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
            <ImageAssetSidebar assets={assets} onDeleteAsset={onDeleteImageAsset} />
          </div>
        </aside>
      </div>
    </section>
  );
};
