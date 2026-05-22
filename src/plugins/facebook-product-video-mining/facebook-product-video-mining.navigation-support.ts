import { createHash } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";

import {
  buildFallbackNavigateToNextVideoScript,
  buildNavigationSignatureScript,
  buildPrepareForNextVideoScript,
  buildSafeZoneNavigateToNextVideoScript,
  type FacebookNavigationSignature,
} from "./facebook-product-video-mining.navigation-scripts.js";
import { focusExistingFacebookVideoTab } from "./facebook-product-video-mining.chrome-tabs.js";
import {
  collectChangedNavigationSignals,
  hasNavigationProofQuorum,
} from "./facebook-product-video-mining.navigation-proof.js";

export type FacebookNavigationAction = {
  acted: boolean;
  action: string;
  text: string | null;
};

export type FacebookNavigationWaitResult = {
  after: FacebookNavigationSignature;
  terminalReason: string | null;
  changedSignals: string[];
  quorumMet: boolean;
};

export const isFacebookPageUrl = (value: string): boolean => {
  if (URL.canParse(value)) {
    const host = new URL(value).host.toLowerCase();
    return host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com";
  }
  return false;
};

export const buildNavigationHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);

export const buildNavigationVideoKey = (signature: FacebookNavigationSignature): string =>
  signature.videoFacts[0]?.currentSrc ?? signature.url;

const captureNavigationSignature = (
  browser: BrowserController,
  description: string,
): Promise<FacebookNavigationSignature> => browser.evaluateActiveTab<FacebookNavigationSignature>({
  description,
  script: buildNavigationSignatureScript(),
});

const pressArrowDownForNextVideo = async (browser: BrowserController): Promise<FacebookNavigationAction> => {
  await browser.textInput({ targetLabel: "press ArrowDown for next Facebook reel", action: "press-key", key: "ArrowDown" }).catch(() => null);
  return { acted: true, action: "arrow_down", text: null };
};

const wheelScrollForNextVideo = async (browser: BrowserController): Promise<FacebookNavigationAction> => {
  await browser.scroll({ targetLabel: "wheel scroll Facebook reels feed", deltaX: 0, deltaY: 900 }).catch(() => null);
  return { acted: true, action: "wheel_scroll_095_viewport", text: null };
};

const safeZoneClickForNextVideo = (
  browser: BrowserController,
): Promise<FacebookNavigationAction> => browser.evaluateActiveTab<FacebookNavigationAction>({
  description: "safe-zone click and scroll for next Facebook video",
  script: buildSafeZoneNavigateToNextVideoScript(),
});

const runFallbackNavigation = async (browser: BrowserController): Promise<FacebookNavigationAction> => {
  await pressArrowDownForNextVideo(browser);
  await wheelScrollForNextVideo(browser);
  return browser.evaluateActiveTab<FacebookNavigationAction>({
    description: "fallback navigate to next Facebook video with ArrowDown and scroll",
    script: buildFallbackNavigateToNextVideoScript(),
  });
};

export const ensureFacebookFeedTab = async (input: {
  browser: BrowserController;
  feedEntryUrl: string;
}): Promise<string | null> => {
  const focusedFacebook = await focusExistingFacebookVideoTab({ preferredUrl: null });
  if (focusedFacebook) return null;
  const opened = await input.browser.open({
    url: input.feedEntryUrl,
    title: "recover Facebook Reels feed before next navigation",
  });
  if (!opened.ok) return "facebook_source_tab_not_found_before_next_navigation";
  await input.browser.wait(1_000);
  return null;
};

const restoreFacebookSourceTab = async (input: {
  browser: BrowserController;
  preferredUrl: string;
}): Promise<boolean> => {
  const focused = await focusExistingFacebookVideoTab({ preferredUrl: input.preferredUrl });
  if (!focused) return false;
  await input.browser.wait(500);
  return true;
};

const isTerminalNavigationBlocker = (
  signature: FacebookNavigationSignature,
): boolean => signature.blockerReason === "facebook_login_required"
  || signature.blockerReason === "facebook_security_or_rate_limit_blocker";

