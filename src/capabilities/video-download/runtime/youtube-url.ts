const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/u;

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const isYoutubeHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return youtubeHosts.has(normalized) || normalized.endsWith(".youtube.com");
};

const validVideoId = (value: string | null | undefined): string | null =>
  value && YOUTUBE_VIDEO_ID_PATTERN.test(value) ? value : null;

const pathSegment = (url: URL, marker: string): string | null => {
  const segments = url.pathname.split("/").filter(Boolean);
  const index = segments.indexOf(marker);
  return index >= 0 ? validVideoId(segments[index + 1]) : null;
};

export const extractYoutubeVideoId = (sourcePageUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(sourcePageUrl);
  } catch {
    return null;
  }
  if (!isYoutubeHost(url.hostname)) return null;
  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    return validVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }
  return (
    validVideoId(url.searchParams.get("v")) ??
    pathSegment(url, "shorts") ??
    pathSegment(url, "embed") ??
    pathSegment(url, "v")
  );
};

export const normalizeYoutubeVideoUrl = (sourcePageUrl: string): string | null => {
  const videoId = extractYoutubeVideoId(sourcePageUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
};

export const isYoutubePageUrl = (sourcePageUrl: string): boolean => {
  try {
    return isYoutubeHost(new URL(sourcePageUrl).hostname);
  } catch {
    return false;
  }
};
