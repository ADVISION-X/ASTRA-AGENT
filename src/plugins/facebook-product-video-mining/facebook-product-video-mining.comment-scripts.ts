import {
  FACEBOOK_COMMENT_ENTRY_PATTERNS,
  FACEBOOK_COMMENT_EXPANSION_PATTERNS,
  FACEBOOK_LOGIN_BLOCKER_PATTERNS,
  FACEBOOK_RATE_LIMIT_PATTERNS,
  FACEBOOK_SECURITY_BLOCKER_PATTERNS,
} from "./facebook-product-video-mining.hints.js";

const patternSource = (patterns: readonly RegExp[]): string =>
  patterns.map((pattern) => pattern.source).join("|");

const COMMENT_EXTRACTION_GUARDS = `
if (/${patternSource(FACEBOOK_LOGIN_BLOCKER_PATTERNS)}/iu.test(bodyText)) {
  return {status: "review_required", reason: "facebook_login_required", comments: [], expandableCount: 0};
}
if (/${patternSource(FACEBOOK_SECURITY_BLOCKER_PATTERNS)}/iu.test(bodyText) || /${patternSource(FACEBOOK_RATE_LIMIT_PATTERNS)}/iu.test(bodyText)) {
  return {status: "review_required", reason: "facebook_comment_collection_blocked", comments: [], expandableCount: 0};
}
`;

const COMMENT_EXTRACTION_HELPERS = `
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const parseMetric = (value) => {
  const matched = clip(value).replace(/,/g, "").match(/(\d+(?:\.\d+)?)([KMB])?/iu);
  if (!matched) return null;
  const numberValue = Number.parseFloat(matched[1] || "0");
  const suffix = (matched[2] || "").toUpperCase();
  const multiplier = suffix === "K" ? 1000 : suffix === "M" ? 1000000 : suffix === "B" ? 1000000000 : 1;
  return Number.isFinite(numberValue) ? Math.round(numberValue * multiplier) : null;
};
`;

const COMMENT_EXTRACTION_BODY = `
const containers = Array.from(document.querySelectorAll("li, article, [role='article'], div[data-testid*='comment'], div[aria-label*='Comment'], div[aria-label*='评论']"))
  .filter(isVisible)
  .slice(0, 400);
const comments = containers.map((container, index) => {
  const linkTexts = Array.from(container.querySelectorAll("strong, h3, h4, a[role='link'], a[href]"))
    .filter(isVisible)
    .map((node) => clip(node.textContent || ""))
    .filter((text) => text.length > 0 && text.length <= 80 && !/${patternSource(FACEBOOK_COMMENT_EXPANSION_PATTERNS)}/iu.test(text) && !/like|reply|share|赞|回复|分享|作者|edited|已编辑/iu.test(text));
  const authorDisplayText = linkTexts[0] || null;
  const textNodes = Array.from(container.querySelectorAll("[dir='auto'], span, div, p"))
    .filter(isVisible)
    .map((node) => clip(node.textContent || ""))
    .filter((text) =>
      text.length > 1
      && text !== authorDisplayText
      && !linkTexts.includes(text)
      && !/^\\d+$/u.test(text)
      && !/${patternSource(FACEBOOK_COMMENT_EXPANSION_PATTERNS)}/iu.test(text)
      && !/like|reply|share|赞|回复|分享|作者|edited|已编辑/iu.test(text));
  const uniqueTextNodes = [...new Set(textNodes)];
  const commentText = uniqueTextNodes
    .filter((text) => !uniqueTextNodes.some((other) => other !== text && other.includes(text)))
    .sort((left, right) => right.length - left.length)[0] || "";
  if (!commentText) return null;
  const likeCount = parseMetric(Array.from(container.querySelectorAll("span, a, button")).map((node) => clip(node.textContent || "")).find((text) => /like|赞/iu.test(text) && /(\d|K|M|B)/iu.test(text)) || null);
  return {
    commentId: container.getAttribute("data-commentid") || container.getAttribute("id"),
    authorDisplayText,
    commentText,
    likeCount,
    replyDepth: 0,
    parentCommentId: null,
    sourceSignal: "comment_container_" + index,
  };
}).filter(Boolean);
const expandableCount = Array.from(document.querySelectorAll("button, div[role='button'], span[role='button']"))
  .filter(isVisible)
  .map((node) => clip(node.getAttribute("aria-label") || node.textContent || ""))
  .filter((text) => /${patternSource(FACEBOOK_COMMENT_EXPANSION_PATTERNS)}/iu.test(text)).length;
return {status: "success", reason: null, comments, expandableCount};
`;

export const buildClickCommentEntryScript = (selector: string | null): string => `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
if (/${patternSource(FACEBOOK_LOGIN_BLOCKER_PATTERNS)}/iu.test(bodyText)) {
  return {status: "review_required", reason: "facebook_login_required", acted: false};
}
if (/${patternSource(FACEBOOK_SECURITY_BLOCKER_PATTERNS)}/iu.test(bodyText)) {
  return {status: "review_required", reason: "facebook_security_verification_required", acted: false};
}
let entry = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : "null"};
if (!entry) {
  entry = Array.from(document.querySelectorAll("a, button, div[role='button'], span[role='button'], [aria-label]")).find((node) => {
    const text = clip(node.getAttribute("aria-label") || node.textContent || "");
    return /${patternSource(FACEBOOK_COMMENT_ENTRY_PATTERNS)}/iu.test(text);
  });
}
if (!(entry instanceof HTMLElement)) {
  return {status: "failed", reason: "comment_entry_not_found", acted: false};
}
entry.click();
return {status: "success", reason: null, acted: true};
`;

export const buildExtractCommentsScript = (): string => `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
${COMMENT_EXTRACTION_GUARDS}
${COMMENT_EXTRACTION_HELPERS}
${COMMENT_EXTRACTION_BODY}
`;

export const buildExpandNextScript = (): string => `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const action = Array.from(document.querySelectorAll("button, div[role='button'], span[role='button']"))
  .filter(isVisible)
  .find((node) => /${patternSource(FACEBOOK_COMMENT_EXPANSION_PATTERNS)}/iu.test(clip(node.getAttribute("aria-label") || node.textContent || "")));
if (action instanceof HTMLElement) {
  action.click();
  return {status: "success", reason: null, acted: true};
}
window.scrollBy(0, 900);
return {status: "success", reason: "scrolled_comment_surface", acted: false};
`;
