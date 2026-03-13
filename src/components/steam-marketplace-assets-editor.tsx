import React from 'react';
import type {
  CategoryNode,
  ProjectImageAsset,
  SteamMarketplaceAssetData,
  SteamMarketplaceCropTransform,
  SteamMarketplaceOutputState,
} from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { getImageAssetDragPayload } from '../shared/drag-payloads';
import { ImageAssetSidebar } from './image-asset-sidebar';
import {
  buildSteamMarketplaceImageFilter,
  buildSteamMarketplaceLogoStyle,
  buildSteamMarketplacePreviewBackground,
  buildSteamMarketplaceVignetteStyle,
  deriveSteamMarketplaceNameFromPath,
  getSteamMarketplaceAssetByPath,
  getSteamMarketplaceLogoRectStyle,
  getSteamMarketplacePreset,
  getSteamMarketplacePreviewRectStyle,
  STEAM_MARKETPLACE_PRESETS,
} from '../features/steam-marketplace/steam-marketplace-assets';
import { isTextEntryTargetElement } from '../features/app/app-model';

type ImportTarget = 'base' | 'logo';

type SteamMarketplaceAssetsEditorProps = {
  node: CategoryNode;
  data: SteamMarketplaceAssetData;
  assets: ProjectImageAsset[];
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onRenameEntry: (entryId: string, name: string) => void;
  onSetEntryPreset: (entryId: string, presetId: string) => void;
  onAssignBaseAssetToEntry: (entryId: string, relativePath: string) => void;
  onAssignLogoAssetToEntry: (entryId: string, relativePath: string | null) => void;
  onRemoveLogoAsset: (relativePath: string) => void;
  onCreateEntryFromAsset: (relativePath: string) => void;
  onImportFiles: (files: File[], target: ImportTarget, targetEntryId?: string) => Promise<void>;
  onCreateAllTemplates: () => void;
  onBeginCropInteraction: () => void;
  onCropChange: (entryId: string, presetId: string, transform: SteamMarketplaceCropTransform) => void;
  onOutputPatch: (entryId: string, presetId: string, patch: Partial<SteamMarketplaceOutputState>) => void;
  onSharedAdjustmentPatch: (
    entryId: string,
    patch: { overlays: Partial<SteamMarketplaceOutputState['overlays']> },
  ) => void;
  onResetCrop: (entryId: string, presetId: string) => void;
  onExport: () => Promise<void>;
  onDeleteImageAsset: (relativePath: string) => void;
};

const isImageFile = (file: File): boolean =>
  file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name);

const getPresetPreviewFrameStyle = (preset: { width: number; height: number }): React.CSSProperties =>
  preset.width / preset.height > 1.15
    ? {
        width: '100%',
        aspectRatio: `${preset.width} / ${preset.height}`,
      }
    : {
        height: '100%',
        aspectRatio: `${preset.width} / ${preset.height}`,
      };

const abbreviateAssetName = (value: string, maxLength = 24): string => {
  if (value.length <= maxLength) {
    return value;
  }
  const prefixLength = Math.max(8, Math.floor((maxLength - 1) * 0.65));
  const suffixLength = Math.max(5, maxLength - prefixLength - 1);
  return `${value.slice(0, prefixLength)}…${value.slice(-suffixLength)}`;
};

