const TELEGRAM_WEB_CACHE_PROBE_SCRIPT_TEMPLATE = `
(async () => {
  const MAX_BYTES = __MAX_BYTES__;
  const TARGET_DOCUMENT_ID_HASH = __TARGET_DOCUMENT_ID_HASH__;
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

  const hashText = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
  };

  const cache = await caches.open(CACHE_NAME);
  const visibleVideoUrls = Array.from(document.querySelectorAll("video"))
    .map((video) => video.currentSrc || video.getAttribute("src") || "")
    .filter((url) => typeof url === "string" && url.includes("/progressive/document"));
  const resourceUrls = window.performance.getEntriesByType("resource")
    .map((entry) => entry && entry.name)
    .filter((url) => typeof url === "string" && url.includes("/progressive/document"));
  const initialDocumentIds = [...new Set([...visibleVideoUrls, ...resourceUrls].map(documentIdFromUrl).filter(Boolean))];
  const cacheDocumentIds = [];
  if (!TARGET_DOCUMENT_ID_HASH || initialDocumentIds.length === 0) {
    try {
      const cacheUrls = (await cache.keys())
        .map((request) => request.url)
        .filter((url) => typeof url === "string" && url.includes("/progressive/document"));
      cacheDocumentIds.push(...cacheUrls.map(documentIdFromUrl).filter(Boolean));
    } catch {
      // Large Telegram caches can reject full key enumeration; visible video and performance entries remain authoritative.
    }
  }
  const allDocumentIds = [...new Set([...initialDocumentIds, ...cacheDocumentIds])];
  const documentIds = [];
  for (const documentId of allDocumentIds) {
    if (TARGET_DOCUMENT_ID_HASH && await hashText(documentId) !== TARGET_DOCUMENT_ID_HASH) continue;
    documentIds.push(documentId);
  }
  if (TARGET_DOCUMENT_ID_HASH && documentIds.length === 0) {
    return failure("candidate_not_found", "Selected Telegram Web video is not present in the authorized page media list.", "review_required");
  }
  const groups = new Map();
  const chunkSize = 524288;
  const maxProbeEnd = Math.min(MAX_BYTES, 10 * 1024 * 1024);

  for (const documentId of documentIds) {
    const entries = [];
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
      const contentType = getHeader("content-type");
      if (!contentType.toLowerCase().startsWith("video/")) break;
      const range = parseRange(getHeader("content-range"));
      if (!range) break;
      const bytes = new Uint8Array(await partResponse.clone().arrayBuffer());
      entries.push({
        start: range.start,
        end: range.end,
        total: range.total,
        byteLength: bytes.length,
        contentType,
        bytes,
      });
      if (range.end + 1 >= range.total) break;
    }
    if (entries.length > 0) {
      groups.set(documentId, entries);
    }
  }

  let sawPartial = false;
  let sawTooLarge = false;
  for (const [documentId, entries] of groups) {
    entries.sort((left, right) => left.start - right.start);
    const total = entries[0]?.total || 0;
    if (total <= 0) continue;
    if (total > MAX_BYTES) {
      sawTooLarge = true;
      continue;
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
  if (sawTooLarge) {
    return failure("download_too_large", "Telegram Web cached media exceeds maxBytes.", "review_required");
  }
  return failure("candidate_not_found", "No Telegram Web video media cache entries were found.", "review_required");
})()
`;

export const buildTelegramWebCacheProbeScript = (
  maxBytes: number,
  targetDocumentIdHash?: string | null,
): string =>
  TELEGRAM_WEB_CACHE_PROBE_SCRIPT_TEMPLATE.replace(
    "__MAX_BYTES__",
    JSON.stringify(maxBytes),
  ).replace(
    "__TARGET_DOCUMENT_ID_HASH__",
    JSON.stringify(targetDocumentIdHash ?? null),
  );
