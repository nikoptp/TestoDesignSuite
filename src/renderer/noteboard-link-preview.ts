export type NoteboardLinkPreview =
  | {
      kind: 'image';
      url: string;
      imageUrl: string;
    }
  | {
      kind: 'youtube';
      url: string;
      embedUrl: string;
    };

const URL_MATCHER = /https?:\/\/[^\s<>"'`]+/gi;
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
]);

const trimUrlToken = (input: string): string => input.replace(/[),.;!?]+$/g, '');

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const getYouTubeVideoId = (url: URL): string | null => {
  const host = url.hostname.toLowerCase();
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const shortId = pathParts[0];
    return shortId && /^[a-z0-9_-]{6,}$/i.test(shortId) ? shortId : null;
  }

  if (!host.endsWith('youtube.com')) {
    return null;
  }

  if (url.pathname === '/watch') {
    const watchId = url.searchParams.get('v');
    return watchId && /^[a-z0-9_-]{6,}$/i.test(watchId) ? watchId : null;
  }

  if (pathParts[0] === 'shorts' || pathParts[0] === 'embed') {
    const id = pathParts[1];
    return id && /^[a-z0-9_-]{6,}$/i.test(id) ? id : null;
  }

  return null;
};

const isImageUrl = (url: URL): boolean => {
  const pathname = url.pathname.toLowerCase();
  return [...IMAGE_EXTENSIONS].some((extension) => pathname.endsWith(extension));
};

export const extractUrlsFromText = (text: string, max = 8): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();
  const matches = text.match(URL_MATCHER) ?? [];

  for (const token of matches) {
    const normalized = trimUrlToken(token);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= max) {
      break;
    }
  }

  return urls;
};

export const buildLinkPreviews = (
  text: string,
  max = 3,
): NoteboardLinkPreview[] => {
  const urls = extractUrlsFromText(text, max * 2);
  const previews: NoteboardLinkPreview[] = [];

  for (const rawUrl of urls) {
    const parsed = parseUrl(rawUrl);
    if (!parsed) {
      continue;
    }

    const youtubeId = getYouTubeVideoId(parsed);
    if (youtubeId) {
      previews.push({
        kind: 'youtube',
        url: rawUrl,
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      });
    } else if (isImageUrl(parsed)) {
      previews.push({
        kind: 'image',
        url: rawUrl,
        imageUrl: rawUrl,
      });
    }

    if (previews.length >= max) {
      break;
    }
  }

  return previews;
};
