import assert from "node:assert/strict";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { waitForStableAnswer } from "../providers/web-chat-answer.js";

type StableAnswerBrowser = Pick<BrowserTargetLease, "executeDomIntent" | "wait">;

class TransientPatrolBrowser implements StableAnswerBrowser {
  public constructor(private readonly onWait: () => void) {}

  public async executeDomIntent(intent: Parameters<BrowserTargetLease["executeDomIntent"]>[0]): Promise<unknown> {
    if (intent.kind === "document") return { url: "https://chatgpt.com/c/transient-patrol", title: "ChatGPT" };
    if (intent.kind === "find") {
      const selector = intent.selector ?? "";
      if (selector.includes("assistant")) return { count: 1 };
      if (selector.includes("user")) return { count: 1 };
      if (selector.includes("Stop")) return { count: 0 };
      throw new Error("BROWSER_TARGET_INVALID");
    }
    if (intent.kind === "readText") return "completed answer";
    throw new Error("BROWSER_TARGET_INVALID");
  }

  public async wait(): Promise<void> {
    this.onWait();
  }
}

export const assertTransientPatrolRemainsRetryable = async (): Promise<void> => {
  let attempts = 0;
  let waits = 0;
  const browser = new TransientPatrolBrowser(() => {
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
