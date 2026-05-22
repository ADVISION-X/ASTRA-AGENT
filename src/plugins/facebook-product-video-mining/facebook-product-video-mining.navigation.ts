import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { focusExistingFacebookVideoTab } from "./facebook-product-video-mining.chrome-tabs.js";
import { logFacebookNavigationDebug } from "./facebook-product-video-mining.logging.js";
import {
  buildFallbackNavigateToNextVideoScript,
  buildNavigateToNextVideoScript,
  buildNavigationSignatureScript,
  buildPrepareForNextVideoScript,
  type FacebookNavigationSignature,
} from "./facebook-product-video-mining.navigation-scripts.js";

export type FacebookMiningRoundOutcome = {
  terminal: boolean;
  reason: string | null;
};

type FacebookNavigationAction = {
  acted: boolean;
  action: string;
  text: string | null;
};

type FacebookNavigationActions = {
  closeAction: FacebookNavigationAction | null;
  navigateAction: FacebookNavigationAction;
  fallbackAction: FacebookNavigationAction | null;
};

type FacebookNavigationWaitResult = {
  after: FacebookNavigationSignature;
  fallbackAction: FacebookNavigationAction | null;
  terminalReason: string | null;
};

const captureNavigationSignature = (
  browser: BrowserController,
  description: string,
): Promise<FacebookNavigationSignature> =>
  browser.evaluateActiveTab<FacebookNavigationSignature>({
    description,
    script: buildNavigationSignatureScript(),
  });

const isFacebookPageUrl = (value: string): boolean => {
  try {
    const host = new URL(value).host.toLowerCase();
    return host === "facebook.com" || host === "www.facebook.com" || host === "m.facebook.com";
  } catch {
    return false;
  }
};

const ensureFacebookFeedTab = async (input: {
  browser: BrowserController;
  feedEntryUrl: string;
}): Promise<string | null> => {
  const focusedFacebook = await focusExistingFacebookVideoTab({ preferredUrl: null });
  if (focusedFacebook) {
    return null;
  }
  const opened = await input.browser.open({
    url: input.feedEntryUrl,
    title: "recover Facebook Reels feed before next navigation",
  });
  if (!opened.ok) {
    return "facebook_source_tab_not_found_before_next_navigation";
  }
  await input.browser.wait(1_000);
  return null;
};

const prepareNextNavigation = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<FacebookNavigationActions> => {
  const closeAction = input.before.activeDialogCount > 0
    ? await input.browser.evaluateActiveTab<FacebookNavigationAction>({
      description: "prepare Facebook feed for next video navigation",
      script: buildPrepareForNextVideoScript(),
    })
    : null;
  const navigateAction = await input.browser.evaluateActiveTab<FacebookNavigationAction>({
    description: "navigate to next Facebook video",
    script: buildNavigateToNextVideoScript(),
  });
  return { closeAction, navigateAction, fallbackAction: null };
};

const restoreFacebookSourceTab = async (input: {
  browser: BrowserController;
  preferredUrl: string;
}): Promise<boolean> => {
  const focused = await focusExistingFacebookVideoTab({ preferredUrl: input.preferredUrl });
  if (!focused) {
    return false;
  }
  await input.browser.evaluateActiveTab<FacebookNavigationAction>({
    description: "retry next Facebook video after tab drift restore",
    script: buildNavigateToNextVideoScript(),
  });
  await input.browser.wait(500);
  return true;
};

const readNavigationAttempt = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<{
  after: FacebookNavigationSignature;
  changed: boolean;
  terminalReason: string | null;
}> => {
  const after = await captureNavigationSignature(input.browser, "capture Facebook video signature after navigation");
  if (!isFacebookPageUrl(after.url) && isFacebookPageUrl(input.before.url)) {
    const restored = await restoreFacebookSourceTab({ browser: input.browser, preferredUrl: input.before.url });
    return {
      after,
      changed: false,
      terminalReason: restored ? null : "facebook_source_tab_not_found_after_ai_feed",
    };
  }
  return {
    after,
    changed: input.before.signature !== after.signature,
    terminalReason: null,
  };
};

const runFallbackNavigation = async (browser: BrowserController): Promise<FacebookNavigationAction> => {
  await browser.textInput({
    targetLabel: "fallback press ArrowDown for next Facebook reel",
    action: "press-key",
    key: "ArrowDown",
  }).catch(() => null);
  await browser.scroll({
    targetLabel: "fallback scroll Facebook reels feed",
    deltaX: 0,
    deltaY: 900,
  }).catch(() => null);
  return browser.evaluateActiveTab<FacebookNavigationAction>({
    description: "fallback navigate to next Facebook video with ArrowDown and scroll",
    script: buildFallbackNavigateToNextVideoScript(),
  });
};

const finalizeNavigationWait = (input: {
  before: FacebookNavigationSignature;
  after: FacebookNavigationSignature;
  fallbackAction: FacebookNavigationAction | null;
}): FacebookNavigationWaitResult => ({
  after: input.after,
  fallbackAction: input.fallbackAction,
  terminalReason: input.before.signature === input.after.signature ? "next_video_did_not_change" : null,
});

const waitForNavigationChange = async (input: {
  browser: BrowserController;
  before: FacebookNavigationSignature;
}): Promise<FacebookNavigationWaitResult> => {
  const deadline = Date.now() + 8_000;
  let after = input.before;
  let fallbackAction: FacebookNavigationAction | null = null;
  while (Date.now() < deadline) {
    const attempt = await readNavigationAttempt(input);
    after = attempt.after;
    if (attempt.terminalReason || attempt.changed) {
      return { after, fallbackAction, terminalReason: attempt.terminalReason };
    }
    if (!fallbackAction && Date.now() > deadline - 5_500) {
      fallbackAction = await runFallbackNavigation(input.browser);
    }
    await input.browser.wait(300);
  }
  return finalizeNavigationWait({ before: input.before, after, fallbackAction });
};

const closeCommentSurface = async (browser: BrowserController): Promise<void> => {
  await browser.textInput({
    targetLabel: "close Facebook comment surface before next video navigation",
    action: "press-key",
    key: "Escape",
  }).catch(() => null);
  await browser.wait(500);
};

export const navigateToNextFacebookVideo = async (input: {
  browser: BrowserController;
  logger: RuntimeLogger;
  runId: string;
  missionId: string;
  roundId: string;
  feedEntryUrl: string;
}): Promise<FacebookMiningRoundOutcome> => {
  const sourceTabFailureReason = await ensureFacebookFeedTab({
    browser: input.browser,
    feedEntryUrl: input.feedEntryUrl,
  });
  if (sourceTabFailureReason) {
    return { terminal: true, reason: sourceTabFailureReason };
  }
  await closeCommentSurface(input.browser);
  const before = await captureNavigationSignature(input.browser, "capture Facebook video signature before navigation");
  const actions = await prepareNextNavigation({ browser: input.browser, before });
  const { after, fallbackAction, terminalReason } = await waitForNavigationChange({
    browser: input.browser,
    before,
  });
  logFacebookNavigationDebug({
    logger: input.logger,
    runId: input.runId,
    missionId: input.missionId,
    roundId: input.roundId,
    status: terminalReason ? "review_required" : "success",
    reason: terminalReason,
    before,
    after,
    action: { ...actions, fallbackAction },
  });
  return { terminal: Boolean(terminalReason), reason: terminalReason };
};