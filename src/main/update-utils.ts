export type ReleaseLookupResult = {
  repo: string;
  latestVersion: string;
  latestTag: string;
  downloadUrl: string;
  assets: ReleaseAsset[];
};

export type ReleaseAsset = {
  name: string;
  downloadUrl: string;
};

type GithubReleasePayload = {
  tag_name?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

const toReleaseAsset = (value: unknown): ReleaseAsset | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as {
    name?: unknown;
    browser_download_url?: unknown;
  };
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return null;
  }
  if (
    typeof candidate.browser_download_url !== 'string' ||
    !candidate.browser_download_url.trim()
  ) {
    return null;
  }
  return {
    name: candidate.name.trim(),
    downloadUrl: candidate.browser_download_url.trim(),
  };
};

const normalizeAssetName = (name: string): string => name.trim().toLowerCase();

const isWindowsInstallerAssetName = (name: string): boolean => {
  const normalized = normalizeAssetName(name);
  if (!normalized.endsWith('.exe')) {
    return false;
  }
  if (normalized.includes('setup')) {
    return false;
  }
  return true;
};

const isChecksumAssetNameForInstaller = (assetName: string, installerName: string): boolean => {
  const normalizedAsset = normalizeAssetName(assetName);
  const normalizedInstaller = normalizeAssetName(installerName);
  return (
    normalizedAsset === `${normalizedInstaller}.sha256` ||
    normalizedAsset === `${normalizedInstaller}.sha256.txt`
  );
};

export const normalizeVersionTag = (value: string): string =>
  value.trim().replace(/^v/i, '').split('-')[0];

export const compareVersions = (left: string, right: string): number => {
  const leftParts = normalizeVersionTag(left)
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  const rightParts = normalizeVersionTag(right)
    .split('.')
    .map((part) => Number.parseInt(part, 10));

  const maxParts = Math.max(leftParts.length, rightParts.length);
  for (let i = 0; i < maxParts; i += 1) {
    const l = Number.isFinite(leftParts[i]) ? leftParts[i] : 0;
    const r = Number.isFinite(rightParts[i]) ? rightParts[i] : 0;
    if (l > r) {
      return 1;
    }
    if (l < r) {
      return -1;
    }
  }

  return 0;
};

export const parseChecksumManifest = (value: string): string | null => {
  const [firstLine] = value.split(/\r?\n/, 1);
  if (!firstLine) {
    return null;
  }
  const match = firstLine.trim().match(/^([A-Fa-f0-9]{64})(?:\s|$)/);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase();
};

export const pickWindowsInstallerAsset = (assets: ReleaseAsset[]): ReleaseAsset | null => {
  for (const asset of assets) {
    if (isWindowsInstallerAssetName(asset.name)) {
      return asset;
    }
  }
  return null;
};

export const pickChecksumAssetForInstaller = (
  assets: ReleaseAsset[],
  installerAsset: ReleaseAsset,
): ReleaseAsset | null => {
  for (const asset of assets) {
    if (isChecksumAssetNameForInstaller(asset.name, installerAsset.name)) {
      return asset;
    }
  }
  return null;
};

export const fetchLatestGithubRelease = async (
  repo: string,
  userAgent: string,
): Promise<ReleaseLookupResult> => {
  const endpoint = `https://api.github.com/repos/${repo}/releases/latest`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub releases request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GithubReleasePayload;
  if (typeof payload.tag_name !== 'string' || !payload.tag_name.trim()) {
    throw new Error('Latest GitHub release is missing tag_name.');
  }

  const latestVersion = normalizeVersionTag(payload.tag_name);
  if (!latestVersion) {
    throw new Error('Latest GitHub release tag is invalid.');
  }

  const downloadUrl =
    typeof payload.html_url === 'string' && payload.html_url.trim()
      ? payload.html_url
      : `https://github.com/${repo}/releases/latest`;
  const assets = Array.isArray(payload.assets)
    ? payload.assets.map((asset) => toReleaseAsset(asset)).filter((asset): asset is ReleaseAsset => asset !== null)
    : [];

  return {
    repo,
    latestVersion,
    latestTag: payload.tag_name.trim(),
    downloadUrl: downloadUrl.trim(),
    assets,
  };
};
