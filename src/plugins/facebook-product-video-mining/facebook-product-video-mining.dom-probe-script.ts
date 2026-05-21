import {
  FACEBOOK_COMMENT_ENTRY_PATTERNS,
  FACEBOOK_LIKE_PATTERNS,
  FACEBOOK_MORE_MENU_PATTERNS,
  FACEBOOK_NEXT_VIDEO_PATTERNS,
  FACEBOOK_NOT_INTERESTED_PATTERNS,
  FACEBOOK_SHARE_PATTERNS,
} from "./facebook-product-video-mining.hints.js";

const patternSource = (patterns: readonly RegExp[]): string =>
  patterns.map((pattern) => pattern.source).join("|");

const DOM_PROBE_HELPERS = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const selectorFor = (el) => {
  const id = el.getAttribute("id");
  if (id) return "#" + CSS.escape(id);
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
  if (testId) return "[data-testid='" + CSS.escape(testId) + "'],[data-automation-id='" + CSS.escape(testId) + "']";
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return el.tagName.toLowerCase() + "[aria-label='" + CSS.escape(ariaLabel) + "']";
  const href = el.getAttribute("href");
  if (href) return el.tagName.toLowerCase() + "[href='" + CSS.escape(href) + "']";
  return null;
};
const confidenceFor = (el) => {
  if (el.getAttribute("data-testid") || el.getAttribute("data-automation-id")) return 0.95;
  if (el.getAttribute("id")) return 0.92;
  if (el.getAttribute("aria-label")) return 0.88;
  if (el.getAttribute("href")) return 0.82;
  return 0.64;
};
const viewportCenterY = window.innerHeight / 2;
const distanceFromActiveArea = (el) => {
  const rect = el.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  return Math.abs(centerY - viewportCenterY);
};
const candidateFrom = (el, matchedSignal, reason) => ({
  selector: selectorFor(el),
  confidence: confidenceFor(el),
  reason,
  matchedSignals: [matchedSignal].filter(Boolean),
  visibleText: clip(el.textContent || el.getAttribute("aria-label") || "") || null,
  metricValue: clip(el.textContent || "") || null,
  _distanceFromActiveArea: distanceFromActiveArea(el),
});
const collectCandidates = (patternSource, reason) => {
  const pattern = new RegExp(patternSource, "iu");
  return Array.from(document.querySelectorAll("a, button, div[role='button'], span[role='button'], [role='menuitem'], [aria-label], [href]"))
    .filter(isVisible)
    .map((el) => {
      const role = el.getAttribute("role") || "";
      const aria = clip(el.getAttribute("aria-label") || "");
      const bodyText = clip(el.textContent || "");
      const shortText = bodyText.length <= 80 ? bodyText : "";
      const text = clip(aria || shortText || role);
      if (reason.includes("more menu") && /facebook\\s*菜单/iu.test(text)) return null;
      return pattern.test(text) ? candidateFrom(el, text, reason) : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const confidenceDelta = (right?.confidence || 0) - (left?.confidence || 0);
      if (Math.abs(confidenceDelta) > 0.03) return confidenceDelta;
      return (left?._distanceFromActiveArea ?? Number.MAX_SAFE_INTEGER)
        - (right?._distanceFromActiveArea ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, 12);
};
const visibleVideos = Array.from(document.querySelectorAll("video"))
  .filter(isVisible)
  .sort((left, right) => distanceFromActiveArea(left) - distanceFromActiveArea(right))
  .map((video) => ({
    src: video.getAttribute("src"),
    currentSrc: video.currentSrc || video.getAttribute("src"),
    duration: Number.isFinite(video.duration) ? video.duration : null,
    width: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
    height: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
    readyState: Number.isFinite(video.readyState) ? video.readyState : null,
    muted: Boolean(video.muted),
    paused: Boolean(video.paused),
  }));
`;

const buildCollectorLine = (
  key: string,
  patterns: readonly RegExp[],
  reason: string,
): string => `  ${key}: collectCandidates(${JSON.stringify(patternSource(patterns))}, ${JSON.stringify(reason)}),`;

export const buildFacebookDomProbeScript = (): string => [
  DOM_PROBE_HELPERS,
  "return {",
  "  sourcePageUrl: location.href,",
  "  pageTitle: document.title,",
  '  bodyText: clip(document.body?.innerText || ""),',
  "  videoElementFacts: visibleVideos,",
  buildCollectorLine("commentEntryCandidates", FACEBOOK_COMMENT_ENTRY_PATTERNS, "semantic comment entry"),
  buildCollectorLine("moreMenuCandidates", FACEBOOK_MORE_MENU_PATTERNS, "semantic more menu"),
  buildCollectorLine("nextVideoCandidates", FACEBOOK_NEXT_VIDEO_PATTERNS, "semantic next video action"),
  buildCollectorLine("likeCandidates", FACEBOOK_LIKE_PATTERNS, "semantic like metric"),
  buildCollectorLine("commentCountCandidates", FACEBOOK_COMMENT_ENTRY_PATTERNS, "semantic comment metric"),
  buildCollectorLine("shareCandidates", FACEBOOK_SHARE_PATTERNS, "semantic share metric"),
  buildCollectorLine("notInterestedCandidates", FACEBOOK_NOT_INTERESTED_PATTERNS, "semantic not interested action"),
  "};",
].join("\n");
