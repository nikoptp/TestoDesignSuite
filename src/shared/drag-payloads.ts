export const TREE_NODE_DRAG_MIME = 'application/x-testo-tree-node-id';
export const TESTO_IMAGE_ASSET_DRAG_MIME = 'application/x-testo-image-asset';

type TestoImageAssetDragPayload = {
  assetUrl: string;
  relativePath: string;
  width: number;
  height: number;
};

export const getImageAssetDragPayload = (dataTransfer: DataTransfer): TestoImageAssetDragPayload | null => {
  const raw = dataTransfer.getData(TESTO_IMAGE_ASSET_DRAG_MIME);
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TestoImageAssetDragPayload>;
    if (
      typeof parsed.assetUrl !== 'string' ||
      typeof parsed.relativePath !== 'string' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return null;
    }
    return {
      assetUrl: parsed.assetUrl,
      relativePath: parsed.relativePath,
      width: parsed.width,
      height: parsed.height,
    };
  } catch {
    return null;
  }
};

export const setTreeNodeDragPayload = (dataTransfer: DataTransfer, nodeId: string): void => {
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(TREE_NODE_DRAG_MIME, nodeId);
  dataTransfer.setData('text/plain', nodeId);
};

export const getTreeNodeDragPayload = (dataTransfer: DataTransfer): string => {
  return dataTransfer.getData(TREE_NODE_DRAG_MIME) || dataTransfer.getData('text/plain');
};

export const setImageAssetDragPayload = (
  dataTransfer: DataTransfer,
  payload: TestoImageAssetDragPayload,
): void => {
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(TESTO_IMAGE_ASSET_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData('text/uri-list', payload.assetUrl);
  dataTransfer.setData('text/plain', payload.assetUrl);
};
