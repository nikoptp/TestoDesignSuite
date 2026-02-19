import { nativeImage, protocol } from 'electron';
import { createHash } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectImageAsset, SavedImageAsset } from '../shared/types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];

type AssetPathResolvers = {
  getProjectImageAssetsDir: () => string;
  getProjectRootPath: () => string;
  normalizeRelativePath: (value: string) => string;
};

const isImageFileName = (fileName: string): boolean => {
  const extension = path.extname(fileName).toLowerCase().slice(1);
  return IMAGE_EXTENSIONS.includes(extension);
};

const extensionFromMimeType = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/png') {
    return 'png';
  }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'jpg';
  }
  if (normalized === 'image/gif') {
    return 'gif';
  }
  if (normalized === 'image/webp') {
    return 'webp';
  }
  if (normalized === 'image/bmp') {
    return 'bmp';
  }
  if (normalized === 'image/svg+xml') {
    return 'svg';
  }
  if (normalized === 'image/avif') {
    return 'avif';
  }

  return 'png';
};

export const mimeTypeFromExtension = (extension: string): string => {
  const normalized = extension.toLowerCase();
  if (normalized === '.png') {
    return 'image/png';
  }
  if (normalized === '.jpg' || normalized === '.jpeg') {
    return 'image/jpeg';
  }
  if (normalized === '.gif') {
    return 'image/gif';
  }
  if (normalized === '.webp') {
    return 'image/webp';
  }
  if (normalized === '.bmp') {
    return 'image/bmp';
  }
  if (normalized === '.svg') {
    return 'image/svg+xml';
  }
  if (normalized === '.avif') {
    return 'image/avif';
  }
  return 'application/octet-stream';
};

const toAssetUrl = (relativePath: string, normalizeRelativePath: (value: string) => string): string => {
  const encodedRelativePath = normalizeRelativePath(relativePath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `testo-asset://${encodedRelativePath}`;
};

export const resolveImageAssetPath = (
  relativePath: string,
  { getProjectImageAssetsDir, getProjectRootPath }: Pick<AssetPathResolvers, 'getProjectImageAssetsDir' | 'getProjectRootPath'>,
): string | null => {
  const projectRoot = getProjectRootPath();
  const imageRoot = path.resolve(getProjectImageAssetsDir());
  const absolutePath = path.resolve(projectRoot, relativePath);
  const relativeFromImageRoot = path.relative(imageRoot, absolutePath);
  if (
    !relativeFromImageRoot ||
    relativeFromImageRoot.startsWith('..') ||
    path.isAbsolute(relativeFromImageRoot)
  ) {
    return null;
  }
  return absolutePath;
};

export const registerAssetSchemePrivileges = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'testo-asset',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
};

export const registerAssetProtocol = ({
  getProjectRootPath,
  normalizeRelativePath,
}: Pick<AssetPathResolvers, 'getProjectRootPath' | 'normalizeRelativePath'>): void => {
  protocol.registerFileProtocol('testo-asset', (request, callback) => {
    try {
      const requestedUrl = new URL(request.url);
      const rawRelativePath = `${requestedUrl.hostname}${requestedUrl.pathname}`;
      const decodedRelativePath = decodeURIComponent(rawRelativePath).replace(/^[/\\]+/, '');
      const projectRoot = getProjectRootPath();
      const absolutePath = path.resolve(projectRoot, decodedRelativePath);
      const relativeFromRoot = path.relative(projectRoot, absolutePath);
      if (
        !relativeFromRoot ||
        relativeFromRoot.startsWith('..') ||
        path.isAbsolute(relativeFromRoot)
      ) {
        callback({ error: -10 });
        return;
      }
      const normalized = normalizeRelativePath(relativeFromRoot).toLowerCase();
      if (!normalized.startsWith('project-assets/images/')) {
        callback({ error: -10 });
        return;
      }

      callback({ path: absolutePath });
    } catch {
      callback({ error: -324 });
    }
  });
};

export const saveImageAsset = async (
  input: {
    bytes: Uint8Array;
    mimeType: string;
  },
  {
    getProjectImageAssetsDir,
    getProjectRootPath,
    normalizeRelativePath,
  }: AssetPathResolvers,
  fileExists: (filePath: string) => Promise<boolean>,
): Promise<SavedImageAsset> => {
  if (!input || !(input.bytes instanceof Uint8Array) || input.bytes.length === 0) {
    throw new Error('Invalid image payload.');
  }

  const imageDir = getProjectImageAssetsDir();
  await mkdir(imageDir, { recursive: true });

  const buffer = Buffer.from(input.bytes);
  const hash = createHash('sha256').update(buffer).digest('hex');
  const desiredExt = extensionFromMimeType(input.mimeType);

  let existingFileName: string | null = null;
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = `${hash}.${ext}`;
    const candidatePath = path.join(imageDir, candidate);
    if (await fileExists(candidatePath)) {
      existingFileName = candidate;
      break;
    }
  }

  const fileName = existingFileName ?? `${hash}.${desiredExt}`;
  const absolutePath = path.join(imageDir, fileName);

  if (!existingFileName) {
    try {
      await writeFile(absolutePath, buffer, { flag: 'wx' });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code !== 'EEXIST'
      ) {
        throw error;
      }
    }
  }

  const relativePath = normalizeRelativePath(path.relative(getProjectRootPath(), absolutePath));

  return {
    absolutePath,
    relativePath,
    assetUrl: toAssetUrl(relativePath, normalizeRelativePath),
    fileUrl: pathToFileURL(absolutePath).toString(),
    deduplicated: Boolean(existingFileName),
  };
};

export const listImageAssets = async ({
  getProjectImageAssetsDir,
  getProjectRootPath,
  normalizeRelativePath,
}: AssetPathResolvers): Promise<ProjectImageAsset[]> => {
  const imageDir = getProjectImageAssetsDir();
  await mkdir(imageDir, { recursive: true });
  const entries = await readdir(imageDir, { withFileTypes: true });
  const assets: ProjectImageAsset[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isImageFileName(entry.name)) {
      continue;
    }

    const absolutePath = path.join(imageDir, entry.name);
    const metadata = await stat(absolutePath);
    const relativePath = normalizeRelativePath(path.relative(getProjectRootPath(), absolutePath));
    const image = nativeImage.createFromPath(absolutePath);
    const size = image.getSize();

    assets.push({
      absolutePath,
      relativePath,
      assetUrl: toAssetUrl(relativePath, normalizeRelativePath),
      fileUrl: pathToFileURL(absolutePath).toString(),
      width: Math.max(1, size.width || 1),
      height: Math.max(1, size.height || 1),
      sizeBytes: metadata.size,
      updatedAt: metadata.mtimeMs,
    });
  }

  assets.sort((a, b) => b.updatedAt - a.updatedAt);
  return assets;
};

export const deleteImageAsset = async (
  relativePath: string,
  {
    getProjectImageAssetsDir,
    getProjectRootPath,
    normalizeRelativePath,
  }: AssetPathResolvers,
): Promise<void> => {
  const normalized = normalizeRelativePath(relativePath).replace(/^[/\\]+/, '');
  if (!normalized || !normalized.toLowerCase().startsWith('project-assets/images/')) {
    throw new Error('Invalid image asset path.');
  }

  const absolutePath = resolveImageAssetPath(normalized, {
    getProjectImageAssetsDir,
    getProjectRootPath,
  });
  if (!absolutePath) {
    throw new Error('Invalid image asset path.');
  }

  try {
    await unlink(absolutePath);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
};
