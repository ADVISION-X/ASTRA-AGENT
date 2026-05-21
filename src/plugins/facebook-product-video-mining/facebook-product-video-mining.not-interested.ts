import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  FACEBOOK_LOGIN_BLOCKER_PATTERNS,
  FACEBOOK_MORE_MENU_PATTERNS,
  FACEBOOK_NOT_INTERESTED_PATTERNS,
  FACEBOOK_SECURITY_BLOCKER_PATTERNS,
} from "./facebook-product-video-mining.hints.js";
import type { FacebookProductVideoMiningContracts } from "./facebook-product-video-mining.schema.js";

type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

export type FacebookNotInterestedActionResult = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  selectedText: string | null;
};

type RawMenuAction = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  selectedText: string | null;
};

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
): Promise<RawMenuAction | null> => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await browser.evaluateActiveTab<RawMenuAction>({
      description: "check Facebook not interested option presence",
      script: buildClickNotInterestedScript().replace("option.click();", ""),
    });
    if (result.status === "success") {
      return null;
    }
    await browser.wait(300);
  }
  return { status: "review_required", reason: "not_interested_option_not_found", selectedText: null };
};

export const clickFacebookNotInterested = async (input: {
  browser: BrowserController;
  probe: FacebookVideoDomProbeResult;
}): Promise<FacebookNotInterestedActionResult> => {
  const opened = await input.browser.evaluateActiveTab<RawMenuAction>({
    description: "open Facebook video more menu",
    script: buildOpenMoreMenuScript(input.probe.moreMenuElementRef?.selector ?? null),
  });
  if (opened.status !== "success") {
    return opened;
  }
  const waitFailure = await waitForNotInterestedOption(input.browser);
  if (waitFailure) return waitFailure;
  return input.browser.evaluateActiveTab<RawMenuAction>({
    description: "click Facebook not interested option",
    script: buildClickNotInterestedScript(),
  });
};
