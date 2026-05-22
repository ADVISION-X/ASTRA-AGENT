export const buildTelegramWebCacheProbeScript = (maxBytes: number): string => `
(async () => {
  const MAX_BYTES = ${JSON.stringify(maxBytes)};
  const CACHE_NAME = "tt-media-progressive";

  const failure = (failureReason, reason, status = "failed") => ({
    ok: false,
    status,
    failureReason,
    reason,
  });

  if (location.hostname !== "web.telegram.org") {
    return failure("source_page_mismatch", "Telegram Web download requires an active web.telegram.org page.", "invalid_input");
  }
  if (!("caches" in window)) {
    return failure("candidate_not_found", "CacheStorage is not available on this Telegram Web page.", "review_required");
  }

  const parseRange = (contentRange) => {
    const matched = /^bytes\\s+(\\d+)-(\\d+)\\/(\\d+)$/iu.exec(contentRange || "");
    if (!matched) return null;
    return {
      start: Number.parseInt(matched[1], 10),
      end: Number.parseInt(matched[2], 10),
      total: Number.parseInt(matched[3], 10),
    };
  };

  const toBase64 = (bytes) => {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return btoa(binary);
  };

  const documentIdFromUrl = (url) => {
    const matched = /\\/document(\\d+)/u.exec(url);
    return matched ? matched[1] : null;
  };

  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const groups = new Map();

  for (const request of requests) {
    const requestUrl = request.url;
    if (!requestUrl.includes("/progressive/") && !requestUrl.includes("/download/")) continue;
    const documentId = documentIdFromUrl(requestUrl);
    if (!documentId) continue;
    const response = await cache.match(request);
    if (!response) continue;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("video/")) continue;
    const range = parseRange(response.headers.get("content-range"));
    if (!range) continue;
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    const entry = {
      start: range.start,
      end: range.end,
      total: range.total,
      byteLength: bytes.length,
      contentType,
      bytes,
    };
    const existing = groups.get(documentId) || [];
    existing.push(entry);
    groups.set(documentId, existing);
  }

  let sawPartial = false;
  for (const [documentId, entries] of groups) {
    entries.sort((left, right) => left.start - right.start);
    const total = entries[0]?.total || 0;
    if (total <= 0) continue;
    if (total > MAX_BYTES) {
      return failure("download_too_large", "Telegram Web cached media exceeds maxBytes.", "review_required");
    }
    let cursor = 0;
    let byteSize = 0;
    const ranges = [];
    for (const entry of entries) {
      if (entry.start !== cursor) {
        sawPartial = true;
        break;
      }
      cursor = entry.end + 1;
      byteSize += entry.byteLength;
      ranges.push({
        start: entry.start,
        end: entry.end,
        byteLength: entry.byteLength,
        total: entry.total,
      });
    }
    if (cursor !== total || byteSize !== total) {
      sawPartial = true;
      continue;
    }
    const bytes = new Uint8Array(total);
    for (const entry of entries) {
      bytes.set(entry.bytes, entry.start);
    }
    return {
      ok: true,
      status: "success",
      candidateKind: "telegram_sw_progressive_cache",
      documentId,
      contentType: entries[0]?.contentType || "video/mp4",
      byteSize,
      ranges,
      bytesBase64: toBase64(bytes),
    };
  }

  if (sawPartial || groups.size > 0) {
    return failure("candidate_not_found", "Telegram Web media cache exists but does not cover one complete contiguous video.", "review_required");
  }
  return failure("candidate_not_found", "No Telegram Web video media cache entries were found.", "review_required");
})()
`;
