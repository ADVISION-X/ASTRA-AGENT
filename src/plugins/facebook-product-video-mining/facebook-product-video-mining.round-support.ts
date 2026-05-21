import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { VideoDownloadResult } from "../../capabilities/video-download/index.js";
import { FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID } from "./facebook-product-video-mining.ai-judge.js";
import { focusExistingFacebookVideoTab } from "./facebook-product-video-mining.chrome-tabs.js";
import { createFacebookMiningAiJudgmentId, createFacebookMiningCandidateId } from "./facebook-product-video-mining.result.js";
import type {
  FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import type { FacebookProductVideoMiningStorage } from "./facebook-product-video-mining.storage.js";

type FacebookProductVideoCandidateRecord = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type CandidateVideoDownload = {
  output: Pick<
    Extract<VideoDownloadResult["output"], { status: "success" }>,
    | "artifactRef"
    | "filePath"
    | "sha256"
    | "byteSize"
    | "contentType"
    | "artifactDisposition"
  >;
};

export type FacebookMiningRoundOutcome = {
  terminal: boolean;
  reason: string | null;
};

type BuildFacebookMiningCandidateInput = {
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  probe: FacebookVideoDomProbeResult;
  judgment?: FacebookVideoAiJudgment | null;
  download?: CandidateVideoDownload | null;
  status: FacebookProductVideoCandidateRecord["status"];
  commentsLoadedCount: number;
  commentsComplete: boolean;
  commentStopReason: string | null;
  notInterestedStatus?: string | null;
};

export const logFacebookMiningFlow = (input: {
  logger: RuntimeLogger;
  eventType: typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];
  runId: string;
  missionId: string;
  roundId?: string;
  status: "started" | "success" | "failed" | "review_required" | "skipped";
  reason?: string | null;
}): void => input.logger.emit({
    traceId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    level: input.status === "failed" ? "error" : "info",
    modeVisibility: ["FLOW"],
    eventType: input.eventType,
    owner: "facebook-product-video-mining",
    missionId: input.missionId,
    runId: input.runId,
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
  });

const buildCandidateVideoFields = (
  status: FacebookProductVideoCandidateRecord["status"],
  download?: CandidateVideoDownload | null,
) => {
  if (!download) {
    return {
      videoArtifactRef: null,
      videoFilePath: null,
      videoSha256: null,
      videoByteSize: null,
      videoContentType: null,
      videoArtifactDisposition: null,
    };
  }
  if (status !== "saved") {
    return {
      videoArtifactRef: download.output.artifactRef,
      videoFilePath: null,
      videoSha256: null,
      videoByteSize: null,
      videoContentType: null,
      videoArtifactDisposition: null,
    };
  }
  return {
    videoArtifactRef: download.output.artifactRef,
    videoFilePath: download.output.filePath,
    videoSha256: download.output.sha256,
    videoByteSize: download.output.byteSize,
    videoContentType: download.output.contentType,
    videoArtifactDisposition: download.output.artifactDisposition,
  };
};

const buildCandidateProbeFields = (probe: FacebookVideoDomProbeResult) => ({
  sourcePageUrl: probe.sourcePageUrl,
  facebookVideoId: probe.facebookVideoId,
  pageTitle: probe.pageTitle,
  authorText: probe.authorText,
  captionText: probe.captionText,
  likeCount: probe.likeCount,
  commentCountDisplayed: probe.commentCountDisplayed,
});

const buildCandidateCommentFields = (input: {
  commentsLoadedCount: number;
  commentsComplete: boolean;
  commentStopReason: string | null;
  commentCountDisplayed: number | null;
}) => ({
  commentsLoadedCount: input.commentsLoadedCount,
  commentsComplete: input.commentCountDisplayed !== null && input.commentsLoadedCount < input.commentCountDisplayed
    ? false
    : input.commentsComplete,
  commentStopReason: input.commentCountDisplayed !== null && input.commentsLoadedCount < input.commentCountDisplayed
    ? "displayed_comment_count_not_fully_loaded"
    : input.commentStopReason,
});

