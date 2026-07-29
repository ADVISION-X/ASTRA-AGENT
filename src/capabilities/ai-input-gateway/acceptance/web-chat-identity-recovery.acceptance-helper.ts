import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { classifyWebChatFailure } from "../failure-classification.js";
import { resolveManagedGptPollIntervalMs } from "../providers/web-chat-response-capture.js";
import { checkAiFeedRateGuard } from "../runtime/ai-feed-rate-guard.js";
import {
  startOrResumeWebChatExecution,
  updateWebChatExecution,
} from "../runtime/web-chat-execution-state.js";
import {
  assertWebChatCanonicalConversationBinding,
  resolveContinuationWebChatSystemTitle,
} from "../runtime/web-chat-continuation-title.js";
import { buildHumanReadableSystemChatTitle } from "../runtime/web-chat-system-title.js";

const assertHumanReadableTitles = (): void => {
  const seoTitle = buildHumanReadableSystemChatTitle({
    labelKey: "seo_research",
    executionId: "xuanyuan_example-seo-task",
    turnMarker: "GRASSEYE_TURN_1234567890abcdef",
    createdAt: "2026-07-26T04:40:00.000Z",
  });
  assert.match(
    seoTitle,
    /^SEO资料研究｜07-26 04:40Z｜[A-F0-9]{8}-CDEF$/u,
    "SEO conversations must have a readable task label, UTC time and short trace",
  );
  assert.doesNotMatch(
    seoTitle,
    /public-knowledge|xuanyuan|GRASSEYE_TURN/u,
    "readable titles must not expose transport ids or raw contract vocabulary",
  );
  assert.match(
    buildHumanReadableSystemChatTitle({
      labelKey: "bazi_analysis",
      executionId: "xuanyuan_example-bazi-task",
      turnMarker: "GRASSEYE_TURN_abcdef1234567890",
      createdAt: "2026-07-26T04:41:00.000Z",
    }),
    /^八字分析｜07-26 04:41Z｜[A-F0-9]{8}-7890$/u,
    "known business contracts must resolve to a human-readable allowlisted label",
  );
  assert.match(
    buildHumanReadableSystemChatTitle({
      labelKey: "generic_ai",
      executionId: "xuanyuan_example-generic-task",
      turnMarker: "GRASSEYE_TURN_1234567890abcdef",
      createdAt: "2026-07-26T04:42:00.000Z",
    }),
    /^AI任务｜07-26 04:42Z｜[A-F0-9]{8}-CDEF$/u,
    "unknown contracts must use the neutral internal fallback without copying caller text",
  );
};

const assertProviderFailuresRemainRecoverable = (): void => {
  assert.equal(resolveManagedGptPollIntervalMs(""), 5_000);
  assert.equal(resolveManagedGptPollIntervalMs("1000"), 1_000);
  assert.throws(
    () => resolveManagedGptPollIntervalMs("999"),
    /WEB_CHAT_PATROL_INTERVAL_MS/u,
  );
  for (const reason of [
    "GPT_PROMPT_MISMATCH; controlled Chrome tab is not active",
    "GPT_PROMPT_MISMATCH; 不能获取对象。 (-1728)",
    "review_required: NATIVE_FILE_LIST_MISMATCH",
    "review_required: WEB_CHAT_COMPOSER_CLEAR_ACTION_UNPROVEN; provider composer not uniquely found",
    "osascript exited with code unknown",
  ]) {
    assert.equal(
      classifyWebChatFailure(new Error(reason), false),
      "recovery_pending",
      `transient provider failure must remain retryable: ${reason}`,
    );
  }
  const missingConversationReason =
    "review_required: locate exact system-renamed ChatGPT search result timed out";
  assert.equal(
    classifyWebChatFailure(
      new Error(missingConversationReason),
      true,
      Array.from({ length: 20 }, () => missingConversationReason),
    ),
    "recovery_pending",
    "an exact submitted conversation lookup never becomes a user-visible terminal block because of retry count",
  );
  assert.equal(
    classifyWebChatFailure(
      new Error("review_required: web-chat execution is terminal: failed"),
      false,
    ),
    "recovery_pending",
    "a legacy terminal-state echo without its root cause must receive one recovery pass",
  );
  assert.equal(
    classifyWebChatFailure(
      new Error(
        "review_required: web-chat execution is terminal: failed; root=review_required: WEB_CHAT_COMPOSER_CLEAR_ACTION_UNPROVEN; provider composer not uniquely found",
      ),
      false,
    ),
    "recovery_pending",
    "a terminal-state echo must inherit its recoverable root cause",
  );
  assert.equal(
    classifyWebChatFailure(
      new Error(
        "review_required: web-chat execution is terminal: failed; root=invalid immutable input identity",
      ),
      false,
    ),
    "failed",
    "a terminal-state echo must not conceal a genuinely immutable root failure",
  );
};

