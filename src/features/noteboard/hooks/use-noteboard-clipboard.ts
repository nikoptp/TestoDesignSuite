import React from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { PersistedTreeState, UserSettings } from '../../../shared/types';
import { buildLinkPreviews } from '../../../renderer/noteboard-link-preview';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  clampCardToWorld,
  createNoteboardCard,
} from '../../../renderer/noteboard-utils';
import { worldPointAtCanvasCenter } from '../../../shared/noteboard-coordinate-utils';
import {
  type AppClipboard,
  type DroppedCanvasPayload,
  type UiState,
  CARD_MAX_HEIGHT,
  CARD_MAX_WIDTH,
  ensureNoteboardData,
  estimateCardDimensionsFromText,
  firstImageUrlFromHtml,
  firstUrlFromText,
  firstUrlFromUriList,
  fitImageDimensionsToCardBounds,
  getCardsForNode,
  getThemeCardColor,
  getViewForNode,
  normalizeClipboardText,
  parseDroppedTestoImageAsset,
} from '../../app/app-model';
import { updateNodeNoteboardData } from '../../app/workspace-node-updaters';

type UseNoteboardClipboardOptions = {
  canvasRef: React.RefObject<HTMLDivElement>;
  stateRef: MutableRefObject<PersistedTreeState>;
  settingsRef: MutableRefObject<UserSettings>;
  clipboardRef: MutableRefObject<AppClipboard>;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  setUiState: Dispatch<SetStateAction<UiState>>;
  pushHistory: () => void;
  refreshImageAssets: () => Promise<void>;
};

type UseNoteboardClipboardResult = {
  getCanvasCenterWorldPoint: (nodeId: string) => { x: number; y: number } | null;
  extractImageBlobFromClipboardData: (clipboardData: DataTransfer | null) => Blob | null;
  createTextCardAtWorldPoint: (
    nodeId: string,
    worldX: number,
    worldY: number,
    text: string,
    options?: { preferredSize?: { width: number; height: number } },
  ) => boolean;
  createImageCardAtWorldPoint: (
    nodeId: string,
    worldX: number,
    worldY: number,
    blob: Blob,
  ) => Promise<boolean>;
  pasteCopiedCardsAtCanvasCenter: (nodeId: string) => boolean;
  pasteSystemClipboardAtPoint: (nodeId: string, worldX: number, worldY: number) => Promise<boolean>;
  handleCanvasDrop: (
    nodeId: string,
    worldX: number,
    worldY: number,
    payload: DroppedCanvasPayload,
  ) => Promise<void>;
};

