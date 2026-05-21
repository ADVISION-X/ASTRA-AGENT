import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type { ProductVideoEngagement } from "./product-video-dom.schema.js";
import { extractVisibleTextSample } from "./product-video-dom-text.js";

const collectDirectText = (snapshot: DomSnapshot): string[] => [
  ...snapshot.textBlocks,
  ...snapshot.tableRows,
  ...snapshot.roleRows,
  ...snapshot.genericClickableElements,
  ...snapshot.buttons,
  ...snapshot.links,
].flatMap((item) => [item.visibleText, item.ariaLabel])
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => value.trim());

const collectNearbyActionText = (snapshot: DomSnapshot): string[] => [
  ...snapshot.genericClickableElements,
  ...snapshot.buttons,
  ...snapshot.links,
].flatMap((item) => [item.nearbyText])
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => value.trim());

const dedupeTexts = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeNumberToken = (value: string): number | null => {
  const cleaned = value.toLowerCase().replace(/,/g, "").trim();
  const matched = cleaned.match(/(\d+(?:\.\d+)?)(k|m|b|千|万|亿)?/u);
  if (!matched) {
    return null;
  }
  const amount = Number.parseFloat(matched[1] ?? "");
  if (!Number.isFinite(amount)) {
    return null;
  }
  const unit = matched[2] ?? "";
  const multiplier = unit === "k"
    ? 1_000
    : unit === "m"
      ? 1_000_000
      : unit === "b"
        ? 1_000_000_000
        : unit === "千"
          ? 1_000
          : unit === "万"
            ? 10_000
            : unit === "亿"
              ? 100_000_000
              : 1;
  return Math.round(amount * multiplier);
};

const firstCountMatching = (
  candidates: readonly string[],
  pattern: RegExp,
): string | undefined => candidates.find((text) => pattern.test(text));

const LIKE_COUNT_PATTERN = /(?:likes?|赞(?:数|量)?|点赞)\s*[:：]?\s*[\d,.万千kmb]+|[\d,.万千kmb]+\s*(?:likes?|赞(?:数|量)?|点赞)/iu;
const COMMENT_COUNT_PATTERN = /(?:comments?|评论(?:数|量)?)\s*[:：]?\s*[\d,.万千kmb]+|[\d,.万千kmb]+\s*(?:comments?|评论(?:数|量)?)/iu;
const SAVE_COUNT_PATTERN = /(?:saves?|收藏(?:数|量)?)\s*[:：]?\s*[\d,.万千kmb]+|[\d,.万千kmb]+\s*(?:saves?|收藏(?:数|量)?)/iu;
const SHARE_COUNT_PATTERN = /(?:shares?|分享(?:数|量)?)\s*[:：]?\s*[\d,.万千kmb]+|[\d,.万千kmb]+\s*(?:shares?|分享(?:数|量)?)/iu;

export const extractProductVideoVisitId = (snapshot: DomSnapshot): string | null => {
  try {
    const parsed = new URL(snapshot.url);
    const knownPath = parsed.pathname.match(/\/(?:reel|video|shorts|clip|watch)\/([^/?#]+)/u)?.[1];
    if (knownPath) {
      return knownPath;
    }
    const storyFbid = parsed.searchParams.get("story_fbid")?.trim();
    if (storyFbid) {
      return storyFbid;
    }
    const videoId = parsed.searchParams.get("v")?.trim();
    if (videoId) {
      return videoId;
    }
    const hash = parsed.hash.replace(/^#/, "").trim();
    return hash || null;
  } catch {
    return null;
  }
};

export const extractProductLinkVisible = (snapshot: DomSnapshot): boolean => snapshot.links.some((link) => {
  const text = [link.visibleText, link.ariaLabel, link.nearbyText].filter(Boolean).join(" ");
  return /(?:product|shop|buy|购买|商品|同款|下单|链接)/iu.test(text);
});

export const extractShopEntryVisible = (snapshot: DomSnapshot): boolean => [
  ...snapshot.links,
  ...snapshot.buttons,
  ...snapshot.genericClickableElements,
].some((item) => {
  const text = [item.visibleText, item.ariaLabel, item.nearbyText].filter(Boolean).join(" ");
  return /(?:shop|store|cart|购物|店铺|商城|橱窗)/iu.test(text);
});

export const extractExternalLinkVisible = (snapshot: DomSnapshot): boolean => {
  try {
    const activeHost = new URL(snapshot.url).host;
    return snapshot.links.some((link) => Boolean(link.hrefHost && link.hrefHost !== activeHost));
  } catch {
    return snapshot.links.some((link) => Boolean(link.hrefHost));
  }
};

export const extractSnapshotSignature = (snapshot: DomSnapshot): string => [
  snapshot.url,
  snapshot.title,
  ...extractVisibleTextSample(snapshot, 6),
].join("|");

export const extractProductVideoEngagement = (snapshot: DomSnapshot): ProductVideoEngagement => {
  const directTexts = dedupeTexts(collectDirectText(snapshot));
  const nearbyTexts = dedupeTexts(collectNearbyActionText(snapshot));
  const selectCountText = (pattern: RegExp): string | undefined =>
    firstCountMatching(directTexts, pattern) ?? firstCountMatching(nearbyTexts, pattern);
  return {
    likesText: selectCountText(LIKE_COUNT_PATTERN),
    commentsText: selectCountText(COMMENT_COUNT_PATTERN),
    savesText: selectCountText(SAVE_COUNT_PATTERN),
    sharesText: selectCountText(SHARE_COUNT_PATTERN),
  };
};

export const parseProductVideoCount = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  return normalizeNumberToken(value);
};
