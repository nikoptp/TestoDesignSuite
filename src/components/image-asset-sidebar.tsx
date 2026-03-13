import React from 'react';
import type { ProjectImageAsset } from '../shared/types';
import { setImageAssetDragPayload } from '../shared/drag-payloads';

type ImageAssetSidebarProps = {
  assets: ProjectImageAsset[];
  onDeleteAsset: (relativePath: string) => void;
  variant?: 'list' | 'grid';
};

export const ImageAssetSidebar = ({
  assets,
  onDeleteAsset,
  variant = 'list',
}: ImageAssetSidebarProps): React.ReactElement => {
  return (
    <section className={`image-asset-sidebar-section ${variant === 'grid' ? 'is-grid' : ''}`}>
      <div className="draw-sidebar-header">
        <h3>Images</h3>
      </div>
      <p className="template-sidebar-hint">Drag an image to the board</p>
      <div className="image-asset-list">
        {assets.length === 0 ? (
          <p className="image-asset-empty">No cached images yet.</p>
        ) : (
          assets.map((asset) => (
            <article key={asset.relativePath} className="image-asset-item">
              <button
                type="button"
                className="image-asset-thumb"
                draggable
                onDragStart={(event) => {
                  setImageAssetDragPayload(event.dataTransfer, {
                    assetUrl: asset.assetUrl,
                    relativePath: asset.relativePath,
                    width: asset.width,
                    height: asset.height,
                  });
                }}
                title={asset.relativePath}
              >
                <img src={asset.assetUrl} alt={asset.relativePath} loading="lazy" />
              </button>
              <div className="image-asset-meta">
                <p className="image-asset-name">{asset.relativePath.split('/').pop()}</p>
                <p className="image-asset-size">
                  {asset.width}x{asset.height}
                </p>
              </div>
              <button
                type="button"
                className="template-delete-btn"
                onClick={() => onDeleteAsset(asset.relativePath)}
                title="Delete image"
                aria-label="Delete image"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
};
