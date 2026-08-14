import assert from "node:assert/strict";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import {
  interruptedRenameEditorIdentityMatches,
  RENAME_PATROL_SLICE_MS,
  runBoundedRenamePatrols,
} from "../providers/web-chat-chat-title.js";

const assertBoundedRenamePatrol = async (): Promise<void> => {
  let now = 0;
  let attempt = 0;
  let queuedSubmission = false;
  const order: string[] = [];
  const transactionStarts: string[][] = [];
  const result = await runBoundedRenamePatrols({
    timeoutMs: 31_000,
    now: () => now,
    wait: async (durationMs) => {
      order.push(`wait-${durationMs}`);
      now += durationMs;
      queuedSubmission = true;
    },
    runExclusivePatrol: async (operation) => {
      if (queuedSubmission) {
        order.push("queued-submission");
        queuedSubmission = false;
      }
      const patrolNumber = attempt + 1;
      order.push(`patrol-${patrolNumber}-acquire`);
      try {
        return await operation({} as BrowserTargetSession);
      } finally {
        order.push(`patrol-${patrolNumber}-release`);
      }
    },
    runTransaction: async (_browser, patrolSliceMs) => {
      attempt += 1;
      transactionStarts.push(["canonical-url", "marker", "row-trigger"]);
      order.push(`rename-${attempt}-start`);
      assert.equal(patrolSliceMs, RENAME_PATROL_SLICE_MS);
      if (attempt === 1) {
        now += patrolSliceMs;
        throw new Error("WEB_CHAT_RENAME_NOT_READY: atomic rename patrol slice expired");
      }
      return "fixture-auto-title";
    },
  });
  assert.equal(result, "fixture-auto-title");
  assert.deepEqual(transactionStarts, [
    ["canonical-url", "marker", "row-trigger"],
    ["canonical-url", "marker", "row-trigger"],
  ], "a timed-out patrol must requeue the whole identity-bound rename transaction");
  assert.deepEqual(order, [
    "patrol-1-acquire",
    "rename-1-start",
    "patrol-1-release",
    "wait-500",
    "queued-submission",
    "patrol-2-acquire",
    "rename-2-start",
    "patrol-2-release",
  ], "a fifteen-second patrol must release before a queued submission and the next whole rename attempt");
};

const assertInterruptedRenameIdentity = (): void => {
  const exactObservation = {
    status: "success" as const,
    message: "observed",
    pageUrl: "https://chatgpt.com/c/exact",
    rowConversationUrl: "https://chatgpt.com/c/exact",
    markerCount: 1,
    rowTriggerId: "conversation-exact-trigger",
    rowTriggerControls: "conversation-exact-menu",
    textboxLabelledBy: "conversation-exact-trigger",
    textboxControls: null,
  };
  assert.equal(interruptedRenameEditorIdentityMatches({
    canonicalConversationUrl: "https://chatgpt.com/c/exact",
    observation: exactObservation,
  }), true);
  for (const observation of [
    { ...exactObservation, pageUrl: "https://chatgpt.com/c/foreign" },
    { ...exactObservation, rowConversationUrl: "https://chatgpt.com/c/foreign" },
    { ...exactObservation, markerCount: 0 },
    { ...exactObservation, textboxLabelledBy: "foreign-trigger" },
  ]) {
    assert.equal(interruptedRenameEditorIdentityMatches({
      canonicalConversationUrl: "https://chatgpt.com/c/exact",
      observation,
    }), false, "interrupted rename recovery must reject foreign URL, marker or row-trigger identity");
  }
};

export const assertRenamePatrolBehavior = async (): Promise<void> => {
  await assertBoundedRenamePatrol();
  assertInterruptedRenameIdentity();
};
