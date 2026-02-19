import path from 'node:path';

export const PRIMARY_PROJECT_EXTENSION = 'prjt';
export const LEGACY_PROJECT_EXTENSION = 'testo';
const PROJECT_FILE_EXTENSIONS = new Set([PRIMARY_PROJECT_EXTENSION, LEGACY_PROJECT_EXTENSION]);

export const normalizeProjectFilePathCandidate = (value: string): string | null => {
  const trimmed = value.trim().replace(/^"+|"+$/g, '');
  if (!trimmed || trimmed.startsWith('-')) {
    return null;
  }

  const extension = path.extname(trimmed).toLowerCase().slice(1);
  if (!PROJECT_FILE_EXTENSIONS.has(extension)) {
    return null;
  }

  return path.resolve(trimmed);
};

export const extractProjectFilePathFromArgv = (argv: string[]): string | null => {
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeProjectFilePathCandidate(argv[index]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};
