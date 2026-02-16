import React from 'react';
import type { ProjectImageAsset } from '../shared/types';

type ImageAssetSidebarProps = {
  assets: ProjectImageAsset[];
  onDeleteAsset: (relativePath: string) => void;
};

export const ImageAssetSidebar = ({
  assets,
  onDeleteAsset,
}: ImageAssetSidebarProps): React.ReactElement => {
  return (
    <section className="image-asset-sidebar-section">
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
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData(
                    'application/x-testo-image-asset',
                    JSON.stringify({
                      assetUrl: asset.assetUrl,
                      relativePath: asset.relativePath,
                      width: asset.width,
                      height: asset.height,
                    }),
                  );
                  event.dataTransfer.setData('text/uri-list', asset.assetUrl);
                  event.dataTransfer.setData('text/plain', asset.assetUrl);
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
