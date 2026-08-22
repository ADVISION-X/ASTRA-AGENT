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
  resolveSubmittedDraftOwnerByTurnMarker,
} from "../runtime/web-chat-canonical-binding.js";
import { assertDuplicateCanonicalDomRowsAreOneLogicalRoute } from "./web-chat-canonical-route.acceptance-helper.js";

const assertProviderFailuresRemainRecoverable = (): void => {
  assert.equal(resolveManagedGptPollIntervalMs(""), 5_000);
  assert.equal(resolveManagedGptPollIntervalMs("1000"), 1_000);
  assert.throws(
    () => resolveManagedGptPollIntervalMs("999"),
    /WEB_CHAT_PATROL_INTERVAL_MS/u,
  );
  for (const reason of [
    "GPT_PROMPT_MISMATCH; controlled Chrome tab is not active",
    "review_required: NATIVE_FILE_LIST_MISMATCH",
    "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical row is still hydrating",
    "TRANSPORT_DISCONNECTED:TARGET_EVALUATION_FAILED:SyntaxError: corrected browser script may resume",
    "review_required: the exact provider target is not acquired.",
  ]) {
    assert.equal(
      classifyWebChatFailure(new Error(reason), true),
      "recovery_pending",
      `transient provider failure must remain retryable: ${reason}`,
    );
  }
  assert.equal(
    classifyWebChatFailure(
      new Error("review_required: web-chat execution is terminal: failed"),
      false,
    ),
    "recovery_pending",
  );
  assert.equal(
    classifyWebChatFailure(
      new Error("WEB_CHAT_FRESH_CONVERSATION_HYDRATION_PENDING: BROWSER_TARGET_INVALID"),
      false,
    ),
    "recovery_pending",
    "pre-mutation fresh-root hydration must never become a permanent failed execution",
  );
  assert.equal(
    classifyWebChatFailure(
      new Error(
        "review_required: web-chat execution is terminal: failed; root=invalid immutable input identity",
      ),
      false,
    ),
    "failed",
  );
};

