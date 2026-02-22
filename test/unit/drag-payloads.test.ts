import { describe, expect, it } from 'vitest';
import {
  getTreeNodeDragPayload,
  setImageAssetDragPayload,
  setTreeNodeDragPayload,
  TESTO_IMAGE_ASSET_DRAG_MIME,
  TREE_NODE_DRAG_MIME,
} from '../../src/shared/drag-payloads';

type DataTransferStub = {
  effectAllowed: string;
  setData: (type: string, value: string) => void;
  getData: (type: string) => string;
};

const createDataTransferStub = (): DataTransferStub => {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'all',
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? '',
  };
};

describe('drag payload helpers', () => {
  it('writes and reads tree node drag payload', () => {
    const dataTransfer = createDataTransferStub();
    setTreeNodeDragPayload(dataTransfer as unknown as DataTransfer, 'node-123');

    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.getData(TREE_NODE_DRAG_MIME)).toBe('node-123');
    expect(getTreeNodeDragPayload(dataTransfer as unknown as DataTransfer)).toBe('node-123');
  });

  it('writes image asset payload with common text fallbacks', () => {
    const dataTransfer = createDataTransferStub();
    setImageAssetDragPayload(dataTransfer as unknown as DataTransfer, {
      assetUrl: 'asset://images/hero.png',
      relativePath: 'images/hero.png',
      width: 200,
      height: 100,
    });

    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.getData(TESTO_IMAGE_ASSET_DRAG_MIME)).toContain('images/hero.png');
    expect(dataTransfer.getData('text/uri-list')).toBe('asset://images/hero.png');
    expect(dataTransfer.getData('text/plain')).toBe('asset://images/hero.png');
  });
});
