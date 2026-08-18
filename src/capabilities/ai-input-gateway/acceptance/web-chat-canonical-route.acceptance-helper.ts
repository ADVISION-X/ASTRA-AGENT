import assert from "node:assert/strict";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
  BrowserTargetSession,
} from "../../../lib/browser/browser-controller.js";
import {
  buildCanonicalConversationScript,
  focusChatGptConversationByCanonicalPath,
} from "../runtime/web-chat-single-tab-routing.js";

const browserActionOk: BrowserActionResult = {
  browserActionId: "acceptance-browser-action",
  ok: true,
  message: "ok",
  createdAt: new Date().toISOString(),
};

const browserState = (): BrowserStateSnapshot => ({
  open: true,
  currentUrl: "https://chatgpt.com/",
  currentTitle: "ChatGPT",
  browserExecutable: "fixture",
  browserMode: "fixture",
  browserProfileRef: "fixture",
  browserExecutablePath: null,
  profileStatus: "profile_ready",
  profileDirectory: "fixture",
  profileProvisioning: "managed_default",
  profileVerificationStatus: "default_unverified",
  profileVerificationReason: null,
  loginState: "logged_in",
  lastLoginCheckAt: new Date().toISOString(),
  loginRequiredReason: null,
  reviewRequiredReason: null,
});

class CanonicalRouteBrowser implements BrowserTargetSession {
  readonly observedClicks: Array<{ x: number; y: number }> = [];

  constructor(private readonly evaluations: unknown[]) {}

  getHealth() {
    return { ok: true, detail: "canonical-route acceptance browser" };
  }

  getSessionState(): BrowserStateSnapshot {
    return browserState();
  }

  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    throw new Error("canonical route acceptance does not use geometry snapshots");
  }

  async open(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async scroll(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async click(input: Parameters<BrowserTargetSession["click"]>[0]): Promise<BrowserActionResult> {
    this.observedClicks.push(input.point);
    return browserActionOk;
  }

  async clickLocatedDomElement(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async textInput(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async screenshotRegion(): Promise<BrowserCaptureResult> {
    throw new Error("canonical route acceptance does not use screenshots");
  }

  async evaluate<T>(): Promise<T> {
    return this.evaluations.shift() as T;
  }

  async setFileInputFiles(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async wait(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async closeTarget(): Promise<BrowserActionResult> {
    return browserActionOk;
  }

  async close(): Promise<BrowserActionResult> {
    return browserActionOk;
  }
}

export const assertDuplicateCanonicalDomRowsAreOneLogicalRoute = async (): Promise<void> => {
  const script = buildCanonicalConversationScript({
    targetPath: "/c/exact-canonical",
  });
  assert.equal(script.includes("rows.length > 1"), false);
  assert.equal(script.includes("Number(right.actionable) - Number(left.actionable)"), true);
  assert.equal(script.includes("left.rect.top - right.rect.top"), true);

  const browser = new CanonicalRouteBrowser([
    {
      status: "click_row",
      message: "two DOM renderings, one exact pathname",
      pageUrl: "https://chatgpt.com/",
      markerCount: 0,
      rowCount: 2,
      targetPoint: { x: 80, y: 120 },
    },
    {
      status: "focused",
      message: "exact route and unique marker proved after click",
      pageUrl: "https://chatgpt.com/c/exact-canonical",
      markerCount: 1,
      rowCount: 2,
    },
  ]);
  await assert.doesNotReject(focusChatGptConversationByCanonicalPath({
    base: browser,
    conversationUrl: "https://chatgpt.com/c/exact-canonical",
  }));
  assert.deepEqual(browser.observedClicks, [{ x: 80, y: 120 }]);

  const ambiguousBrowser = new CanonicalRouteBrowser([{
    status: "review_required",
    message: "CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS",
    pageUrl: "https://chatgpt.com/c/exact-canonical",
    markerCount: 2,
    rowCount: 2,
  }]);
  await assert.rejects(
    focusChatGptConversationByCanonicalPath({
      base: ambiguousBrowser,
      conversationUrl: "https://chatgpt.com/c/exact-canonical",
    }),
    /CHATGPT_CANONICAL_CONVERSATION_IDENTITY_AMBIGUOUS/u,
  );
};
