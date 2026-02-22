export const TREE_NODE_DRAG_MIME = 'application/x-testo-tree-node-id';
export const TESTO_IMAGE_ASSET_DRAG_MIME = 'application/x-testo-image-asset';

type TestoImageAssetDragPayload = {
  assetUrl: string;
  relativePath: string;
  width: number;
  height: number;
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