const assertCorrectedIdentityStartsFreshAttempt = async (): Promise<void> => {
  const retryStateDir = await mkdtemp(
    path.join(os.tmpdir(), "grasseye-web-chat-attempt-restart-"),
  );
  try {
    const retryExecutionId = "xuanxue-ai-production:qimen-retry:followup";
    const initialRetryState = await startOrResumeWebChatExecution({
      dataDir: retryStateDir,
      executionId: retryExecutionId,
      providerKind: "gpt-web-chat",
      taskLabelKey: "hehun_analysis",
      inputHash: "qimen-retry-input",
      textPrompt: "qimen retry prompt",
    });
    const failedRetryState = await updateWebChatExecution({
      dataDir: retryStateDir,
      record: initialRetryState.record,
      patch: {
        status: "failed",
        failures: [{
          occurredAt: new Date().toISOString(),
          attemptId: initialRetryState.record.attemptId,
          phase: "submitting",
          classification: "failed",
          recoverable: false,
          reason: "osascript exited with code unknown",
        }, {
          occurredAt: new Date().toISOString(),
          attemptId: initialRetryState.record.attemptId,
          phase: "failed",
          classification: "review_required",
          recoverable: false,
          reason:
            "review_required: persisted web-chat execution identity does not match the requested feed.",
        }],
      },
    });
    const repairedRetryState = await startOrResumeWebChatExecution({
      dataDir: retryStateDir,
      executionId: retryExecutionId,
      providerKind: "gpt-web-chat",
      taskLabelKey: "qimen_analysis",
      inputHash: "qimen-retry-input-corrected-label",
      textPrompt: "qimen retry prompt",
    });
    assert.equal(repairedRetryState.resume, false);
    assert.equal(repairedRetryState.record.status, "recovery_pending");
    assert.notEqual(
      repairedRetryState.record.attemptId,
      failedRetryState.attemptId,
    );
    assert.notEqual(
      repairedRetryState.record.turnMarker,
      failedRetryState.turnMarker,
    );
    assert.equal(
      repairedRetryState.record.inputHash,
      "qimen-retry-input-corrected-label",
    );
    assert.match(repairedRetryState.record.systemChatTitle ?? "", /^奇门分析｜/u);
    assert.equal(repairedRetryState.record.failures.length, 2);
  } finally {
    await rm(retryStateDir, { recursive: true, force: true });
  }
};

