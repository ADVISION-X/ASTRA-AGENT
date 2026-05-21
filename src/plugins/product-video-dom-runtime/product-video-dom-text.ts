import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";

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
  ...snapshot.buttons,
  ...snapshot.links,
].flatMap((item) => [item.visibleText, item.ariaLabel, item.nearbyText])
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

export const extractProductVideoAuthor = (snapshot: DomSnapshot): string | undefined =>
  firstTextMatching(snapshot.textBlocks, /(?:author|creator|博主|作者|@)/iu);

export const extractProductVideoTitle = (snapshot: DomSnapshot): string | undefined =>
  snapshot.title || firstTextMatching(snapshot.textBlocks, /(?:title|标题)/iu);

export const extractProductVideoDescription = (snapshot: DomSnapshot): string | undefined =>
  firstTextMatching(snapshot.textBlocks, /(?:description|caption|详情|文案|简介)/iu);

export const extractProductVideoHashtags = (snapshot: DomSnapshot): string[] =>
  Array.from(new Set(collectText(snapshot).flatMap((text) => text.match(/#[\p{L}\p{N}_-]+/gu) ?? []))).slice(0, 30);

export const extractVisibleTextSample = (
  snapshot: DomSnapshot,
  limit = 18,
): string[] => dedupeTexts(
  collectText(snapshot)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean),
).slice(0, limit);