const readNavigationAttempt = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<FacebookNavigationWaitResult> => {
  const after = await captureNavigationSignature(input.browser, "capture Facebook video signature after navigation");
  if (isTerminalNavigationBlocker(after)) {
    return { after, terminalReason: after.blockerReason, changedSignals: [], quorumMet: false };
  }
  if (!isFacebookPageUrl(after.url) && isFacebookPageUrl(input.before.url)) {
    const restored = await restoreFacebookSourceTab({ browser: input.browser, preferredUrl: input.before.url });
    return { after, terminalReason: restored ? null : "facebook_source_tab_not_found_after_ai_feed", changedSignals: [], quorumMet: false };
  }
  const changedSignals = collectChangedNavigationSignals(input.before, after);
  return { after, terminalReason: null, changedSignals, quorumMet: hasNavigationProofQuorum(changedSignals) };
};

const waitForNavigationChange = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<FacebookNavigationWaitResult> => {
  const deadline = Date.now() + 3_000;
  let latest: FacebookNavigationWaitResult = {
    after: input.before,
    terminalReason: null,
    changedSignals: [],
    quorumMet: false,
  };
  while (Date.now() < deadline) {
    latest = await readNavigationAttempt(input);
    if (latest.terminalReason || latest.quorumMet) return latest;
    await input.browser.wait(300);
  }
  return latest;
};

export const runFixedNavigationActionLadder = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
  feedEntryUrl: string;
}): Promise<FacebookNavigationWaitResult & { actionLadder: FacebookNavigationAction[] }> => {
  const actionLadder: FacebookNavigationAction[] = [];
  for (const action of [pressArrowDownForNextVideo, wheelScrollForNextVideo, safeZoneClickForNextVideo, runFallbackNavigation]) {
    actionLadder.push(await action(input.browser));
    const result = await waitForNavigationChange({ browser: input.browser, before: input.before });
    if (result.terminalReason || result.quorumMet) return { ...result, actionLadder };
  }
  const recoverReason = await ensureFacebookFeedTab({ browser: input.browser, feedEntryUrl: input.feedEntryUrl });
  if (recoverReason) return { after: input.before, terminalReason: null, changedSignals: [], quorumMet: false, actionLadder };
  actionLadder.push(await pressArrowDownForNextVideo(input.browser));
  const result = await waitForNavigationChange({ browser: input.browser, before: input.before });
  return { ...result, actionLadder };
};

export const closeCommentSurface = async (browser: BrowserController): Promise<void> => {
  await browser.textInput({
    targetLabel: "close Facebook comment surface before next video navigation",
    action: "press-key",
    key: "Escape",
  }).catch(() => null);
  await browser.wait(500);
};

export const buildNavigationPayload = (input: {
  beforeVideoKey: string;
  afterVideoKey: string;
  actionStrategy: string;
  fallbackUsed: boolean;
}) => ({
  beforeVideoKey: input.beforeVideoKey,
  afterVideoKey: input.afterVideoKey,
  actionStrategy: input.actionStrategy,
  fallbackUsed: input.fallbackUsed,
  recoveryTrail: "facebook-navigation-recovery-trail",
});

export const buildNavigationOutcome = (input: {
  reason: string | null;
  terminalReason: string | null;
  actionStrategy: string;
  beforeHash: string;
  afterHash: string;
}) => ({
  terminal: Boolean(input.terminalReason),
  reason: input.reason,
  failureClass: input.reason ? (input.terminalReason ? "NAVIGATION_FAILURE" : "RECOVERABLE_BROWSER_DRIFT") : null,
  recoveryPolicy: input.reason ? (input.terminalReason ? "review_required" : "retry_next_round") : null,
  recoveryTrail: "facebook-navigation-recovery-trail",
  action: input.actionStrategy,
  beforeHash: input.beforeHash,
  afterHash: input.afterHash,
  durationMs: 0,
});