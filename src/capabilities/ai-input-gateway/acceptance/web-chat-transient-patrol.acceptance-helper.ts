import assert from "node:assert/strict";

import type {
  BrowserActionResult,
  BrowserTargetSession,
} from "../../../lib/browser/browser-controller.js";
import { waitForStableAnswer } from "../providers/web-chat-answer.js";

const actionResult = (): BrowserActionResult => ({
  browserActionId: "transient-patrol-acceptance",
  ok: true,
  message: "acceptance action completed",
  createdAt: new Date().toISOString(),
});

const browserState = () => ({
  browserMode: "fixture" as const,
  browserProfileRef: "acceptance",
  browserExecutablePath: null,
  profileStatus: "profile_ready" as const,
  profileDirectory: "acceptance",
  profileProvisioning: "operator_supplied" as const,
  profileVerificationStatus: "operator_verified" as const,
  profileVerificationReason: null,
  loginState: "logged_in" as const,
  currentUrl: "https://chatgpt.com/c/transient-patrol",
  lastLoginCheckAt: null,
  loginRequiredReason: null,
  reviewRequiredReason: null,
  open: true,
  currentTitle: "ChatGPT",
  browserExecutable: null,
});

const geometrySnapshot = () => ({
  windowX: 0,
  windowY: 0,
  viewportWidth: 1,
  viewportHeight: 1,
  screenshotWidth: 1,
  screenshotHeight: 1,
  scaleFactor: 1,
  currentUrl: "https://chatgpt.com/c/transient-patrol",
  pageTitle: "ChatGPT",
  visibleContentBounds: { x: 0, y: 0, width: 1, height: 1 },
  capturedAt: new Date().toISOString(),
});

const screenshotCapture = () => ({
  ...actionResult(),
  pageUrl: "https://chatgpt.com/c/transient-patrol",
  pageTitle: "ChatGPT",
  regionLabel: "acceptance",
  regionType: "fixture",
  width: 1,
  height: 1,
  viewportWidth: 1,
  viewportHeight: 1,
  sourceFilePath: "/tmp/transient-patrol.png",
});

const answerEvaluation = <T>(): T => ({
  status: "success",
  message: "exact marked answer completed",
  answerText: "completed answer",
  pageUrl: "https://chatgpt.com/c/transient-patrol",
  generating: false,
  assistantCount: 1,
  userMessageCount: 1,
  conversationTurnIds: ["conversation-turn-1", "conversation-turn-2"],
} as T);

const createTransientPatrolBrowser = (
  onWait: () => void,
): BrowserTargetSession => ({
    getHealth: () => ({ ok: true, detail: "acceptance browser" }),
    getSessionState: browserState,
    getGeometrySnapshot: async () => geometrySnapshot(),
    open: async () => actionResult(),
    scroll: async () => actionResult(),
    click: async () => actionResult(),
    clickLocatedDomElement: async () => actionResult(),
    textInput: async () => actionResult(),
    screenshotRegion: async () => screenshotCapture(),
    evaluate: async <T>() => answerEvaluation<T>(),
    setFileInputFiles: async () => actionResult(),
    wait: async () => {
      onWait();
      return actionResult();
    },
    closeTarget: async () => actionResult(),
    close: async () => actionResult(),
});

export const assertTransientPatrolRemainsRetryable = async (): Promise<void> => {
  let attempts = 0;
  let waits = 0;
  const browser = createTransientPatrolBrowser(() => {
    waits += 1;
  });
  const result = await waitForStableAnswer({
    browser,
    context: { dataDir: "/tmp" },
    timeoutMs: 2_000,
    pollIntervalMs: 1,
    stableRoundsRequired: 1,
    beforePoll: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error(
          "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact submitted ChatGPT sidebar row is not ready for marker verification",
        );
      }
    },
  });
  assert.equal(result.status, "success");
  assert.equal(attempts, 2);
  assert.equal(
    waits,
    1,
    "a not-yet-ready submitted sidebar row must wait and retry without escaping as review_required",
  );
};
