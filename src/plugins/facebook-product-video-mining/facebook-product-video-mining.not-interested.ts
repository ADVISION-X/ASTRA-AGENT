import { createHash } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import {
  FACEBOOK_LOGIN_BLOCKER_PATTERNS,
  FACEBOOK_MORE_MENU_PATTERNS,
  FACEBOOK_NOT_INTERESTED_PATTERNS,
  FACEBOOK_SECURITY_BLOCKER_PATTERNS,
} from "./facebook-product-video-mining.hints.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";

type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type FacebookNotInterestedActionResult = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  selectedText: string | null;
};

type RawMenuAction = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  selectedText: string | null;
};

type ClickFacebookNotInterestedInput = {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  probe: FacebookVideoDomProbeResult;
};

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;

const patternSource = (patterns: readonly RegExp[]): string =>
  patterns.map((pattern) => pattern.source).join("|");

const buildOpenMoreMenuScript = (selector: string | null): string => `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const bodyText = clip(document.body?.innerText || "");
if (/${patternSource(FACEBOOK_LOGIN_BLOCKER_PATTERNS)}/iu.test(bodyText) || /${patternSource(FACEBOOK_SECURITY_BLOCKER_PATTERNS)}/iu.test(bodyText)) {
  return {status: "review_required", reason: "facebook_session_blocked", selectedText: null};
}
let entry = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : "null"};
if (!entry) {
  entry = Array.from(document.querySelectorAll("button, a, div[role='button'], span[role='button'], [aria-label]")).find((node) => /${patternSource(FACEBOOK_MORE_MENU_PATTERNS)}/iu.test(clip(node.getAttribute("aria-label") || node.textContent || "")));
}
if (!(entry instanceof HTMLElement)) {
  return {status: "review_required", reason: "more_menu_not_found", selectedText: null};
}
entry.click();
return {status: "success", reason: null, selectedText: null};
`;

const buildClickNotInterestedScript = (): string => `
const clip = (value) => String(value || "").replace(/\\s+/g, " ").trim();
const candidates = Array.from(document.querySelectorAll("button, a, div[role='menuitem'], div[role='button'], span[role='button'], li"));
const option = candidates.find((node) => {
  const text = clip(node.getAttribute("aria-label") || node.textContent || "");
  if (!/${patternSource(FACEBOOK_NOT_INTERESTED_PATTERNS)}/iu.test(text)) return false;
  return !/delete|report|block|举报|屏蔽/iu.test(text);
});
if (!(option instanceof HTMLElement)) {
  return {status: "review_required", reason: "not_interested_option_not_found", selectedText: null};
}
const selectedText = clip(option.getAttribute("aria-label") || option.textContent || "");
option.click();
return {status: "success", reason: null, selectedText};
`;

const waitForNotInterestedOption = async (
  browser: BrowserController,
): Promise<boolean> => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await browser.evaluateActiveTab<RawMenuAction>({
      description: "check Facebook not interested option presence",
      script: buildClickNotInterestedScript().replace("option.click();", ""),
    });
    if (result.status === "success") {
      return true;
    }
    await browser.wait(300);
  }
  return false;
};

const createFacebookRoundTrace = (input: {
  missionId: string;
  runId: string;
  roundId: string;
}) => withRoundTrace({
  context: createMissionTrace({
    missionId: input.missionId,
    runId: input.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  }),
  roundId: input.roundId,
});

const buildNotInterestedHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);

const buildNotInterestedPayload = (action: string) => ({
  action,
  fallback: "skip_round",
  recoveryTrail: "facebook-not-interested-recovery-trail",
});

const buildNotInterestedHashes = (beforeHash: string) => ({ beforeHash, afterHash: beforeHash });

const buildNotInterestedWaitFailure = () => ({
  status: "review_required",
  reason: "not_interested_option_not_found",
  selectedText: null,
}) as const;

export const clickFacebookNotInterested = async (input: ClickFacebookNotInterestedInput): Promise<FacebookNotInterestedActionResult> => {
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const traceContext = createFacebookRoundTrace(input);
  const beforeHash = buildNotInterestedHash(input.probe.facebookVideoId ?? input.roundId);
  const notInterestedStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_NOT_INTERESTED",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    payload: buildNotInterestedPayload("click_not_interested"),
  });
  const opened = await input.browser.evaluateActiveTab<RawMenuAction>({
    description: "open Facebook video more menu",
    script: buildOpenMoreMenuScript(input.probe.moreMenuElementRef?.selector ?? null),
  });
  if (opened.status !== "success") {
    notInterestedStage.fail({
      reason: opened.reason ?? opened.status,
      failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
      retryable: false,
      terminal: false,
      recoveryPolicy: "skip_round",
      hashes: buildNotInterestedHashes(beforeHash),
      payload: buildNotInterestedPayload("open_more_menu"),
    });
    return opened;
  }
  const optionReady = await waitForNotInterestedOption(input.browser);
  if (!optionReady) {
    const waitFailure = buildNotInterestedWaitFailure();
    notInterestedStage.fail({
      reason: waitFailure.reason ?? waitFailure.status,
      failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
      retryable: false,
      terminal: false,
      recoveryPolicy: "skip_round",
      hashes: buildNotInterestedHashes(beforeHash),
      payload: buildNotInterestedPayload("wait_not_interested_option"),
    });
    return waitFailure;
  }
  const result = await input.browser.evaluateActiveTab<RawMenuAction>({
    description: "click Facebook not interested option",
    script: buildClickNotInterestedScript(),
  });
  if (result.status !== "success") {
    notInterestedStage.fail({
      reason: result.reason ?? result.status,
      failureClass: RuntimeFailureClass.RECOVERABLE_BROWSER_DRIFT,
      retryable: false,
      terminal: false,
      recoveryPolicy: "skip_round",
      hashes: buildNotInterestedHashes(beforeHash),
      payload: buildNotInterestedPayload("click_not_interested"),
    });
    return result;
  }
  const afterHash = buildNotInterestedHash(result.selectedText ?? input.probe.facebookVideoId ?? input.roundId);
  notInterestedStage.complete({
    durationMs: 0,
    hashes: { beforeHash, afterHash },
    payload: buildNotInterestedPayload("click_not_interested"),
  });
  return result;
};