const assertRootlessSyntheticTerminalEchoGetsOneRecovery = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-rootless-terminal-"));
  try {
    const initial = await startOrResumeWebChatExecution({
      dataDir,
      executionId: "xuanxue-ai-production:rootless-terminal:research",
      providerKind: "gpt-web-chat",
      inputHash: "same-input",
      textPrompt: "same prompt",
    });
    const terminalEcho = (attemptId: string) => ({
      occurredAt: new Date().toISOString(),
      attemptId,
      phase: "failed" as const,
      classification: "failed" as const,
      recoverable: false,
      reason: "review_required: web-chat execution is terminal: failed; root=unknown terminal provider failure",
    });
    const failed = await updateWebChatExecution({
      dataDir,
      record: initial.record,
      patch: {
        status: "failed",
        failures: [terminalEcho(initial.record.attemptId)],
      },
    });
    const recovered = await startOrResumeWebChatExecution({
      dataDir,
      executionId: initial.record.executionId,
      providerKind: "gpt-web-chat",
      inputHash: "same-input",
      textPrompt: "same prompt",
    });
    assert.equal(recovered.resume, false);
    assert.equal(recovered.record.status, "recovery_pending");
    assert.equal(recovered.record.executionId, failed.executionId);
    assert.equal(recovered.record.turnMarker, failed.turnMarker);
    assert.notEqual(recovered.record.attemptId, failed.attemptId);

    const failedAgain = await updateWebChatExecution({
      dataDir,
      record: recovered.record,
      patch: {
        status: "failed",
        failures: [
          ...recovered.record.failures,
          terminalEcho(recovered.record.attemptId),
        ],
      },
    });
    await assert.rejects(
      startOrResumeWebChatExecution({
        dataDir,
        executionId: initial.record.executionId,
        providerKind: "gpt-web-chat",
        inputHash: "same-input",
        textPrompt: "same prompt",
      }),
      /unknown terminal provider failure/u,
    );
    assert.equal(failedAgain.failures.length, 2);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const assertCorrectedUnsubmittedInputStartsFreshAttempt = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-web-chat-restart-"));
  try {
    const initial = await startOrResumeWebChatExecution({
      dataDir,
      executionId: "xuanxue-ai-production:qimen-retry:followup",
      providerKind: "gpt-web-chat",
      inputHash: "initial-input",
      textPrompt: "same prompt",
    });
    const failed = await updateWebChatExecution({
      dataDir,
      record: initial.record,
      patch: {
        status: "failed",
        failures: [{
          occurredAt: new Date().toISOString(),
          attemptId: initial.record.attemptId,
          phase: "submitting",
          classification: "recovery_pending",
          recoverable: true,
          reason: "WEB_CHAT_COMPOSER_CLEAR_ACTION_UNPROVEN",
        }],
      },
    });
    const repaired = await startOrResumeWebChatExecution({
      dataDir,
      executionId: initial.record.executionId,
      providerKind: "gpt-web-chat",
      inputHash: "corrected-input",
      textPrompt: "same prompt",
    });
    assert.equal(repaired.resume, false);
    assert.equal(repaired.record.status, "recovery_pending");
    assert.notEqual(repaired.record.attemptId, failed.attemptId);
    assert.notEqual(repaired.record.turnMarker, failed.turnMarker);
    assert.equal(repaired.record.inputHash, "corrected-input");
    assert.equal("systemChatTitle" in repaired.record, false);
    assert.equal("chatTitleRename" in repaired.record, false);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const assertLegacyPreMutationTargetInvalidResumesSameExecution = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-target-invalid-restart-"));
  try {
    const initial = await startOrResumeWebChatExecution({
      dataDir,
      executionId: "xuanxue-ai-production:legacy-target-invalid:localization_candidate",
      providerKind: "gpt-web-chat",
      inputHash: "same-input",
      textPrompt: "same prompt",
    });
    const failed = await updateWebChatExecution({
      dataDir,
      record: initial.record,
      patch: {
        status: "failed",
        failures: [{
          occurredAt: new Date().toISOString(),
          attemptId: initial.record.attemptId,
          phase: "submitting",
          classification: "failed",
          recoverable: false,
          reason: "BROWSER_TARGET_INVALID",
        }],
      },
    });
    const recovered = await startOrResumeWebChatExecution({
      dataDir,
      executionId: initial.record.executionId,
      providerKind: "gpt-web-chat",
      inputHash: "same-input",
      textPrompt: "same prompt",
    });
    assert.equal(recovered.resume, false);
    assert.equal(recovered.record.status, "recovery_pending");
    assert.equal(recovered.record.executionId, failed.executionId);
    assert.equal(recovered.record.turnMarker, failed.turnMarker);
    assert.notEqual(recovered.record.attemptId, failed.attemptId);
    assert.equal(recovered.record.submission, null);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const assertCanonicalConversationOwnership = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-web-chat-owner-"));
  try {
    const owner = await startOrResumeWebChatExecution({
      dataDir,
      executionId: "xuanxue-ai-production:owner:base",
      providerKind: "gpt-web-chat",
      inputHash: "owner-input",
      textPrompt: "owner prompt",
    });
    const canonicalUrl = "https://chatgpt.com/c/already-owned-conversation";
    await updateWebChatExecution({
      dataDir,
      record: owner.record,
      patch: {
        status: "conversation_canonicalized",
        submission: {
          transientConversationUrl: "https://chatgpt.com/",
          canonicalConversationUrl: canonicalUrl,
          userTurnId: "conversation-turn-1",
          previousAssistantCount: 0,
          previousUserMessageCount: 0,
          submittedAt: new Date().toISOString(),
        },
      },
    });
    await assert.rejects(
      assertWebChatCanonicalConversationBinding({
        dataDir,
        executionId: "xuanxue-ai-production:foreign:base",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl: `${canonicalUrl}?model=auto`,
        continuationConversationUrl: null,
      }),
      /WEB_CHAT_CANONICAL_CONVERSATION_ALREADY_BOUND/u,
    );
    await assert.doesNotReject(
      assertWebChatCanonicalConversationBinding({
        dataDir,
        executionId: "xuanxue-ai-production:owner:followup",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl: canonicalUrl,
        continuationConversationUrl: canonicalUrl,
      }),
    );
    await assert.rejects(
      assertWebChatCanonicalConversationBinding({
        dataDir,
        executionId: "xuanxue-ai-production:owner:wrong-followup",
        providerKind: "gpt-web-chat",
        canonicalConversationUrl: "https://chatgpt.com/c/different-conversation",
        continuationConversationUrl: canonicalUrl,
      }),
      /WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT/u,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const createSubmittedDraftCandidate = async (dataDir: string, input: {
  executionId: string;
  canonicalConversationUrl: string | null;
}) => {
  const started = await startOrResumeWebChatExecution({
    dataDir,
    executionId: input.executionId,
    turnIdentitySeed: "shared-submitted-draft-marker",
    providerKind: "gpt-web-chat",
    inputHash: input.executionId,
    textPrompt: input.executionId,
  });
  return updateWebChatExecution({
    dataDir,
    record: started.record,
    patch: {
      status: input.canonicalConversationUrl ? "conversation_canonicalized" : "submitted_transient",
      submission: {
        transientConversationUrl: "https://chatgpt.com/c/WEB:submitted-draft",
        canonicalConversationUrl: input.canonicalConversationUrl,
        userTurnId: "conversation-turn-1",
        previousAssistantCount: 0,
        previousUserMessageCount: 0,
        submittedAt: new Date().toISOString(),
      },
    },
  });
};

const resolveDraftOwner = (dataDir: string, turnMarker: string) =>
  resolveSubmittedDraftOwnerByTurnMarker({
    dataDir,
    providerKind: "gpt-web-chat",
    turnMarker,
  });

const assertSubmittedDraftOwnershipRequiresOneCanonicalOwner = async (): Promise<void> => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "grasseye-submitted-draft-owner-"));
  try {
    const transient = await createSubmittedDraftCandidate(dataDir, {
      executionId: "submitted-draft:transient-only",
      canonicalConversationUrl: null,
    });
    assert.deepEqual(
      await resolveDraftOwner(dataDir, transient.turnMarker),
      { matchCount: 0, owner: null },
      "a transient-only receipt must never authorize composer cleanup",
    );
    const canonical = await createSubmittedDraftCandidate(dataDir, {
      executionId: "submitted-draft:canonical-owner",
      canonicalConversationUrl: "https://chatgpt.com/c/submitted-draft-owner",
    });
    assert.deepEqual(
      await resolveDraftOwner(dataDir, canonical.turnMarker),
      {
        matchCount: 1,
        owner: {
          executionId: canonical.executionId,
          canonicalConversationUrl: "https://chatgpt.com/c/submitted-draft-owner",
        },
      },
      "one durable canonical owner is positive stale-draft ownership proof",
    );
    await createSubmittedDraftCandidate(dataDir, {
      executionId: "submitted-draft:duplicate-owner",
      canonicalConversationUrl: "https://chatgpt.com/c/submitted-draft-duplicate",
    });
    assert.deepEqual(
      await resolveDraftOwner(dataDir, canonical.turnMarker),
      { matchCount: 2, owner: null },
      "duplicate ledger owners must fail closed without clearing",
    );
    assert.deepEqual(
      await resolveDraftOwner(dataDir, "not-a-governed-marker"),
      { matchCount: 0, owner: null },
      "malformed or foreign marker text must never authorize cleanup",
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
};

const assertFeedRateIdentity = (): void => {
  const roundId = `same-execution-retry:${Date.now()}`;
  const first = "xuanxue-ai-production:retry-owner";
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId,
    transport: "web-chat",
    executionId: first,
    supersededExecutionId: null,
  }).ok, true);
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId,
    transport: "web-chat",
    executionId: first,
    supersededExecutionId: null,
  }).ok, true);
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId,
    transport: "web-chat",
    executionId: "xuanxue-ai-production:different-owner",
    supersededExecutionId: null,
  }).ok, false);
  assert.equal(checkAiFeedRateGuard({
    inputHash: "same-input",
    roundId,
    transport: "web-chat",
    executionId: "xuanxue-ai-production:replacement",
    supersededExecutionId: first,
  }).ok, true);
};

export const assertWebChatIdentityAndRecoveryPolicies = async (): Promise<void> => {
  assertProviderFailuresRemainRecoverable();
  await assertDuplicateCanonicalDomRowsAreOneLogicalRoute();
  await assertCorrectedUnsubmittedInputStartsFreshAttempt();
  await assertLegacyPreMutationTargetInvalidResumesSameExecution();
  await assertRootlessSyntheticTerminalEchoGetsOneRecovery();
  await assertCanonicalConversationOwnership();
  await assertSubmittedDraftOwnershipRequiresOneCanonicalOwner();
  assertFeedRateIdentity();
};