const assertMultipleTransientFailuresRemainRecoverable =
  async (): Promise<void> => {
    const dataDir = await mkdtemp(
      path.join(os.tmpdir(), "grasseye-web-chat-multi-recovery-"),
    );
    try {
      const input = {
        dataDir,
        executionId: "xuanxue-ai-production:multi-recovery:stage",
        providerKind: "gpt-web-chat" as const,
        taskLabelKey: "hehun_analysis" as const,
        inputHash: "multi-recovery-input",
        textPrompt: "same immutable prompt",
      };
      const initial = await startOrResumeWebChatExecution(input);
      const failed = await updateWebChatExecution({
        dataDir,
        record: initial.record,
        patch: {
          status: "failed",
          failures: [
            {
              occurredAt: new Date().toISOString(),
              attemptId: initial.record.attemptId,
              phase: "submitting",
              classification: "recovery_pending",
              recoverable: true,
              reason:
                "WEB_CHAT_CONTINUATION_HISTORY_NOT_STABLE: parent still hydrating",
            },
            {
              occurredAt: new Date().toISOString(),
              attemptId: initial.record.attemptId,
              phase: "submitting",
              classification: "failed",
              recoverable: false,
              reason:
                "review_required: WEB_CHAT_COMPOSER_CLEAR_ACTION_UNPROVEN; provider composer not uniquely found",
            },
            {
              occurredAt: new Date().toISOString(),
              attemptId: initial.record.attemptId,
              phase: "failed",
              classification: "failed",
              recoverable: false,
              reason:
                "review_required: web-chat execution is terminal: failed",
            },
          ],
        },
      });
      const recovered = await startOrResumeWebChatExecution(input);
      assert.equal(recovered.resume, false);
      assert.equal(recovered.record.status, "recovery_pending");
      assert.equal(recovered.record.executionId, failed.executionId);
      assert.equal(recovered.record.turnMarker, failed.turnMarker);
      assert.notEqual(recovered.record.attemptId, failed.attemptId);
      assert.equal(recovered.record.failures.length, 3);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  };

const assertFeedRateIdentity = (): void => {
  const guardedRoundId = `same-execution-retry:${Date.now()}`;
  const guardedExecutionId = "xuanxue-ai-production:retry-owner";
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId: guardedRoundId,
    transport: "web-chat",
    executionId: guardedExecutionId,
    supersededExecutionId: null,
  }).ok, true);
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId: guardedRoundId,
    transport: "web-chat",
    executionId: guardedExecutionId,
    supersededExecutionId: null,
  }).ok, true, "the same durable execution may retry without becoming a duplicate task");
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId: guardedRoundId,
    transport: "web-chat",
    executionId: "xuanxue-ai-production:different-owner",
    supersededExecutionId: null,
  }).ok, false, "a different execution must remain blocked from duplicating the same round input");
  const replacementExecutionId =
    "xuanxue-ai-production:authorized-replacement";
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId: guardedRoundId,
    transport: "web-chat",
    executionId: replacementExecutionId,
    supersededExecutionId: guardedExecutionId,
  }).ok, true, "an explicit fresh execution may replace only its exact retired owner");
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId: guardedRoundId,
    transport: "web-chat",
    executionId: guardedExecutionId,
    supersededExecutionId: null,
  }).ok, false, "a retired execution cannot reclaim the round after replacement");
};

