import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createWorkbenchAssembly } from "../../src/lib/local-runtime/workbench-assembly.js";

type LiveProbeResult = {
  realPageUrl: string;
  currentUrl: string;
  pageTitle: string;
  host: string;
  visibleVideoCount: number;
  primaryVideo: {
    src: string | null;
    currentSrc: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
    readyState: number | null;
  } | null;
  candidates: Record<"videoContainers" | "likeCount" | "commentCount" | "commentEntry" | "commentLoadMore" | "moreMenu" | "notInterested" | "nextVideo", Array<{ text: string | null; ariaLabel: string | null; selector: string; role: string | null }>>;
  blocker: string | null;
  capturedAt: string;
};

const outputDir = path.resolve(".grasseye-local/debug");

const probeScript = `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, 220);
const visible = (node) => {
  if (!(node instanceof Element)) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
};
const selectorFor = (el) => {
  const id = el.getAttribute("id");
  if (id) return "#" + CSS.escape(id);
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-automation-id");
  if (testId) return "[data-testid='" + CSS.escape(testId) + "']";
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return el.tagName.toLowerCase() + "[aria-label='" + CSS.escape(ariaLabel) + "']";
  const role = el.getAttribute("role");
  if (role) return el.tagName.toLowerCase() + "[role='" + CSS.escape(role) + "']";
  return el.tagName.toLowerCase();
};
const pick = (pattern) => Array.from(document.querySelectorAll("a,button,div[role='button'],span[role='button'],[aria-label]"))
  .filter(visible)
  .map((el) => ({
    text: clip(el.textContent || "") || null,
    ariaLabel: clip(el.getAttribute("aria-label") || "") || null,
    selector: selectorFor(el),
    role: el.getAttribute("role"),
  }))
  .filter((item) => pattern.test([item.text, item.ariaLabel, item.role].filter(Boolean).join(" ")))
  .slice(0, 16);
const videos = Array.from(document.querySelectorAll("video")).filter(visible).map((video) => ({
  src: video.getAttribute("src"),
  currentSrc: video.currentSrc || video.getAttribute("src"),
  duration: Number.isFinite(video.duration) ? video.duration : null,
  width: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
  height: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
  readyState: Number.isFinite(video.readyState) ? video.readyState : null,
}));
const bodyText = clip(document.body?.innerText || "");
const blocker = /log in|sign in|登录|登入/i.test(bodyText)
  ? "login_required"
  : /captcha|verification|2fa|two-factor|验证|安全检查/i.test(bodyText)
    ? "captcha_or_2fa_required"
    : null;
return {
  realPageUrl: location.href,
  currentUrl: location.href,
  pageTitle: document.title,
  host: location.host,
  visibleVideoCount: videos.length,
  primaryVideo: videos[0] || null,
  candidates: {
    videoContainers: pick(/reel|video|播放|视频/i),
    likeCount: pick(/like|reaction|赞/i),
    commentCount: pick(/comment|评论/i),
    commentEntry: pick(/comment|评论/i),
    commentLoadMore: pick(/more comments|view replies|see more|更多评论|更多回复|展开/i),
    moreMenu: pick(/more|options|menu|更多|选项/i),
    notInterested: pick(/not interested|hide|see less|show less|不感兴趣|隐藏|减少/i),
    nextVideo: pick(/next|arrow down|下一|下一个/i),
  },
  blocker,
  capturedAt: new Date().toISOString(),
};
`;

const writeMarkdown = (probe: LiveProbeResult): void => {
  const lines = [
    "# Facebook Live DOM Probe",
    "",
    `- URL: ${probe.realPageUrl}`,
    `- Title: ${probe.pageTitle}`,
    `- Host: ${probe.host}`,
    `- Visible videos: ${probe.visibleVideoCount}`,
    `- Blocker: ${probe.blocker ?? "none"}`,
    `- Comment entry candidates: ${probe.candidates.commentEntry.length}`,
    `- Like candidates: ${probe.candidates.likeCount.length}`,
    `- More menu candidates: ${probe.candidates.moreMenu.length}`,
    `- Not interested candidates: ${probe.candidates.notInterested.length}`,
    `- Next video candidates: ${probe.candidates.nextVideo.length}`,
  ];
  writeFileSync(path.join(outputDir, "facebook-live-dom-probe-latest.md"), `${lines.join("\n")}\n`);
};

const main = async (): Promise<void> => {
  mkdirSync(outputDir, { recursive: true });
  const feedUrl = process.env.FACEBOOK_FEED_ENTRY_URL ?? "https://www.facebook.com/reels/";
  const assembly = createWorkbenchAssembly({
    baseUrl: "http://127.0.0.1:0",
    platformTarget: "facebook-web",
    browserHeadless: false,
  });
  await assembly.browserController.open({ url: feedUrl, title: "Facebook live DOM probe" });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await assembly.browserController.evaluateActiveTab<{ readyVideoCount: number }>({
      description: "wait for Facebook video elements before live DOM probe",
      script: `
const readyVideoCount = Array.from(document.querySelectorAll("video"))
  .filter((video) => video.readyState > 0 || video.videoWidth > 0 || video.videoHeight > 0)
  .length;
return {readyVideoCount};
`,
    });
    if (state.readyVideoCount > 0) {
      break;
    }
    await assembly.browserController.wait(1_000);
  }
  const probe = await assembly.browserController.evaluateActiveTab<LiveProbeResult>({
    description: "Facebook live DOM probe",
    script: probeScript,
  });
  writeFileSync(path.join(outputDir, "facebook-live-dom-probe-latest.json"), `${JSON.stringify(probe, null, 2)}\n`);
  writeMarkdown(probe);
  await assembly.browserController.close();
  process.stdout.write(`[facebook-live-dom-probe] wrote ${path.join(outputDir, "facebook-live-dom-probe-latest.json")}\n`);
};

await main();
