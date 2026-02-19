export type ReleaseLookupResult = {
  repo: string;
  latestVersion: string;
  latestTag: string;
  downloadUrl: string;
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

  const payload = (await response.json()) as {
    tag_name?: unknown;
    html_url?: unknown;
  };
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

  return {
    repo,
    latestVersion,
    latestTag: payload.tag_name.trim(),
    downloadUrl: downloadUrl.trim(),
  };
};
