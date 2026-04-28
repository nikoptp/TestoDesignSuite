import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DocsReadResult, DocsWriteRequest, ProjectDocFileEntry, DocsRenameRequest } from '../shared/types';

const DOCS_ROOT_DIR = 'docs';
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

const hasMarkdownExtension = (filePath: string): boolean =>
  MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const normalizeRelativePath = (value: string): string => value.replace(/\\/g, '/');

const computeHash = (content: string): string => createHash('sha256').update(content).digest('hex');

const resolveDocsFilePath = (projectRootPath: string, relativePath: string): string => {
  const trimmed = relativePath.trim();
  if (!trimmed) {
    throw new Error('Document path is required.');
  }
  const docsRoot = path.resolve(projectRootPath, DOCS_ROOT_DIR);
  const candidate = path.resolve(docsRoot, trimmed);
  const relativeFromDocsRoot = path.relative(docsRoot, candidate);
  if (
    !relativeFromDocsRoot ||
    relativeFromDocsRoot.startsWith('..') ||
    path.isAbsolute(relativeFromDocsRoot)
  ) {
    throw new Error('Document path must stay inside docs/.');
  }
  if (!hasMarkdownExtension(candidate)) {
    throw new Error('Only markdown files are supported (.md, .markdown).');
  }
  return candidate;
};

const ensureExpectedHash = async (absolutePath: string, expectedHash?: string): Promise<void> => {
  if (typeof expectedHash !== 'string') {
    return;
  }
  const existing = await readFile(absolutePath, 'utf8').catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT') {
        throw new Error('Document does not exist for expectedHash check.');
      }
    }
    throw error;
  });
  const existingHash = computeHash(existing);
  if (existingHash !== expectedHash) {
    throw new Error('Document content changed. Refresh and retry.');
  }
};

export const listProjectDocs = async (getProjectRootPath: () => string): Promise<ProjectDocFileEntry[]> => {
  const projectRoot = getProjectRootPath();
  const docsRoot = path.resolve(projectRoot, DOCS_ROOT_DIR);
  await mkdir(docsRoot, { recursive: true });

  const output: ProjectDocFileEntry[] = [];
  const queue = [docsRoot];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !hasMarkdownExtension(absolutePath)) {
        continue;
      }
      const metadata = await stat(absolutePath);
      const relativePath = normalizeRelativePath(path.relative(projectRoot, absolutePath));
      output.push({
        relativePath,
        name: entry.name,
        directory: normalizeRelativePath(path.dirname(relativePath)),
        sizeBytes: metadata.size,
        updatedAt: metadata.mtimeMs,
      });
    }
  }

  output.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return output;
};

export const readProjectDoc = async (
  relativePath: string,
  getProjectRootPath: () => string,
): Promise<DocsReadResult> => {
  const projectRoot = getProjectRootPath();
  const absolutePath = resolveDocsFilePath(projectRoot, relativePath);
  const [content, metadata] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)]);
  const resolvedRelativePath = normalizeRelativePath(path.relative(projectRoot, absolutePath));
  return {
    relativePath: resolvedRelativePath,
    content,
    updatedAt: metadata.mtimeMs,
    hash: computeHash(content),
  };
};

export const writeProjectDoc = async (
  request: DocsWriteRequest,
  getProjectRootPath: () => string,
): Promise<DocsReadResult> => {
  const projectRoot = getProjectRootPath();
  const absolutePath = resolveDocsFilePath(projectRoot, request.relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await ensureExpectedHash(absolutePath, request.expectedHash);
  await writeFile(absolutePath, request.content, 'utf8');
  return readProjectDoc(request.relativePath, getProjectRootPath);
};

export const createProjectDoc = async (
  request: Omit<DocsWriteRequest, 'expectedHash'>,
  getProjectRootPath: () => string,
): Promise<DocsReadResult> => {
  const projectRoot = getProjectRootPath();
  const absolutePath = resolveDocsFilePath(projectRoot, request.relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const exists = await stat(absolutePath)
    .then(() => true)
    .catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        return (error as { code?: string }).code !== 'ENOENT';
      }
      throw error;
    });
  if (exists) {
    throw new Error('Document already exists.');
  }
  await writeFile(absolutePath, request.content, 'utf8');
  return readProjectDoc(request.relativePath, getProjectRootPath);
};

export const renameProjectDoc = async (
  request: DocsRenameRequest,
  getProjectRootPath: () => string,
): Promise<{ relativePath: string }> => {
  const projectRoot = getProjectRootPath();
  const fromAbsolutePath = resolveDocsFilePath(projectRoot, request.fromRelativePath);
  const toAbsolutePath = resolveDocsFilePath(projectRoot, request.toRelativePath);
  await mkdir(path.dirname(toAbsolutePath), { recursive: true });
  await rename(fromAbsolutePath, toAbsolutePath);
  return {
    relativePath: normalizeRelativePath(path.relative(projectRoot, toAbsolutePath)),
  };
};

export const deleteProjectDoc = async (
  relativePath: string,
  getProjectRootPath: () => string,
): Promise<void> => {
  const projectRoot = getProjectRootPath();
  const absolutePath = resolveDocsFilePath(projectRoot, relativePath);
  await rm(absolutePath, { force: true });
};