export const useNoteboardClipboard = ({
  canvasRef,
  stateRef,
  settingsRef,
  clipboardRef,
  setState,
  setUiState,
  pushHistory,
  refreshImageAssets,
}: UseNoteboardClipboardOptions): UseNoteboardClipboardResult => {
  const getCanvasCenterWorldPoint = React.useCallback(
    (nodeId: string): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }
      const view = getViewForNode(stateRef.current, nodeId);
      return worldPointAtCanvasCenter(canvas, view);
    },
    [canvasRef, stateRef],
  );

  const readClipboardText = React.useCallback(async (): Promise<string | null> => {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return null;
    }

    try {
      const text = await navigator.clipboard.readText();
      const normalized = normalizeClipboardText(text);
      return normalized || null;
    } catch {
      return null;
    }
  }, []);

  const readClipboardImage = React.useCallback(async (): Promise<Blob | null> => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      return null;
    }

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.toLowerCase().startsWith('image/'));
        if (!imageType) {
          continue;
        }
        return await item.getType(imageType);
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const extractImageBlobFromClipboardData = React.useCallback(
    (clipboardData: DataTransfer | null): Blob | null => {
      if (!clipboardData) {
        return null;
      }

      for (const item of Array.from(clipboardData.items)) {
        if (item.kind !== 'file' || !item.type.toLowerCase().startsWith('image/')) {
          continue;
        }
        const file = item.getAsFile();
        if (file) {
          return file;
        }
      }

      return null;
    },
    [],
  );

  const fetchImageBlobFromUrl = React.useCallback(async (url: string): Promise<Blob | null> => {
    const source = url.trim();
    if (!source || !/^(https?:\/\/|data:image\/)/i.test(source)) {
      return null;
    }

    try {
      const response = await fetch(source, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      });
      if (!response.ok) {
        return null;
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.startsWith('image/')) {
        return null;
      }
      return await response.blob();
    } catch {
      return null;
    }
  }, []);

  const extractImageBlobFromDroppedPayload = React.useCallback(
    async (payload: DroppedCanvasPayload): Promise<Blob | null> => {
      const droppedFile = payload.files.find((file) => file.type.toLowerCase().startsWith('image/'));
      if (droppedFile) {
        return droppedFile;
      }

      const imageUrlCandidate =
        firstImageUrlFromHtml(payload.textHtml) ??
        firstUrlFromUriList(payload.textUriList) ??
        firstUrlFromText(payload.textPlain);

      if (!imageUrlCandidate) {
        return null;
      }

      return fetchImageBlobFromUrl(imageUrlCandidate);
    },
    [fetchImageBlobFromUrl],
  );

  const createTextCardAtWorldPoint = React.useCallback(
    (
      nodeId: string,
      worldX: number,
      worldY: number,
      text: string,
      options?: {
        preferredSize?: { width: number; height: number };
      },
    ): boolean => {
      const normalized = normalizeClipboardText(text);
      if (!normalized) {
        return false;
      }

      const size = estimateCardDimensionsFromText(normalized);
      if (options?.preferredSize) {
        size.width = Math.max(
          CARD_MIN_WIDTH,
          Math.min(CARD_MAX_WIDTH, Math.round(options.preferredSize.width)),
        );
        size.height = Math.max(
          CARD_MIN_HEIGHT,
          Math.min(CARD_MAX_HEIGHT, Math.round(options.preferredSize.height)),
        );
      }
      if (buildLinkPreviews(normalized, 1).length > 0) {
        size.width = Math.max(size.width, 300);
        size.height = Math.max(size.height, 240);
      }
      const pos = clampCardToWorld(
        worldX - size.width / 2,
        worldY - Math.min(40, size.height / 2),
        size.width,
        size.height,
      );
      const created = createNoteboardCard(pos.x, pos.y);
      created.text = normalized;
      created.width = size.width;
      created.height = size.height;
      created.color = getThemeCardColor(settingsRef.current.theme);

      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [created, ...getCardsForNode(next, nodeId)];
        return updateNodeNoteboardData(next, nodeId, (noteboard) => ({
          ...noteboard,
          cards,
          view: { ...getViewForNode(next, nodeId) },
        }));
      });

      setUiState((prev) => ({
        ...prev,
        contextMenu: null,
        selectionBox: null,
        cardSelection: {
          nodeId,
          cardIds: [created.id],
        },
      }));

      return true;
    },
    [pushHistory, setState, setUiState, settingsRef],
  );

  const createImageCardAtWorldPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number, blob: Blob): Promise<boolean> => {
      if (!window.testoApi?.saveImageAsset) {
        return false;
      }

      const buffer = new Uint8Array(await blob.arrayBuffer());
      if (buffer.length === 0) {
        return false;
      }

      const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/png';
      let saved;
      try {
        saved = await window.testoApi.saveImageAsset({
          bytes: buffer,
          mimeType,
        });
      } catch {
        return false;
      }
      void refreshImageAssets();

      let imageSize: { width: number; height: number } | undefined;
      try {
        const bitmap = await createImageBitmap(blob);
        imageSize = fitImageDimensionsToCardBounds(bitmap.width, bitmap.height);
        bitmap.close();
      } catch {
        imageSize = undefined;
      }

      const markdown = `![Pasted image](${saved.assetUrl})\n\n[Open image file](${saved.assetUrl})`;
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, markdown, {
        preferredSize: imageSize,
      });
    },
    [createTextCardAtWorldPoint, refreshImageAssets],
  );

  const createImageCardFromAssetUrlAtWorldPoint = React.useCallback(
    (
      nodeId: string,
      worldX: number,
      worldY: number,
      assetUrl: string,
      dimensions?: { width?: number; height?: number },
    ): boolean => {
      const safeAssetUrl = assetUrl.trim();
      if (!safeAssetUrl) {
        return false;
      }

      const preferredSize =
        typeof dimensions?.width === 'number' &&
        typeof dimensions?.height === 'number' &&
        dimensions.width > 0 &&
        dimensions.height > 0
          ? fitImageDimensionsToCardBounds(dimensions.width, dimensions.height)
          : undefined;
      const markdown = `![Pasted image](${safeAssetUrl})\n\n[Open image file](${safeAssetUrl})`;
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, markdown, {
        preferredSize,
      });
    },
    [createTextCardAtWorldPoint],
  );

  const pasteCopiedCardsAtCanvasCenter = React.useCallback(
    (nodeId: string): boolean => {
      if (clipboardRef.current?.kind !== 'noteboard-cards') {
        return false;
      }

      pushHistory();
      setState((prev) => {
        const next = ensureNoteboardData(prev, nodeId);
        const cards = [...getCardsForNode(next, nodeId)];
        const view = getViewForNode(next, nodeId);
        const canvas = canvasRef.current;
        let anchorX = 0;
        let anchorY = 0;

        if (canvas) {
          const anchor = worldPointAtCanvasCenter(canvas, view);
          anchorX = anchor.x;
          anchorY = anchor.y;
        }

        const newIds: string[] = [];
        clipboardRef.current?.cards.forEach((item) => {
          const pos = clampCardToWorld(anchorX + item.dx, anchorY + item.dy, item.width, item.height);
          const created = createNoteboardCard(pos.x, pos.y);
          created.text = item.text;
          created.color = item.color;
          created.width = item.width;
          created.height = item.height;
          cards.unshift(created);
          newIds.push(created.id);
        });

        setUiState((prevUi) => ({
          ...prevUi,
          cardSelection: {
            nodeId,
            cardIds: newIds,
          },
        }));

        return {
          ...updateNodeNoteboardData(next, nodeId, (noteboard) => ({
            ...noteboard,
            cards,
            view: { ...view },
          })),
        };
      });

      return true;
    },
    [canvasRef, clipboardRef, pushHistory, setState, setUiState],
  );

  const pasteClipboardTextAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      const text = await readClipboardText();
      if (!text) {
        return false;
      }
      return createTextCardAtWorldPoint(nodeId, worldX, worldY, text);
    },
    [createTextCardAtWorldPoint, readClipboardText],
  );

  const pasteClipboardImageAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      const image = await readClipboardImage();
      if (!image) {
        return false;
      }
      return createImageCardAtWorldPoint(nodeId, worldX, worldY, image);
    },
    [createImageCardAtWorldPoint, readClipboardImage],
  );

  const pasteSystemClipboardAtPoint = React.useCallback(
    async (nodeId: string, worldX: number, worldY: number): Promise<boolean> => {
      if (await pasteClipboardImageAtPoint(nodeId, worldX, worldY)) {
        return true;
      }
      return pasteClipboardTextAtPoint(nodeId, worldX, worldY);
    },
    [pasteClipboardImageAtPoint, pasteClipboardTextAtPoint],
  );

  const handleCanvasDrop = React.useCallback(
    async (
      nodeId: string,
      worldX: number,
      worldY: number,
      payload: DroppedCanvasPayload,
    ): Promise<void> => {
      const droppedAsset = parseDroppedTestoImageAsset(payload.testoImageAsset);
      if (droppedAsset) {
        createImageCardFromAssetUrlAtWorldPoint(nodeId, worldX, worldY, droppedAsset.assetUrl, {
          width: droppedAsset.width,
          height: droppedAsset.height,
        });
        return;
      }

      const droppedImage = await extractImageBlobFromDroppedPayload(payload);
      if (droppedImage) {
        await createImageCardAtWorldPoint(nodeId, worldX, worldY, droppedImage);
        return;
      }

      const fallbackText = normalizeClipboardText(payload.textPlain || payload.textUriList || payload.textHtml);
      if (fallbackText) {
        createTextCardAtWorldPoint(nodeId, worldX, worldY, fallbackText);
      }
    },
    [
      createImageCardAtWorldPoint,
      createImageCardFromAssetUrlAtWorldPoint,
      createTextCardAtWorldPoint,
      extractImageBlobFromDroppedPayload,
    ],
  );

  return {
    getCanvasCenterWorldPoint,
    extractImageBlobFromClipboardData,
    createTextCardAtWorldPoint,
    createImageCardAtWorldPoint,
    pasteCopiedCardsAtCanvasCenter,
    pasteSystemClipboardAtPoint,
    handleCanvasDrop,
  };
};