const buildCandidateJudgmentFields = (judgment?: FacebookVideoAiJudgment | null) => ({
  aiSelectedOptionId: judgment?.selectedOptionId ?? null,
  aiConfidence: judgment?.confidence ?? null,
  aiReason: judgment?.reason ?? null,
});

const buildCandidateIdentityFields = (input: BuildFacebookMiningCandidateInput) => ({
  id: createFacebookMiningCandidateId(),
  missionId: input.missionId,
  runId: input.runId,
  roundId: input.roundId,
  roundIndex: input.roundIndex,
});

const buildCandidateLifecycleFields = (input: BuildFacebookMiningCandidateInput) => ({
  status: input.status,
  notInterestedStatus: input.notInterestedStatus ?? null,
  createdAt: new Date().toISOString(),
  updatedAt: null,
});

export const buildFacebookMiningCandidate = (
  input: BuildFacebookMiningCandidateInput,
): FacebookProductVideoCandidateRecord => ({
  ...buildCandidateIdentityFields(input),
  ...buildCandidateProbeFields(input.probe),
  ...buildCandidateCommentFields({
    commentsLoadedCount: input.commentsLoadedCount,
    commentsComplete: input.commentsComplete,
    commentStopReason: input.commentStopReason,
    commentCountDisplayed: input.probe.commentCountDisplayed,
  }),
  ...buildCandidateJudgmentFields(input.judgment),
  ...buildCandidateVideoFields(input.status, input.download),
  ...buildCandidateLifecycleFields(input),
});

export const saveFacebookMiningCandidateEvidence = (input: {
  storage: FacebookProductVideoMiningStorage;
  candidate: FacebookProductVideoCandidateRecord;
  comments: Parameters<FacebookProductVideoMiningStorage["saveComments"]>[1];
  judgment?: FacebookVideoAiJudgment | null;
  probe: FacebookVideoDomProbeResult;
}): void => {
  input.storage.saveCandidate({
    candidate: input.candidate,
    rawDomProbeJson: JSON.stringify(input.probe),
  });
  input.storage.saveComments(input.candidate.id, input.comments);
  if (!input.judgment) {
    return;
  }
  input.storage.saveAiJudgment({
    id: createFacebookMiningAiJudgmentId(),
    candidateId: input.candidate.id,
    promptContractId: FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
    judgment: input.judgment,
  });
};

