import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type { ProductVideoEngagement } from "./product-video-dom.schema.js";

type TextCandidate = DomSnapshot["textBlocks"][number];

const firstTextMatching = (
  candidates: readonly TextCandidate[],
  pattern: RegExp,
): string | undefined => candidates
  .map((item) => item.visibleText ?? item.ariaLabel ?? item.nearbyText ?? "")
  .find((text) => pattern.test(text));

const collectText = (snapshot: DomSnapshot): string[] => [
  ...snapshot.textBlocks,
  ...snapshot.tableRows,
  ...snapshot.roleRows,
  ...snapshot.genericClickableElements,
].flatMap((item) => [item.visibleText, item.ariaLabel, item.nearbyText])
  .filter((value): value is string => Boolean(value && value.trim()))
  .map((value) => value.trim());

export const extractProductVideoDomId = (snapshot: DomSnapshot, videoVisitId: string): string =>
  `${videoVisitId}:${snapshot.url}`;

export const extractProductVideoAuthor = (snapshot: DomSnapshot): string | undefined =>
  firstTextMatching(snapshot.textBlocks, /(?:author|creator|博主|作者|@)/iu);

export const extractProductVideoTitle = (snapshot: DomSnapshot): string | undefined =>
  snapshot.title || firstTextMatching(snapshot.textBlocks, /(?:title|标题)/iu);

export const extractProductVideoDescription = (snapshot: DomSnapshot): string | undefined =>
  firstTextMatching(snapshot.textBlocks, /(?:description|caption|详情|文案|简介)/iu);

export const extractProductVideoHashtags = (snapshot: DomSnapshot): string[] =>
  Array.from(new Set(collectText(snapshot).flatMap((text) => text.match(/#[\p{L}\p{N}_-]+/gu) ?? []))).slice(0, 30);

export const extractProductVideoProductSignals = (snapshot: DomSnapshot): string[] =>
  collectText(snapshot)
    .filter((text) => /(?:buy|shop|product|cart|link|购买|商品|同款|橱窗|下单)/iu.test(text))
    .slice(0, 20);

export const extractProductVideoEngagement = (snapshot: DomSnapshot): ProductVideoEngagement => {
  const texts = collectText(snapshot);
  return {
    likesText: texts.find((text) => /(?:likes?|赞|点赞)/iu.test(text)),
    commentsText: texts.find((text) => /(?:comments?|评论)/iu.test(text)),
    savesText: texts.find((text) => /(?:saves?|收藏)/iu.test(text)),
    sharesText: texts.find((text) => /(?:shares?|分享)/iu.test(text)),
  };
};
