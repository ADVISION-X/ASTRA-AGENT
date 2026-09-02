import assert from "../audit/shared/governance-exam-assert.js";

import { createGptAbilityGroup, gptExactCallIdentityHash } from "../../src/capabilities/gpt/index.js";
import type { ForensicsPersistenceAbilityGroup } from
  "../../src/capabilities/forensics-persistence/index.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import { hashCanonical, type WebsiteAgentTask } from
  "../../src/lib/local-runtime/production/contracts.js";
import { persistGptChildEvidence } from
  "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionGptChildTools, type ProductGptExecution } from
  "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from
  "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import type { RuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { digest } from "./agent-production-gpt-artifact-readback-support.js";
import { gptProofEnvelope, HASH_A, HASH_B, identityFor } from "./agent-production-runtime-fixtures.js";

type ExactEffectInput = Readonly<{
  root: string;
  evidenceStore: ForensicsPersistenceAbilityGroup;
  store: ProductionRuntimeStore;
  runtimeLogger: RuntimeLogger;
  normalExecution: ProductGptExecution;
  providerTask: WebsiteAgentTask;
  attemptId: string;
  continuationRef: string;
}>;

const persistPriorSubmit = async (input: ExactEffectInput) => {
  const imageSubmitCall = Object.freeze({
    productStepId: "article_image_generation", callId: "turn-submit",
    child: "submit_exact_gpt_turn_once" as const, actionOrdinal: 42,
    input: Object.freeze({ promptHash: HASH_A, turnMarker: "[GRASSEYE:frozen-article-source]" }),
  });
  const identity = {
    jobId: input.providerTask.job_id, attemptId: input.attemptId,
    pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    productStepId: imageSubmitCall.productStepId, callId: imageSubmitCall.callId,
    childCapabilityId: imageSubmitCall.child, inputHash: hashCanonical(imageSubmitCall.input),
  } as const;
  const priorSubmitHash = gptExactCallIdentityHash(identity);
  const submittedAt = new Date().toISOString();
  await persistGptChildEvidence({
    intent: { ...identity, executionId: `gpt-call:${priorSubmitHash.slice(7)}`,
      actionOrdinal: imageSubmitCall.actionOrdinal, input: imageSubmitCall.input },
    evidenceStore: input.evidenceStore, jobId: input.providerTask.job_id,
    attemptId: input.attemptId, stepId: imageSubmitCall.productStepId,
    exactCallIdentityHash: priorSubmitHash,
    result: { status: "success", value: null, failureCode: null, failureCause: null,
      failureBrowserEffect: null, proof: {
      schemaVersion: "gpt-child-capability-proof.v2", ...identity,
      ...gptProofEnvelope({ childCapabilityId: identity.childCapabilityId,
        exactCallIdentityHash: priorSubmitHash, status: "success", decision: "ACT", candidateCount: 1,
        authorityRefHashes: [HASH_A] }),
      executionId: `gpt-call:${priorSubmitHash.slice(7)}`, actionOrdinal: imageSubmitCall.actionOrdinal,
      targetRefHash: HASH_A, beforeDocumentRefHash: HASH_A, afterDocumentRefHash: HASH_A,
      committedMutation: "confirmed", postconditionResult: "passed",
      startedAt: submittedAt, endedAt: submittedAt,
      evidenceRef: "browser:prior-image-submit", evidenceHash: HASH_B,
    } },
  });
  input.store.recordAttemptFailure(input.providerTask.job_id, input.attemptId, {
    code: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", mutation_outcome: "no",
    effect_scope: null, child_capability_id: null, browser_outcome: null,
    evidence_ref: null, evidence_hash: null, cause: null,
  });
  const nextAttemptId = "attempt:artifact-readback-terminal:2";
  input.store.acceptTask(input.providerTask, identityFor(input.providerTask), nextAttemptId);
  const storedContinuation = input.store.readGptContinuation(input.continuationRef);
  assert(storedContinuation);
  return { imageSubmitCall, nextAttemptId, priorSubmitHash, storedContinuation, submittedAt };
};

type PriorSubmit = Awaited<ReturnType<typeof persistPriorSubmit>>;