type FacebookNavigationSignature = {
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

const buildNavigationSignatureScript = (): string => `
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

const buildPrepareForNextVideoScript = (): string => `
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

const buildNavigateToNextVideoScript = (): string => `
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

const buildFallbackNavigateToNextVideoScript = (): string => `
window.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true}));
document.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true}));
window.scrollBy({top: Math.max(900, Math.floor(window.innerHeight * 0.95)), behavior: "smooth"});
return {acted: true, action: "arrow_down_and_scroll", text: null};
`;

const logFacebookNavigationDebug = (input: {
  logger: RuntimeLogger;
  runId: string;
  missionId: string;
  roundId?: string;
  status: "started" | "success" | "failed" | "review_required" | "skipped";
  reason?: string | null;
  before?: FacebookNavigationSignature;
  after?: FacebookNavigationSignature;
  action?: unknown;
}): void => input.logger.emit({
  traceId: input.runId,
  ...(input.roundId ? { roundId: input.roundId } : {}),
  level: input.status === "failed" ? "error" : "debug",
  modeVisibility: ["DEBUG", "TRACE"],
  eventType: RuntimeLogEventType.DOM_AUTOMATION_STEP_COMPLETED,
  owner: "facebook-product-video-mining",
  missionId: input.missionId,
  runId: input.runId,
  status: input.status,
  ...(input.reason ? { reason: input.reason } : {}),
  preview: {
    before: input.before ? JSON.stringify({
      url: input.before.url,
      videoCount: input.before.videoCount,
      videoFacts: input.before.videoFacts,
      metricTexts: input.before.metricTexts,
      nextCandidates: input.before.nextCandidates,
      dialogs: input.before.activeDialogCount,
    }) : "",
    after: input.after ? JSON.stringify({
      url: input.after.url,
      videoCount: input.after.videoCount,
      videoFacts: input.after.videoFacts,
      metricTexts: input.after.metricTexts,
      nextCandidates: input.after.nextCandidates,
      dialogs: input.after.activeDialogCount,
    }) : "",
    action: input.action ? JSON.stringify(input.action) : "",
  },
});

const isFacebookPageUrl = (value: string): boolean => {
  try {
    const host = new URL(value).host.toLowerCase();
    return host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com";
  } catch {
    return false;
  }
};

export const navigateToNextFacebookVideo = async (
  input: {
    browser: BrowserController;
    logger: RuntimeLogger;
    runId: string;
    missionId: string;
    roundId: string;
    feedEntryUrl: string;
  },
): Promise<FacebookMiningRoundOutcome> => {
  const focusedFacebook = await focusExistingFacebookVideoTab({ preferredUrl: null });
  if (!focusedFacebook) {
    const opened = await input.browser.open({
      url: input.feedEntryUrl,
      title: "recover Facebook Reels feed before next navigation",
    });
    if (!opened.ok) {
      return {
        terminal: true,
        reason: "facebook_source_tab_not_found_before_next_navigation",
      };
    }
    await input.browser.wait(1_000);
  }
  await input.browser.textInput({
    targetLabel: "close Facebook comment surface before next video navigation",
    action: "press-key",
    key: "Escape",
  }).catch(() => null);
  await input.browser.wait(500);
  const before = await input.browser.evaluateActiveTab<FacebookNavigationSignature>({
    description: "capture Facebook video signature before navigation",
    script: buildNavigationSignatureScript(),
  });
  const closeAction = before.activeDialogCount > 0
    ? await input.browser.evaluateActiveTab<{ acted: boolean; action: string; text: string | null }>({
      description: "prepare Facebook feed for next video navigation",
      script: buildPrepareForNextVideoScript(),
    })
    : null;
  const navigateAction = await input.browser.evaluateActiveTab<{ acted: boolean; action: string; text: string | null }>({
    description: "navigate to next Facebook video",
    script: buildNavigateToNextVideoScript(),
  });
  const deadline = Date.now() + 8_000;
  let after = before;
  let fallbackAction: { acted: boolean; action: string; text: string | null } | null = null;
  while (Date.now() < deadline) {
    after = await input.browser.evaluateActiveTab<FacebookNavigationSignature>({
      description: "capture Facebook video signature after navigation",
      script: buildNavigationSignatureScript(),
    });
    if (!isFacebookPageUrl(after.url) && isFacebookPageUrl(before.url)) {
      const focused = await focusExistingFacebookVideoTab({ preferredUrl: before.url });
      if (!focused) {
        return {
          terminal: true,
          reason: "facebook_source_tab_not_found_after_ai_feed",
        };
      }
      await input.browser.evaluateActiveTab<{ acted: boolean; action: string; text: string | null }>({
        description: "retry next Facebook video after tab drift restore",
        script: buildNavigateToNextVideoScript(),
      });
      await input.browser.wait(500);
      continue;
    }
    if (before.signature !== after.signature) {
      break;
    }
    if (!fallbackAction && Date.now() > deadline - 5_500) {
      await input.browser.textInput({
        targetLabel: "fallback press ArrowDown for next Facebook reel",
        action: "press-key",
        key: "ArrowDown",
      }).catch(() => null);
      await input.browser.scroll({
        targetLabel: "fallback scroll Facebook reels feed",
        deltaX: 0,
        deltaY: 900,
      }).catch(() => null);
      fallbackAction = await input.browser.evaluateActiveTab<{ acted: boolean; action: string; text: string | null }>({
        description: "fallback navigate to next Facebook video with ArrowDown and scroll",
        script: buildFallbackNavigateToNextVideoScript(),
      });
    }
    await input.browser.wait(300);
  }
  logFacebookNavigationDebug({
    logger: input.logger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    status: before.signature === after.signature ? "review_required" : "success",
    reason: before.signature === after.signature ? "next_video_did_not_change" : null,
    before,
    after,
    action: { closeAction, navigateAction, fallbackAction },
  });
  return {
    terminal: before.signature === after.signature,
    reason: before.signature === after.signature ? "next_video_did_not_change" : null,
  };
};