const assertCanonicalConversationOwnership = async (): Promise<void> => {
  const stateDir = await mkdtemp(
    path.join(os.tmpdir(), "grasseye-web-chat-conversation-owner-"),
  );
  try {
    const owner = await startOrResumeWebChatExecution({
      dataDir: stateDir,
      executionId: "xuanxue-ai-production:owner:base",
      providerKind: "gpt-web-chat",
      taskLabelKey: "bazi_analysis",
      inputHash: "owner-input",
      textPrompt: "owner prompt",
    });
    await updateWebChatExecution({
      dataDir: stateDir,
      record: owner.record,
      patch: {
        status: "conversation_canonicalized",
        submission: {
          transientConversationUrl: "https://chatgpt.com/",
          canonicalConversationUrl:
            "https://chatgpt.com/c/already-owned-conversation",
          systemChatTitle: null,
          observedAutoChatTitle: null,
          chatTitleVerifiedAt: null,
          userTurnId: "conversation-turn-1",
          previousAssistantCount: 0,
          previousUserMessageCount: 0,
          submittedAt: new Date().toISOString(),
        },
      },
    });
    await assert.rejects(
      assertWebChatCanonicalConversationBinding({
        dataDir: stateDir,
        executionId: "xuanxue-ai-production:foreign:base",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl:
          "https://chatgpt.com/c/already-owned-conversation?model=auto",
        continuationConversationUrl: null,
      }),
      /WEB_CHAT_CANONICAL_CONVERSATION_ALREADY_BOUND/u,
      "a fresh order must never reuse another execution's canonical chat",
    );
    await assert.doesNotReject(
      assertWebChatCanonicalConversationBinding({
        dataDir: stateDir,
        executionId: "xuanxue-ai-production:owner:followup",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl:
          "https://chatgpt.com/c/already-owned-conversation",
        continuationConversationUrl:
          "https://chatgpt.com/c/already-owned-conversation",
      }),
      "an explicit continuation must remain in its exact parent chat",
    );
    await assert.rejects(
      assertWebChatCanonicalConversationBinding({
        dataDir: stateDir,
        executionId: "xuanxue-ai-production:owner:wrong-followup",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl:
          "https://chatgpt.com/c/different-conversation",
        continuationConversationUrl:
          "https://chatgpt.com/c/already-owned-conversation",
      }),
      /WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT/u,
      "a continuation must never drift away from its exact parent chat",
    );
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
};

const assertContinuationInheritsParentSystemTitle =
  async (): Promise<void> => {
    const stateDir = await mkdtemp(
      path.join(os.tmpdir(), "grasseye-web-chat-parent-title-"),
    );
    try {
      const parent = await startOrResumeWebChatExecution({
        dataDir: stateDir,
        executionId: "xuanxue-ai-production:stable-title:base",
        providerKind: "gpt-web-chat",
        taskLabelKey: "naming_analysis",
        inputHash: "stable-title-parent-input",
        textPrompt: "stable title parent prompt",
      });
      const parentUrl =
        "https://chatgpt.com/c/stable-parent-conversation";
      const persistedParent = await updateWebChatExecution({
        dataDir: stateDir,
        record: parent.record,
        patch: {
          status: "waiting_provider",
          submission: {
            transientConversationUrl: parentUrl,
            canonicalConversationUrl: parentUrl,
            systemChatTitle: parent.record.systemChatTitle,
            observedAutoChatTitle: null,
            chatTitleVerifiedAt: "2026-07-29T10:00:00.000Z",
            userTurnId: "conversation-turn-1",
            previousAssistantCount: 0,
            previousUserMessageCount: 0,
            submittedAt: new Date().toISOString(),
          },
        },
      });
      const pollutedLaterStage = await startOrResumeWebChatExecution({
        dataDir: stateDir,
        executionId: "xuanxue-ai-production:stable-title:later-stage",
        providerKind: "gpt-web-chat",
        taskLabelKey: "naming_analysis",
        inputHash: "stable-title-later-input",
        textPrompt: "stable title later prompt",
      });
      await updateWebChatExecution({
        dataDir: stateDir,
        record: pollutedLaterStage.record,
        patch: {
          status: "response_captured",
          submission: {
            transientConversationUrl: parentUrl,
            canonicalConversationUrl: parentUrl,
            systemChatTitle: pollutedLaterStage.record.systemChatTitle,
            observedAutoChatTitle: null,
            chatTitleVerifiedAt: "2026-07-29T10:05:00.000Z",
            userTurnId: "conversation-turn-3",
            previousAssistantCount: 1,
            previousUserMessageCount: 1,
            submittedAt: "2026-07-29T10:04:00.000Z",
          },
        },
      });
      assert.equal(
        await resolveContinuationWebChatSystemTitle({
          dataDir: stateDir,
          providerKind: "gpt-web-chat",
          canonicalConversationUrl: parentUrl,
        }),
        persistedParent.systemChatTitle,
        "every continuation must inherit the earliest verified whole-order parent title and collapse legacy later-stage title pollution without blocking",
      );
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
  };

export const assertWebChatIdentityAndRecoveryPolicies =
  async (): Promise<void> => {
    assertHumanReadableTitles();
    assertProviderFailuresRemainRecoverable();
    await assertCorrectedIdentityStartsFreshAttempt();
    await assertMultipleTransientFailuresRemainRecoverable();
    await assertCanonicalConversationOwnership();
    await assertContinuationInheritsParentSystemTitle();
    assertFeedRateIdentity();
  };