const persistSubmissionLocator = async (input: ExactEffectInput, prior: PriorSubmit) => {
  const locatorCall = Object.freeze({
    sessionKey: "session:task-exact-effect-locator", productStepId: prior.imageSubmitCall.productStepId,
    callId: "submission-reconcile", child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 43, input: Object.freeze({ expectedPromptHash: prior.imageSubmitCall.input.promptHash,
      timeoutMs: 60_000, turnMarker: prior.imageSubmitCall.input.turnMarker }),
  });
  const identity = {
    jobId: input.providerTask.job_id, attemptId: prior.nextAttemptId,
    pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    productStepId: locatorCall.productStepId, callId: locatorCall.callId,
    childCapabilityId: locatorCall.child, inputHash: hashCanonical(locatorCall.input),
  } as const;
  const exactHash = gptExactCallIdentityHash(identity);
  const userTurnId = "conversation-turn-4";
  const conversationIdentityHash = digest(
    `${prior.storedContinuation.provider.provider_page_url}\n${prior.imageSubmitCall.input.turnMarker}\n${userTurnId}\n${prior.imageSubmitCall.input.promptHash}`,
  );
  await persistGptChildEvidence({
    intent: { ...identity, executionId: `gpt-call:${exactHash.slice(7)}`,
      actionOrdinal: locatorCall.actionOrdinal, input: locatorCall.input },
    evidenceStore: input.evidenceStore, jobId: input.providerTask.job_id,
    attemptId: prior.nextAttemptId, stepId: locatorCall.productStepId,
    exactCallIdentityHash: exactHash,
    result: { status: "success", failureCode: null, failureCause: null,
      failureBrowserEffect: null, value: {
      canonicalConversationUrl: prior.storedContinuation.provider.provider_page_url,
      turnMarker: prior.imageSubmitCall.input.turnMarker, userTurnId,
      promptHash: prior.imageSubmitCall.input.promptHash, conversationIdentityHash,
    }, proof: { schemaVersion: "gpt-child-capability-proof.v2", ...identity,
      ...gptProofEnvelope({ childCapabilityId: identity.childCapabilityId,
        exactCallIdentityHash: exactHash, status: "success", decision: "DONE", candidateCount: 1,
        authorityRefHashes: [HASH_A] }),
      executionId: `gpt-call:${exactHash.slice(7)}`, actionOrdinal: locatorCall.actionOrdinal,
      targetRefHash: HASH_A, beforeDocumentRefHash: HASH_A, afterDocumentRefHash: HASH_A,
      committedMutation: "no", postconditionResult: "passed",
      startedAt: prior.submittedAt, endedAt: prior.submittedAt,
      evidenceRef: "browser:prior-image-submission-locator", evidenceHash: HASH_B,
    } },
  });
  return locatorCall;
};

const exactEffectAuthority = (
  input: ExactEffectInput,
  prior: PriorSubmit,
  captured: { value: BrowserExecutionBinding | null },
): WorkbenchBrowserAuthority => Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
  readExactCallMutationFact: (query: Readonly<{
    attemptId: string; exactCallIdentityHash: `sha256:${string}`;
  }>) => query.attemptId === input.attemptId && query.exactCallIdentityHash === prior.priorSubmitHash
    ? { effectScope: "provider_effect" as const, outcome: "CONFIRMED" as const,
      terminalAt: prior.submittedAt, targetRef: "target:prior-image-submit",
      documentRef: "document:prior-image-submit", productStepId: prior.imageSubmitCall.productStepId,
      callId: prior.imageSubmitCall.callId, childCapabilityId: prior.imageSubmitCall.child,
      actionOrdinal: prior.imageSubmitCall.actionOrdinal } : null,
  countProviderTurnDispatches: () => 0,
  acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
    captured.value = binding;
    throw new Error("CAPTURED_TASK_EXACT_EFFECT_BROWSER_BINDING");
  },
});

export const exerciseTaskExactEffectRecovery = async (input: ExactEffectInput): Promise<void> => {
  const prior = await persistPriorSubmit(input);
  const locatorCall = await persistSubmissionLocator(input, prior);
  const captured = { value: null as BrowserExecutionBinding | null };
  const nextExecution = new ProductionGptChildTools(
    input.root, HASH_A, createGptAbilityGroup(), input.evidenceStore,
    exactEffectAuthority(input, prior, captured), input.store, input.runtimeLogger,
  ).createExecution({
    task: input.providerTask, pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    lease: { attempt_id: prior.nextAttemptId, device_id: "device:task-exact-effect", lease_version: 2,
      execution_fence_hash: HASH_A, control_manifest_hash: HASH_A, max_provider_turns: 2,
      provider_turns_used: 0, expires_at_monotonic: performance.now() + 10_000,
      command_ttl_ms: 1_000, abort_signal: new AbortController().signal },
    parentSpanId: "span:task-exact-effect",
  });
  const currentFacts = await nextExecution.tools.readCallFacts(prior.imageSubmitCall);
  assert.equal(currentFacts.mutation, null);
  const taskFacts = await nextExecution.tools.readCallFacts({
    ...prior.imageSubmitCall, lookupKind: "task_exact_effect",
  });
  assert.equal(taskFacts.exactCallIdentityHash, prior.priorSubmitHash);
  assert.equal(taskFacts.mutation?.outcome, "CONFIRMED");
  assert.equal(taskFacts.evidence?.readbackVerified, true);
  await nextExecution.tools.execute(locatorCall);
  await assert.rejects(nextExecution.tools.execute({
    sessionKey: "session:task-exact-effect-readback",
    productStepId: prior.imageSubmitCall.productStepId, callId: "focus-recovered-conversation",
    child: "focus_exact_gpt_conversation", actionOrdinal: 43,
    input: { canonicalConversationUrl: prior.storedContinuation.provider.provider_page_url },
  }), (error) => error instanceof Error && error.cause instanceof Error
    && error.cause.message === "CAPTURED_TASK_EXACT_EFFECT_BROWSER_BINDING");
  const binding = captured.value;
  if (binding?.kind !== "production-reconciliation") {
    throw new Error("CONFIRMED_PROVIDER_READBACK_BINDING_MISSING");
  }
  assert.equal(binding.confirmedProviderReadback.sourceExactCallIdentityHash, prior.priorSubmitHash);
  assert.equal(binding.confirmedProviderReadback.evidenceRef, taskFacts.evidence?.evidenceRef);
  assert.equal(binding.confirmedProviderReadback.canonicalConversationUrl,
    prior.storedContinuation.provider.provider_page_url);
  assert.equal(binding.confirmedProviderReadback.promptHash, prior.imageSubmitCall.input.promptHash);
  assert.equal(binding.confirmedProviderReadback.turnMarker, prior.imageSubmitCall.input.turnMarker);
  await nextExecution.settle(null);
  await input.normalExecution.settle(null);
};