const PreviewCard = ({
  preset,
  onSelect,
  isActive,
}: {
  preset: (typeof STEAM_MARKETPLACE_PRESETS)[number];
  onSelect: () => void;
  isActive: boolean;
}): React.ReactElement => {
  const sizeStyle =
    preset.width >= preset.height
      ? {
          width: '100%',
          height: `${(preset.height / preset.width) * 100}%`,
        }
      : {
          width: `${(preset.width / preset.height) * 100}%`,
          height: '100%',
        };

  return (
    <button
      type="button"
      className={`steam-marketplace-preview-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <div className="steam-marketplace-preview-card-header">
        <div>
          <strong>{preset.label}</strong>
          <span>
            {preset.width}x{preset.height} {preset.format.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="steam-marketplace-dimension-card" aria-hidden="true">
        <span className="steam-marketplace-dimension-shape-shell">
          <span className="steam-marketplace-dimension-shape" style={sizeStyle}></span>
        </span>
        <span className="steam-marketplace-dimension-card-size">
          {preset.width}x{preset.height}
        </span>
      </div>
    </button>
  );
};

export const SteamMarketplaceAssetsEditor = ({
  node,
  data,
  assets,
  onAddEntry,
  onDeleteEntry,
  onRenameEntry,
  onSetEntryPreset,
  onAssignBaseAssetToEntry,
  onAssignLogoAssetToEntry,
  onRemoveLogoAsset,
  onCreateEntryFromAsset,
  onImportFiles,
  onCreateAllTemplates,
  onBeginCropInteraction,
  onCropChange,
  onOutputPatch,
  onSharedAdjustmentPatch,
  onResetCrop,
  onExport,
  onDeleteImageAsset,
}: SteamMarketplaceAssetsEditorProps): React.ReactElement => {
  const meta = editorTypeMeta(node.editorType);
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(data.entries[0]?.id ?? null);
  const [activeSidebarTab, setActiveSidebarTab] = React.useState<'logo' | 'adjustments' | 'dimensions'>('logo');
  const [isExporting, setIsExporting] = React.useState(false);
  const [zoomDraft, setZoomDraft] = React.useState<{
    entryId: string;
    presetId: string;
    zoom: number;
  } | null>(null);
  const cropFrameRef = React.useRef<HTMLDivElement | null>(null);
  const baseFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragStateRef = React.useRef<{
    pointerId: number;
    entryId: string;
    presetId: string;
    startX: number;
    startY: number;
    startTransform: SteamMarketplaceCropTransform;
  } | null>(null);

  React.useEffect(() => {
    if (data.entries.length === 0) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !data.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(data.entries[0]?.id ?? null);
    }
  }, [data.entries, selectedEntryId]);

  const selectedEntry = data.entries.find((entry) => entry.id === selectedEntryId) ?? data.entries[0] ?? null;
  const selectedPreset = getSteamMarketplacePreset(selectedEntry?.presetId ?? STEAM_MARKETPLACE_PRESETS[0].id);
  const selectedOutput = selectedEntry?.outputsByPresetId[selectedPreset.id] ?? null;
  const effectiveSelectedCrop =
    selectedEntry &&
    selectedOutput &&
    zoomDraft &&
    zoomDraft.entryId === selectedEntry.id &&
    zoomDraft.presetId === selectedPreset.id
      ? {
          ...selectedOutput.crop,
          zoom: zoomDraft.zoom,
        }
      : selectedOutput?.crop ?? null;
  const selectedAsset = getSteamMarketplaceAssetByPath(assets, selectedEntry?.sourceImageRelativePath ?? null);
  const selectedLogoAsset = getSteamMarketplaceAssetByPath(
    assets,
    selectedEntry?.logoImageRelativePath ?? null,
  );
  const logoAssets = React.useMemo(() => {
    const knownLogoPaths = new Set(data.logoAssetRelativePaths ?? []);
    return assets.filter((asset) => knownLogoPaths.has(asset.relativePath));
  }, [assets, data.logoAssetRelativePaths]);

  React.useEffect(() => {
    if (
      !zoomDraft ||
      !selectedEntry ||
      !selectedOutput ||
      zoomDraft.entryId !== selectedEntry.id ||
      zoomDraft.presetId !== selectedEntry.presetId
    ) {
      return;
    }
    if (Math.abs(selectedOutput.crop.zoom - zoomDraft.zoom) < 0.0001) {
      setZoomDraft(null);
    }
  }, [selectedEntry, selectedOutput, zoomDraft]);

  const handleDrop = React.useCallback(
    async (
      event: React.DragEvent<HTMLElement>,
      target: ImportTarget,
      targetEntryId?: string,
    ): Promise<void> => {
      event.preventDefault();
      const draggedAsset = getImageAssetDragPayload(event.dataTransfer);
      if (draggedAsset) {
        if (target === 'logo' && targetEntryId) {
          onAssignLogoAssetToEntry(targetEntryId, draggedAsset.relativePath);
          return;
        }
        if (targetEntryId) {
          onAssignBaseAssetToEntry(targetEntryId, draggedAsset.relativePath);
        } else {
          onCreateEntryFromAsset(draggedAsset.relativePath);
        }
        return;
      }

      const files = Array.from(event.dataTransfer.files).filter(isImageFile);
      if (files.length > 0) {
        await onImportFiles(files, target, targetEntryId);
      }
    },
    [onAssignBaseAssetToEntry, onAssignLogoAssetToEntry, onCreateEntryFromAsset, onImportFiles],
  );

  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      if (isTextEntryTargetElement(event.target)) {
        return;
      }
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      if (files.length === 0 || !selectedEntry) {
        return;
      }
      event.preventDefault();
      void onImportFiles(files, 'base', selectedEntry.id);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onImportFiles, selectedEntry]);

  const onCropPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!selectedEntry || !selectedAsset || !selectedOutput || selectedPreset.kind !== 'image') {
        return;
      }
      event.preventDefault();
      onBeginCropInteraction();
      const nextDrag = {
        pointerId: event.pointerId,
        entryId: selectedEntry.id,
        presetId: selectedPreset.id,
        startX: event.clientX,
        startY: event.clientY,
        startTransform: selectedOutput.crop,
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
        onCropChange(nextDrag.entryId, nextDrag.presetId, {
          ...nextDrag.startTransform,
          offsetX:
            nextDrag.startTransform.offsetX +
            (moveEvent.clientX - nextDrag.startX) * (selectedPreset.width / Math.max(1, frame.clientWidth)),
          offsetY:
            nextDrag.startTransform.offsetY +
            (moveEvent.clientY - nextDrag.startY) * (selectedPreset.height / Math.max(1, frame.clientHeight)),
        });
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
    [onBeginCropInteraction, onCropChange, selectedAsset, selectedEntry, selectedOutput, selectedPreset],
  );

  React.useEffect(() => {
    const frame = cropFrameRef.current;
    if (!frame) {
      return;
    }
    const onWheel = (event: WheelEvent): void => {
      if (!selectedEntry || !selectedAsset || !selectedOutput || selectedPreset.kind !== 'image') {
        return;
      }
      event.preventDefault();
      onBeginCropInteraction();
      const zoomDelta = event.deltaY < 0 ? 0.14 : -0.14;
      setZoomDraft(null);
      onCropChange(selectedEntry.id, selectedPreset.id, {
        ...selectedOutput.crop,
        zoom: Math.max(1, Math.min(12, selectedOutput.crop.zoom + zoomDelta)),
      });
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [onBeginCropInteraction, onCropChange, selectedAsset, selectedEntry, selectedOutput, selectedPreset]);

  const previewRectStyle =
    selectedAsset && effectiveSelectedCrop && selectedPreset.kind === 'image'
      ? getSteamMarketplacePreviewRectStyle(
          selectedAsset.width,
          selectedAsset.height,
          selectedPreset,
          effectiveSelectedCrop,
        )
      : null;

  const runExport = (): void => {
    setIsExporting(true);
    void onExport().finally(() => setIsExporting(false));
  };

  const commitZoomDraft = React.useCallback((): void => {
    if (!selectedEntry || !selectedOutput || !zoomDraft) {
      return;
    }
    if (zoomDraft.entryId !== selectedEntry.id || zoomDraft.presetId !== selectedPreset.id) {
      return;
    }
    setZoomDraft(null);
    onCropChange(selectedEntry.id, selectedPreset.id, {
      ...selectedOutput.crop,
      zoom: zoomDraft.zoom,
    });
  }, [onCropChange, selectedEntry, selectedOutput, selectedPreset.id, zoomDraft]);

  return (
    <section className="steam-marketplace-editor">
      <header className="steam-marketplace-header">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">
            Editor type: {meta.label} | Outputs: {STEAM_MARKETPLACE_PRESETS.length}
          </p>
        </div>
      </header>

      <div className="steam-marketplace-layout">
        <aside
          className="steam-marketplace-entry-list"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            if (event.target instanceof Element && event.target.closest('.steam-marketplace-entry-card')) {
              return;
            }
            void handleDrop(event, 'base');
          }}
        >
          <div className="steam-marketplace-entry-list-header">
            <div className="steam-marketplace-entry-list-title">
              <h3>Entries</h3>
              <span>{data.entries.length}</span>
            </div>
            <div className="steam-marketplace-entry-list-actions">
              <button
                type="button"
                className="steam-achievement-export-button"
                onClick={() => runExport()}
                disabled={isExporting || data.entries.length === 0}
              >
                <i className={`fa-solid ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-export'}`}></i>
                <span>{isExporting ? 'Exporting' : 'Export Set'}</span>
              </button>
              <button type="button" className="steam-marketplace-create-all" onClick={onCreateAllTemplates}>
                All
              </button>
              <button type="button" className="steam-achievement-list-add" onClick={onAddEntry}>
                +
              </button>
            </div>
          </div>
          {data.entries.length === 0 ? (
            <div className="steam-achievement-empty-list">Drop images here to create entries.</div>
          ) : (
            data.entries.map((entry) => {
              const asset = getSteamMarketplaceAssetByPath(assets, entry.sourceImageRelativePath);
              const logoAsset = getSteamMarketplaceAssetByPath(assets, entry.logoImageRelativePath);
              const previewPreset = getSteamMarketplacePreset(entry.presetId);
              const previewOutput = entry.outputsByPresetId[previewPreset.id];
              const thumbStyle =
                asset && previewOutput && previewPreset.kind === 'image'
                  ? getSteamMarketplacePreviewRectStyle(asset.width, asset.height, previewPreset, previewOutput.crop)
                  : null;
              const thumbLogoRectStyle =
                logoAsset && (previewPreset.kind === 'logo' || previewOutput?.overlays.logo.enabled)
                  ? getSteamMarketplaceLogoRectStyle(
                      logoAsset.width,
                      logoAsset.height,
                      previewPreset,
                      previewOutput,
                    )
                  : null;
              return (
                <article
                  key={entry.id}
                  className={`steam-marketplace-entry-card ${entry.id === selectedEntry?.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedEntryId(entry.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleDrop(event, 'base', entry.id)}
                >
                  <div className="steam-marketplace-entry-thumb-shell">
                    <div
                      className="steam-marketplace-entry-thumb"
                      style={getPresetPreviewFrameStyle(previewPreset)}
                    >
                      {asset && thumbStyle ? (
                        <>
                          <img
                            className="steam-marketplace-thumb-image"
                            src={asset.assetUrl}
                            alt={entry.name}
                            style={{
                              ...thumbStyle,
                              filter: buildSteamMarketplaceImageFilter(previewOutput),
                            }}
                          />
                          {previewOutput.overlays.blur.enabled && previewOutput.overlays.blur.opacity > 0 ? (
                            <img
                              className="steam-marketplace-thumb-image"
                              src={asset.assetUrl}
                              alt=""
                              aria-hidden="true"
                              style={{
                                ...thumbStyle,
                                filter: `${buildSteamMarketplaceImageFilter(previewOutput)} blur(${Math.max(0, previewOutput.overlays.blur.blurRadius * 0.12)}px)`,
                                opacity: previewOutput.overlays.blur.opacity,
                              }}
                            />
                          ) : null}
                        </>
                      ) : (
                        <span className="steam-marketplace-thumb-empty">
                          {previewPreset.width}x{previewPreset.height}
                        </span>
                      )}
                      {previewPreset.kind === 'image' ? (
                        <>
                          <div className="steam-marketplace-thumb-vignette" style={buildSteamMarketplaceVignetteStyle(previewOutput)} />
                          <div className="steam-marketplace-thumb-gradient" style={buildSteamMarketplacePreviewBackground(previewOutput)} />
                        </>
                      ) : null}
                      {logoAsset && thumbLogoRectStyle && (previewPreset.kind === 'logo' || previewOutput.overlays.logo.enabled) ? (
                        <div className="steam-marketplace-thumb-logo-shell">
                          <img
                            className="steam-marketplace-thumb-logo"
                            src={logoAsset.assetUrl}
                            alt={`${entry.name} logo`}
                            style={{
                              ...thumbLogoRectStyle,
                              ...buildSteamMarketplaceLogoStyle(previewOutput),
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <input
                    className="steam-achievement-entry-name"
                    value={entry.name}
                    onChange={(event) => onRenameEntry(entry.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    placeholder={deriveSteamMarketplaceNameFromPath('marketplace-asset.png')}
                  />
                  <div className="steam-achievement-entry-footer">
                    <span className="steam-achievement-entry-source">
                      {asset ? asset.relativePath.split('/').pop() : 'No source image'}
                    </span>
                    <span className="steam-marketplace-entry-resolution">
                      {asset ? `${asset.width}x${asset.height}` : 'No size'}
                    </span>
                    <button
                      type="button"
                      className="icon-action danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
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
          className="steam-marketplace-workbench"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => void handleDrop(event, 'base', selectedEntry?.id)}
        >
          {selectedEntry && selectedOutput ? (
            <>
              <div className="steam-marketplace-crop-header">
                <div>
                  <h3>{selectedEntry.name}</h3>
                  <p>
                    Active output {selectedPreset.label} | {selectedPreset.width}x{selectedPreset.height}
                  </p>
                </div>
                <div className="steam-achievement-crop-actions">
                  <button type="button" onClick={() => onResetCrop(selectedEntry.id, selectedPreset.id)}>
                    Fit Image
                  </button>
                </div>
              </div>
              <div
                className={`steam-marketplace-crop-stage ${selectedAsset ? 'has-image' : ''}`}
                style={{ aspectRatio: `${selectedPreset.width} / ${selectedPreset.height}` }}
              >
                <div className="steam-achievement-crop-stage-backdrop"></div>
                <div
                  ref={cropFrameRef}
                  className={`steam-marketplace-crop-surface ${selectedAsset ? 'has-image' : ''}`}
                  onPointerDown={onCropPointerDown}
                >
                  {selectedAsset && previewRectStyle && selectedPreset.kind === 'image' ? (
                    <>
                      <img
                        src={selectedAsset.assetUrl}
                        alt={selectedEntry.name}
                        className="steam-achievement-crop-image"
                        style={{
                          ...previewRectStyle,
                          filter: buildSteamMarketplaceImageFilter(selectedOutput),
                        }}
                      />
                      {selectedOutput.overlays.blur.enabled && selectedOutput.overlays.blur.opacity > 0 ? (
                        <img
                          src={selectedAsset.assetUrl}
                          alt=""
                          aria-hidden="true"
                          className="steam-achievement-crop-image"
                          style={{
                            ...previewRectStyle,
                            filter: `${buildSteamMarketplaceImageFilter(selectedOutput)} blur(${Math.max(0, selectedOutput.overlays.blur.blurRadius * 0.2)}px)`,
                            opacity: selectedOutput.overlays.blur.opacity,
                          }}
                        />
                      ) : null}
                    </>
                  ) : selectedPreset.kind === 'logo' && selectedLogoAsset ? (
                    <div className="steam-marketplace-logo-workbench">
                      <img
                        src={selectedLogoAsset.assetUrl}
                        alt={`${selectedEntry.name} logo`}
                        className="steam-marketplace-logo-workbench-image"
                        style={{
                          ...getSteamMarketplaceLogoRectStyle(
                            selectedLogoAsset.width,
                            selectedLogoAsset.height,
                            selectedPreset,
                            selectedOutput,
                          ),
                          ...buildSteamMarketplaceLogoStyle(selectedOutput),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="steam-achievement-drop-hint">
                      <strong>{selectedPreset.kind === 'logo' ? 'Drop a logo here' : 'Drop an image here'}</strong>
                      <span>
                        Drag a file from your desktop, paste with Ctrl/Cmd+V, or use an asset from the Images list.
                      </span>
                    </div>
                  )}
                  {selectedPreset.kind === 'image' ? (
                    <>
                      <div className="steam-marketplace-canvas-vignette" style={buildSteamMarketplaceVignetteStyle(selectedOutput)} />
                      <div className="steam-marketplace-canvas-gradient" style={buildSteamMarketplacePreviewBackground(selectedOutput)} />
                    </>
                  ) : null}
                  {selectedLogoAsset && selectedPreset.kind === 'image' && selectedOutput.overlays.logo.enabled ? (
                    <div className="steam-marketplace-logo-workbench">
                      <img
                        src={selectedLogoAsset.assetUrl}
                        alt={`${selectedEntry.name} logo`}
                        className="steam-marketplace-logo-workbench-image"
                        style={{
                          ...getSteamMarketplaceLogoRectStyle(
                            selectedLogoAsset.width,
                            selectedLogoAsset.height,
                            selectedPreset,
                            selectedOutput,
                          ),
                          ...buildSteamMarketplaceLogoStyle(selectedOutput),
                        }}
                      />
                    </div>
                  ) : null}
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
              {selectedPreset.kind === 'image' ? (
                <label className="steam-achievement-zoom-control">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="0.01"
                    value={effectiveSelectedCrop?.zoom ?? selectedOutput.crop.zoom}
                    onPointerDown={() => {
                      onBeginCropInteraction();
                      setZoomDraft({
                        entryId: selectedEntry.id,
                        presetId: selectedPreset.id,
                        zoom: effectiveSelectedCrop?.zoom ?? selectedOutput.crop.zoom,
                      });
                    }}
                    onChange={(event) =>
                      setZoomDraft({
                        entryId: selectedEntry.id,
                        presetId: selectedPreset.id,
                        zoom: Number(event.target.value),
                      })
                    }
                    onPointerUp={commitZoomDraft}
                    onBlur={commitZoomDraft}
                    onKeyUp={(event) => {
                      if (
                        event.key.startsWith('Arrow') ||
                        event.key === 'Home' ||
                        event.key === 'End' ||
                        event.key === 'PageUp' ||
                        event.key === 'PageDown'
                      ) {
                        commitZoomDraft();
                      }
                    }}
                  />
                  <strong>{(effectiveSelectedCrop?.zoom ?? selectedOutput.crop.zoom).toFixed(2)}x</strong>
                </label>
              ) : null}
              <div className="steam-marketplace-catalog-panel">
                <ImageAssetSidebar assets={assets} onDeleteAsset={onDeleteImageAsset} variant="grid" />
              </div>
            </>
          ) : (
            <div className="steam-achievement-empty-state">
              <h3>Steam Marketplace Assets</h3>
              <p>Create an entry or drop images here to start a batch.</p>
            </div>
          )}
        </section>

        <aside className="steam-marketplace-assets">
          <div className="steam-marketplace-assets-scroll">
            {selectedEntry && selectedOutput ? (
              <>
                <div className="steam-marketplace-sidebar-tabs">
                  <button
                    type="button"
                    className={`tool-style-option ${activeSidebarTab === 'logo' ? 'active' : ''}`}
                    onClick={() => setActiveSidebarTab('logo')}
                  >
                    <span className="tool-style-icon"><i className="fa-solid fa-font"></i></span>
                    <span className="tool-style-name">Logo</span>
                  </button>
                  <button
                    type="button"
                    className={`tool-style-option ${activeSidebarTab === 'adjustments' ? 'active' : ''}`}
                    onClick={() => setActiveSidebarTab('adjustments')}
                  >
                    <span className="tool-style-icon"><i className="fa-solid fa-sliders"></i></span>
                    <span className="tool-style-name">Adjustments</span>
                  </button>
                  <button
                    type="button"
                    className={`tool-style-option ${activeSidebarTab === 'dimensions' ? 'active' : ''}`}
                    onClick={() => setActiveSidebarTab('dimensions')}
                  >
                    <span className="tool-style-icon"><i className="fa-solid fa-up-right-and-down-left-from-center"></i></span>
                    <span className="tool-style-name">Dimensions</span>
                  </button>
                </div>
                {activeSidebarTab === 'logo' ? (
              <div className="steam-marketplace-controls">
                <div className="draw-sidebar-header">
                  <h3>Logo</h3>
                </div>
                <p className="steam-marketplace-output-meta">
                  {selectedPreset.width}x{selectedPreset.height} {selectedPreset.format.toUpperCase()}
                </p>
                  <div
                    className="steam-marketplace-logo-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => void handleDrop(event, 'logo', selectedEntry.id)}
                >
                  <strong>Drop logo here</strong>
                  <span>Assign a dragged asset or upload a new logo for this entry.</span>
                </div>
                  <div className="settings-field">
                    <span className="settings-field-label">Logo Assets</span>
                    <div className="steam-marketplace-logo-list">
                    <button
                      type="button"
                      className={`steam-marketplace-logo-list-item ${selectedEntry.logoImageRelativePath === null ? 'active' : ''}`}
                      onClick={() => onAssignLogoAssetToEntry(selectedEntry.id, null)}
                    >
                      <span>No logo</span>
                    </button>
                    {logoAssets.length === 0 ? (
                      <p className="steam-marketplace-logo-empty">Upload and assign a logo to add it here.</p>
                    ) : (
                      logoAssets.map((asset) => (
                        <div key={asset.relativePath} className="steam-marketplace-logo-list-row">
                          <button
                            type="button"
                            className={`steam-marketplace-logo-list-item ${selectedEntry.logoImageRelativePath === asset.relativePath ? 'active' : ''}`}
                            onClick={() => onAssignLogoAssetToEntry(selectedEntry.id, asset.relativePath)}
                            title={asset.relativePath.split('/').pop()}
                          >
                            <img src={asset.assetUrl} alt={asset.relativePath} loading="lazy" />
                            <span>{abbreviateAssetName(asset.relativePath.split('/').pop() ?? asset.relativePath)}</span>
                          </button>
                          <button
                            type="button"
                            className="icon-action danger steam-marketplace-logo-delete"
                            onClick={() => onRemoveLogoAsset(asset.relativePath)}
                            title="Remove logo from list"
                            aria-label="Remove logo from list"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="steam-marketplace-upload-actions">
                  <button type="button" onClick={() => logoFileInputRef.current?.click()}>
                    Upload Logo
                  </button>
                </div>
                <input
                  ref={logoFileInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.currentTarget.value = '';
                    if (files.length > 0) {
                      void onImportFiles(files, 'logo', selectedEntry.id);
                    }
                  }}
                />
                <label className="settings-field">
                  <span className="settings-field-label">Logo X ({selectedOutput.overlays.logo.offsetX.toFixed(1)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="-100"
                    max="100"
                    step="0.5"
                    value={selectedOutput.overlays.logo.offsetX}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            offsetX: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Logo Y ({selectedOutput.overlays.logo.offsetY.toFixed(1)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="-100"
                    max="100"
                    step="0.5"
                    value={selectedOutput.overlays.logo.offsetY}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            offsetY: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Logo Scale ({selectedOutput.overlays.logo.scale.toFixed(2)}x)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0.1"
                    max="3.5"
                    step="0.01"
                    value={selectedOutput.overlays.logo.scale}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            scale: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Logo Opacity ({Math.round(selectedOutput.overlays.logo.opacity * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedOutput.overlays.logo.opacity}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            opacity: Number(event.target.value),
                            enabled: Number(event.target.value) > 0,
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Logo Shadow Blur ({Math.round(selectedOutput.overlays.logo.shadowBlur)}px)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="96"
                    step="1"
                    value={selectedOutput.overlays.logo.shadowBlur}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            shadowBlur: Number(event.target.value),
                            shadowEnabled:
                              Number(event.target.value) > 0 || selectedOutput.overlays.logo.shadowOpacity > 0,
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Logo Shadow Opacity ({Math.round(selectedOutput.overlays.logo.shadowOpacity * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedOutput.overlays.logo.shadowOpacity}
                    onChange={(event) =>
                      onOutputPatch(selectedEntry.id, selectedPreset.id, {
                        overlays: {
                          ...selectedOutput.overlays,
                          logo: {
                            ...selectedOutput.overlays.logo,
                            shadowOpacity: Number(event.target.value),
                            shadowEnabled:
                              Number(event.target.value) > 0 || selectedOutput.overlays.logo.shadowBlur > 0,
                          },
                        },
                      })
                    }
                  />
                </label>
              </div>
                ) : activeSidebarTab === 'adjustments' ? (
              <div className="steam-marketplace-controls">
                <div className="draw-sidebar-header">
                  <h3>Adjustments</h3>
                </div>
                <p className="steam-marketplace-output-meta">
                  {selectedPreset.width}x{selectedPreset.height} {selectedPreset.format.toUpperCase()}
                </p>
                <div className="steam-marketplace-upload-actions">
                  <button type="button" onClick={() => baseFileInputRef.current?.click()}>
                    Upload Base Image
                  </button>
                </div>
                <input
                  ref={baseFileInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.currentTarget.value = '';
                    if (files.length > 0) {
                      void onImportFiles(files, 'base', selectedEntry.id);
                    }
                  }}
                />
                <label className="settings-field">
                  <span className="settings-field-label">Saturation ({Math.round(selectedOutput.overlays.image.saturation * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={selectedOutput.overlays.image.saturation}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          image: {
                            ...selectedOutput.overlays.image,
                            saturation: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Contrast ({Math.round(selectedOutput.overlays.image.contrast * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0.4"
                    max="2"
                    step="0.01"
                    value={selectedOutput.overlays.image.contrast}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          image: {
                            ...selectedOutput.overlays.image,
                            contrast: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Vignette ({Math.round(selectedOutput.overlays.image.vignette * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedOutput.overlays.image.vignette}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          image: {
                            ...selectedOutput.overlays.image,
                            vignette: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Gradient Opacity ({Math.round(selectedOutput.overlays.gradient.opacity * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedOutput.overlays.gradient.opacity}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          gradient: {
                            ...selectedOutput.overlays.gradient,
                            opacity: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Gradient Angle ({Math.round(selectedOutput.overlays.gradient.angle)}deg)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="359"
                    step="1"
                    value={selectedOutput.overlays.gradient.angle}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          gradient: {
                            ...selectedOutput.overlays.gradient,
                            angle: Number(event.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Gradient Colors</span>
                  <div className="preset-color-grid steam-achievement-color-grid">
                    {([
                      { key: 'color', value: selectedOutput.overlays.gradient.color },
                      { key: 'midColor', value: selectedOutput.overlays.gradient.midColor },
                      { key: 'endColor', value: selectedOutput.overlays.gradient.endColor },
                    ] as const).map((stop) => (
                      <input
                        key={stop.key}
                        className="settings-input color-input"
                        type="color"
                        value={stop.value}
                        onChange={(event) =>
                          onSharedAdjustmentPatch(selectedEntry.id, {
                            overlays: {
                              gradient: {
                                ...selectedOutput.overlays.gradient,
                                [stop.key]: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Blur Layer Opacity ({Math.round(selectedOutput.overlays.blur.opacity * 100)}%)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedOutput.overlays.blur.opacity}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          blur: {
                            ...selectedOutput.overlays.blur,
                            opacity: Number(event.target.value),
                            enabled: Number(event.target.value) > 0 || selectedOutput.overlays.blur.blurRadius > 0,
                          },
                        },
                      })
                    }
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">Blur Radius ({Math.round(selectedOutput.overlays.blur.blurRadius)}px)</span>
                  <input
                    className="settings-input"
                    type="range"
                    min="0"
                    max="64"
                    step="1"
                    value={selectedOutput.overlays.blur.blurRadius}
                    onChange={(event) =>
                      onSharedAdjustmentPatch(selectedEntry.id, {
                        overlays: {
                          blur: {
                            ...selectedOutput.overlays.blur,
                            blurRadius: Number(event.target.value),
                            enabled: Number(event.target.value) > 0 || selectedOutput.overlays.blur.opacity > 0,
                          },
                        },
                      })
                    }
                  />
                </label>
              </div>
                ) : (
                <div className="steam-marketplace-dimensions-panel">
                  <div className="draw-sidebar-header">
                    <h3>Dimensions</h3>
                  </div>
                  <div className="steam-marketplace-preview-grid">
                  {STEAM_MARKETPLACE_PRESETS.map((preset) => {
                    return (
                      <PreviewCard
                        key={preset.id}
                        preset={preset}
                        isActive={preset.id === selectedPreset.id}
                      onSelect={() => onSetEntryPreset(selectedEntry.id, preset.id)}
                    />
                    );
                  })}
                </div>
                </div>
                )}
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
};
