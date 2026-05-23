const TELEGRAM_WEB_VISIBLE_MEDIA_PROBE_SCRIPT = `
(async () => {
  const failure = (failureReason, reason, status = "review_required") => ({
    ok: false,
    status,
    failureReason,
    reason,
    candidates: [],
  });

  if (location.hostname !== "web.telegram.org") {
    return failure("source_page_mismatch", "Telegram Web media list requires an active web.telegram.org page.", "invalid_input");
  }

  const hashText = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
  };

  const documentIdFromUrl = (url) => {
    const matched = /\\/document(\\d+)/u.exec(url || "");
    return matched ? matched[1] : null;
  };

  const redactedPathPrefix = (url) => {
    try {
      const parsed = new URL(url, location.href);
      return parsed.pathname.split("/").slice(0, 4).join("/");
    } catch {
      return "";
    }
  };

  const readRect = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };

  const readCacheCoverage = async (documentId, maxBytes) => {
    if (!("caches" in window)) {
      return { cacheStorageAvailable: false, complete: false, byteSize: null, rangeCount: 0 };
    }
    const chunkSize = 524288;
    const maxProbeEnd = Math.min(maxBytes, 10 * 1024 * 1024);
    const parseRange = (contentRange) => {
      const matched = /^bytes\\s+(\\d+)-(\\d+)\\/(\\d+)$/iu.exec(contentRange || "");
      if (!matched) return null;
      return {
        start: Number.parseInt(matched[1], 10),
        end: Number.parseInt(matched[2], 10),
        total: Number.parseInt(matched[3], 10),
      };
    };
    const cache = await caches.open("tt-media-progressive");
    const ranges = [];
    for (let start = 0; start < maxProbeEnd; start += chunkSize) {
      const requestedEnd = start + chunkSize - 1;
      const baseUrl = new URL("/a/progressive/document" + documentId, location.origin);
      baseUrl.searchParams.set("start", String(start));
      baseUrl.searchParams.set("end", String(requestedEnd));
      const partResponse = await cache.match(baseUrl.href + "&type=arrayBuffer");
      const headersResponse = await cache.match(baseUrl.href + "&type=headers");
      if (!partResponse || !headersResponse) break;
      const headers = await headersResponse.clone().json();
      const getHeader = (name) => {
        const pair = Array.isArray(headers) ? headers.find((item) => String(item[0]).toLowerCase() === name) : null;
        return pair ? String(pair[1]) : "";
      };
      if (!getHeader("content-type").toLowerCase().startsWith("video/")) break;
      const range = parseRange(getHeader("content-range"));
      if (!range) break;
      const bytes = new Uint8Array(await partResponse.clone().arrayBuffer());
      ranges.push({ start: range.start, end: range.end, total: range.total, byteLength: bytes.length });
      if (range.end + 1 >= range.total) break;
    }
    if (ranges.length === 0) {
      return { cacheStorageAvailable: true, complete: false, byteSize: null, rangeCount: 0 };
    }
    ranges.sort((left, right) => left.start - right.start);
    const total = ranges[0].total;
    let cursor = 0;
    let byteSize = 0;
    for (const range of ranges) {
      if (range.start !== cursor) {
        return { cacheStorageAvailable: true, complete: false, byteSize: total, rangeCount: ranges.length };
      }
      cursor = range.end + 1;
      byteSize += range.byteLength;
    }
    return {
      cacheStorageAvailable: true,
      complete: cursor === total && byteSize === total,
      byteSize: total,
      rangeCount: ranges.length,
    };
  };

  const candidates = [];
  const seen = new Set();
  for (const video of Array.from(document.querySelectorAll("video"))) {
    const src = video.currentSrc || video.getAttribute("src") || "";
    const documentId = documentIdFromUrl(src);
    if (!documentId || seen.has(documentId)) continue;
    seen.add(documentId);
    const durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
    const documentIdHash = await hashText(documentId);
    const cacheCoverage = await readCacheCoverage(documentId, 500000000);
    candidates.push({
      documentIdHash,
      sourceKind: "visible_progressive_video",
      redactedPathPrefix: redactedPathPrefix(src),
      durationMs: durationSeconds === null ? null : Math.round(durationSeconds * 1000),
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      readyState: video.readyState,
      visible: (() => {
        const style = getComputedStyle(video);
        const rect = video.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })(),
      viewportRect: readRect(video),
      cacheStorageAvailable: cacheCoverage.cacheStorageAvailable,
      cacheComplete: cacheCoverage.complete,
      cachedByteSize: cacheCoverage.byteSize,
      cacheRangeCount: cacheCoverage.rangeCount,
    });
  }

  candidates.sort((left, right) => {
    if (left.cacheComplete !== right.cacheComplete) return left.cacheComplete ? -1 : 1;
    return (right.durationMs || 0) - (left.durationMs || 0);
  });

  return {
    ok: true,
    status: "success",
    sourcePageUrl: location.href,
    candidateCount: candidates.length,
    candidates,
  };
})()
`;

export const buildTelegramWebVisibleMediaProbeScript = (): string =>
  TELEGRAM_WEB_VISIBLE_MEDIA_PROBE_SCRIPT;
