export type FacebookNavigationSignature = {
  signature: string;
  mediaSignature: string;
  url: string;
  videoCount: number;
  videoFacts: Array<{
    currentSrc: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
    readyState: number | null;
    viewportCenterDistance: number;
  }>;
  metricTexts: string[];
  nextCandidates: string[];
  visibleTextHash: string;
  activeDialogCount: number;
};

const FACEBOOK_NAVIGATION_SIGNATURE_SCRIPT = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const hashText = (value) => {
  let hash = 0;
  const text = clip(value).slice(0, 1600);
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return String(hash >>> 0);
};
const viewportCenterY = window.innerHeight / 2;
const videoFacts = Array.from(document.querySelectorAll("video")).filter(isVisible).map((video) => {
  const rect = video.getBoundingClientRect();
  return {
    currentSrc: video.currentSrc || video.getAttribute("src") || null,
    duration: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : null,
    width: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
    height: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
    readyState: Number.isFinite(video.readyState) ? video.readyState : null,
    viewportCenterDistance: Math.round(Math.abs((rect.top + rect.height / 2) - viewportCenterY)),
  };
}).sort((left, right) => left.viewportCenterDistance - right.viewportCenterDistance);
const controls = Array.from(document.querySelectorAll("button,a,div[role='button'],span[role='button'],[aria-label]")).filter(isVisible);
const metricTexts = controls
  .map((node) => clip((node.getAttribute("aria-label") || "") + " " + (node.textContent || "")))
  .filter((text) => /赞|like|评论|comment|分享|share/i.test(text))
  .slice(0, 12);
const nextCandidates = controls
  .map((node) => clip(node.getAttribute("aria-label") || node.textContent || ""))
  .filter((text) => /下一|下一个|下一行|next|arrow down/i.test(text))
  .slice(0, 8);
const playerText = Array.from(document.querySelectorAll("[aria-label='Video player'], [aria-label='视频播放器'], [role='main'], video"))
  .map((node) => node instanceof Element ? clip(node.textContent || node.getAttribute("aria-label") || "") : "")
  .filter(Boolean)
  .join(" | ");
const activeDialogCount = Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true']")).filter(isVisible).length;
const visibleTextHash = hashText(playerText || document.body?.innerText || "");
const mediaSignature = JSON.stringify({
  url: location.href,
  activeVideo: videoFacts[0] || null,
  metricTexts,
  playerTextHash: hashText(playerText),
});
return {
  signature: mediaSignature,
  mediaSignature,
  url: location.href,
  videoCount: videoFacts.length,
  videoFacts,
  metricTexts,
  nextCandidates,
  visibleTextHash,
  activeDialogCount,
};
`;

const FACEBOOK_PREPARE_NEXT_VIDEO_SCRIPT = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const closeButtons = Array.from(document.querySelectorAll("button, div[role='button'], span[role='button'], [aria-label]"))
  .filter(isVisible)
  .filter((node) => /关闭|close|dismiss/i.test(clip(node.getAttribute("aria-label") || node.textContent || "")));
const clickedClose = closeButtons[0];
if (clickedClose instanceof HTMLElement) {
  clickedClose.click();
  return {acted: true, action: "clicked_close", text: clip(clickedClose.getAttribute("aria-label") || clickedClose.textContent || "")};
}
document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true}));
return {acted: true, action: "escape", text: null};
`;

const FACEBOOK_NAVIGATE_NEXT_VIDEO_SCRIPT = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const isVisible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const candidates = Array.from(document.querySelectorAll("button,a,div[role='button'],span[role='button'],[aria-label]"))
  .filter(isVisible)
  .map((node) => ({
    node,
    text: clip(node.getAttribute("aria-label") || node.textContent || ""),
    rect: node.getBoundingClientRect(),
  }))
  .filter((item) => /下一行|下一个|下一条|next|arrow down/i.test(item.text));
const preferred = candidates
  .filter((item) => !/快拍|story/i.test(item.text))
  .sort((left, right) => right.rect.top - left.rect.top)[0] || candidates[0];
if (preferred?.node instanceof HTMLElement) {
  preferred.node.scrollIntoView({block: "center", inline: "center"});
  preferred.node.click();
  return {acted: true, action: "clicked_next", text: preferred.text};
}
window.scrollBy({top: Math.max(700, Math.floor(window.innerHeight * 0.85)), behavior: "smooth"});
return {acted: true, action: "scrolled_feed", text: null};
`;

const FACEBOOK_FALLBACK_NEXT_VIDEO_SCRIPT = `
window.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true}));
document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true}));
window.scrollBy({top: Math.max(900, Math.floor(window.innerHeight * 0.95)), behavior: "smooth"});
return {acted: true, action: "arrow_down_and_scroll", text: null};
`;

export const buildNavigationSignatureScript = (): string => FACEBOOK_NAVIGATION_SIGNATURE_SCRIPT;

export const buildPrepareForNextVideoScript = (): string => FACEBOOK_PREPARE_NEXT_VIDEO_SCRIPT;

export const buildNavigateToNextVideoScript = (): string => FACEBOOK_NAVIGATE_NEXT_VIDEO_SCRIPT;

export const buildFallbackNavigateToNextVideoScript = (): string => FACEBOOK_FALLBACK_NEXT_VIDEO_SCRIPT;