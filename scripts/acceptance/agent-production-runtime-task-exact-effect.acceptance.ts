import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGptAbilityGroup,
  createProductionGptChildTools,
  type ProductGptAnyCallInput,
} from "../../src/capabilities/gpt/index.js";
import {
  recoveryAssistantTurnReply,
  recoveryBrowserLease,
  recoveryConversationIdentityHash,
  recoveryObservationPacket,
} from "./agent-production-runtime-gpt-recovery-fixture.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from
  "../../src/capabilities/forensics-persistence/index.js";
import {
  hashCanonical,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from
  "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { serializeTerminalFailure } from "../../src/lib/local-runtime/production/terminal-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";

const call = Object.freeze({
  productStepId: "provider-submit",
  callId: "submit-once",
  child: "submit_exact_gpt_turn_once" as const,
  actionOrdinal: 12,
  input: Object.freeze({ files: [], promptHash: HASH_A, turnMarker: "[GRASSEYE:task-exact-effect]" }),
});

const textHash = (value: string): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const intentFor = (
  taskInput: WebsiteAgentTask,
  attemptId: string,
  exactCall: ProductGptAnyCallInput = call,
) => {
  const identity = Object.freeze({
    jobId: taskInput.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: exactCall.productStepId,
    callId: exactCall.callId,
    childCapabilityId: exactCall.child,
    inputHash: hashCanonical(exactCall.input),
  });
  const exactCallIdentityHash = hashCanonical([
    identity.jobId, identity.attemptId, identity.pluginId, identity.pluginVersion,
    identity.productStepId, identity.callId, identity.childCapabilityId, identity.inputHash,
  ]);
  return Object.freeze({
    ...identity,
    exactCallIdentityHash,
    executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
    actionOrdinal: exactCall.actionOrdinal,
    input: exactCall.input,
  });
};

const root = await mkdtemp(path.join(tmpdir(), "runtime-task-exact-effect-"));
const store = new ProductionRuntimeStore(root);
try {
  const providerTask = task({
    jobId: "job:runtime-task-exact-effect",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  const persistAttempt = async (attemptId: string): Promise<ProductionHash> => {
    const intent = intentFor(providerTask, attemptId);
    const evidenceHash = hashCanonical({ attemptId });
    const recordPayload = Object.freeze({
      schema_version: "agent-gpt-evidence-safe.v2",
      exact_call_identity_hash: intent.exactCallIdentityHash,
      child_capability_id: intent.childCapabilityId,
      plugin_version: intent.pluginVersion,
      action_ordinal: intent.actionOrdinal,
      execution_identity_hash: hashCanonical(intent.executionId),
      candidate_cardinality: Object.freeze({ raw: 1, eligible: 1 }),
      committed_mutation: "confirmed",
      postcondition_result: "passed",
      result_status: "success",
      reasoning_requirement_result: null,
      failure_code: null,
      failure_cause: null,
      started_at: "2026-09-03T00:00:00.000Z",
      ended_at: "2026-09-03T00:00:00.001Z",
      source_evidence_hash: evidenceHash,
    });
    const appended = await evidenceStore.appendRecord({
      missionId: providerTask.job_id,
      runId: attemptId,
      stepId: call.productStepId,
      sourceCapabilityId: "gpt",
      sourceChildCapabilityId: call.child,
      recordType: "evidence",
      recordPayload,
      idempotencyKey: `gpt-call-evidence:v1:${intent.exactCallIdentityHash}`,
      correlationId: intent.executionId,
      createdAt: recordPayload.ended_at,
    });
    assert.equal(appended.status, "success");
    assert.equal(typeof appended.recordRef, "string");
    return intent.exactCallIdentityHash;
  };
  const failAttempt = (attemptId: string): void => store.recordAttemptFailure(
    providerTask.job_id,
    attemptId,
    {
      code: "TEST_ATTEMPT_INTERRUPTED",
      mutation_outcome: "no",
      effect_scope: null,
      child_capability_id: null,
      browser_outcome: null,
      evidence_ref: null,
      evidence_hash: null,
      cause: null,
    },
  );
  const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_BROWSER_ACQUISITION"); },
  });
  const execution = (
    attemptId: string,
    leaseVersion: number,
    browserAuthority: WorkbenchBrowserAuthority = authority,
  ) => createProductionGptChildTools(
    root,
    HASH_A,
    createGptAbilityGroup(),
    evidenceStore,
    browserAuthority,
    {
      continuationStore: store,
      continuationReadback: {
        readGptContinuation: (continuationRef) => store.readGptContinuation(continuationRef),
        readGptContinuationForOriginJob: (jobId, pluginId, turnMarker) =>
          store.readGptContinuationForOriginJob(jobId, pluginId, turnMarker),
        readGptContinuationForFrontier: (frontierRef) => store.readGptContinuationForFrontier(frontierRef),
        readTaskPluginVersion: (jobId) => store.readTask(jobId)?.identity.plugin_version ?? null,
      },
      attemptIdsForTask: (jobId) => store.attemptIdsForTask(jobId),
    },
    createRuntimeLogger({
      producer: `runtime-task-exact-effect-${leaseVersion}`,
      owner: "production-runtime",
      component: "gpt-child",
      terminalEnabled: false,
      fileSink: { directoryPath: path.join(root, `runtime-logs-${leaseVersion}`) },
    }),
  ).createExecution({
    jobId: providerTask.job_id,
    continuationRef: providerTask.continuation_ref ?? null,
    ownerRef: providerTask.business_identity.owner_ref,
    subjectRef: providerTask.business_identity.subject_ref,
    authorizationRef: providerTask.business_identity.authorization_ref,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    attemptId,
    deviceId: "device:runtime-task-exact-effect",
    leaseVersion,
    executionFenceHash: leaseVersion === 1 ? HASH_A : HASH_B,
    capabilityManifestHash: HASH_A,
    maxProviderTurns: 2,
    expiresAtMonotonic: performance.now() + 30_000,
    commandTtlMs: 1_000,
    abortSignal: new AbortController().signal,
    parentSpanId: `span:runtime-task-exact-effect:${leaseVersion}`,
  });

  const attempt1 = "attempt:runtime-task-exact-effect:1";
  store.acceptTask(providerTask, identityFor(providerTask), attempt1);
  await persistAttempt(attempt1);
  const canonicalConversationUrl = "https://chatgpt.com/c/task-exact-effect";
  const userTurnId = "conversation-turn-1";
  const assistantTurnId = "conversation-turn-2";
  const conversationIdentityHash = recoveryConversationIdentityHash({
    canonicalConversationUrl,
    turnMarker: call.input.turnMarker,
    userTurnId,
    promptHash: HASH_A,
  });
  const waitCall = Object.freeze({
    productStepId: call.productStepId,
    callId: "text-wait",
    child: "wait_for_stable_gpt_text" as const,
    actionOrdinal: 14,
    input: Object.freeze({
      probeBudgetMs: 1_000,
      canonicalConversationUrl,
      conversationIdentityHash,
      expectedPromptHash: HASH_A,
      turnMarker: call.input.turnMarker,
    }),
  });
  const waitIntent = intentFor(providerTask, attempt1, waitCall);
  const historicalWaitFailure = await evidenceStore.appendRecord({
    missionId: providerTask.job_id,
    runId: attempt1,
    stepId: waitCall.productStepId,
    sourceCapabilityId: "gpt",
    sourceChildCapabilityId: waitCall.child,
    recordType: "evidence",
    recordPayload: {
      schema_version: "agent-gpt-evidence-safe.v2",
      exact_call_identity_hash: waitIntent.exactCallIdentityHash,
      child_capability_id: waitIntent.childCapabilityId,
      plugin_version: waitIntent.pluginVersion,
      action_ordinal: waitIntent.actionOrdinal,
      execution_identity_hash: hashCanonical(waitIntent.executionId),
      candidate_cardinality: Object.freeze({ raw: null, eligible: null }),
      committed_mutation: "no",
      postcondition_result: "failed",
      result_status: "failed",
      reasoning_requirement_result: null,
      failure_code: "BROWSER_DOM_READ_INVALID",
      failure_cause: null,
      failure_proof: Object.freeze({
        internal_decision_code: "FAIL_CLOSED",
        fact_result_ids: Object.freeze([]),
        authority_ref_hashes: Object.freeze([]),
        observation_revision_hash: null,
        browser_fact: null,
        native_failure_code: null,
      }),
      started_at: "2026-09-03T00:00:00.002Z",
      ended_at: "2026-09-03T00:00:00.003Z",
      source_evidence_hash: hashCanonical({ attemptId: attempt1, child: waitCall.child }),
    },
    idempotencyKey: `gpt-call-evidence:v1:${waitIntent.exactCallIdentityHash}`,
    correlationId: waitIntent.executionId,
    createdAt: "2026-09-03T00:00:00.003Z",
  });
  assert.equal(historicalWaitFailure.status, "success");
  failAttempt(attempt1);

  const attempt2 = "attempt:runtime-task-exact-effect:2";
  store.acceptTask(providerTask, identityFor(providerTask), attempt2);
  const secondExecution = execution(attempt2, 2);
  const current = await secondExecution.tools.readCallFacts(call);
  assert.equal(current.evidence, null);
  assert.equal(current.mutation, null);
  const rejectedAuthority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: (input: Parameters<WorkbenchBrowserAuthority["readExactCallMutationFact"]>[0]) => ({
      effectScope: "provider_effect" as const,
      outcome: "REJECTED" as const,
      mutationOutcome: "confirmed" as const,
      terminalAt: "2026-09-03T00:00:00.000Z",
      failureCode: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
      nativeFailureCode: "BROWSER_DOM_ACTION_HIT_TEST_FAILED",
      authorityRef: "browser-mutation:rejected-submit",
      authorityHash: HASH_B,
      targetRef: "target:rejected-submit",
      documentRef: "document:rejected-submit",
      productStepId: call.productStepId,
      callId: call.callId,
      childCapabilityId: call.child,
      actionOrdinal: input.actionOrdinal,
    }),
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_BROWSER_ACQUISITION"); },
  });
  const rejectedExecution = execution(attempt2, 22, rejectedAuthority);
  let rejectedError: unknown = null;
  try { await rejectedExecution.tools.execute({ ...call, sessionKey: "rejected-replay" }); }
  catch (error) { rejectedError = error; }
  assert.deepEqual(serializeTerminalFailure(rejectedError), {
    code: "BROWSER_DOM_ACTION_NOT_QUALIFIED",
    mutation_outcome: "confirmed",
    effect_scope: "provider_effect",
    child_capability_id: "submit_exact_gpt_turn_once",
    browser_outcome: "REJECTED",
    evidence_ref: "browser-mutation:rejected-submit",
    evidence_hash: HASH_B,
    cause: { name: "Error", code: "BROWSER_DOM_ACTION_HIT_TEST_FAILED" },
  }, "WAL-only REJECTED replay must preserve the exact Browser terminal and native failure tuple");
  await rejectedExecution.settle(null);
  await assert.rejects(
    secondExecution.tools.readCallFacts({ ...call, lookupKind: "task_exact_effect" }),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_TASK_EXACT_EFFECT_AMBIGUOUS",
    "prior evidence without its Browser WAL fact must fail closed rather than authorize a new attempt",
  );

  const confirmedAuthority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: (input: Parameters<WorkbenchBrowserAuthority["readExactCallMutationFact"]>[0]) =>
      input.attemptId === attempt1 ? ({
        effectScope: "provider_effect" as const,
        outcome: "CONFIRMED" as const,
        mutationOutcome: "confirmed" as const,
        terminalAt: "2026-09-03T00:00:00.000Z",
        failureCode: null,
        nativeFailureCode: null,
        authorityRef: "browser-mutation:confirmed-submit",
        authorityHash: HASH_B,
        targetRef: "target:confirmed-submit",
        documentRef: "document:confirmed-submit",
        productStepId: call.productStepId,
        callId: call.callId,
        childCapabilityId: call.child,
        actionOrdinal: input.actionOrdinal,
      }) : null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_BROWSER_ACQUISITION"); },
  });
  const confirmedExecution = execution(attempt2, 23, confirmedAuthority);
  await assert.rejects(
    confirmedExecution.tools.readCallFacts({ ...call, lookupKind: "task_exact_effect" }),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_TASK_EXACT_EFFECT_PRIOR_ATTEMPT_BLOCKED",
    "a confirmed provider effect belongs to its Website accepted attempt and cannot move to a new attempt",
  );
  await confirmedExecution.settle(null);

  const sameAttemptRecoveryAuthority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: (input: Parameters<WorkbenchBrowserAuthority["readExactCallMutationFact"]>[0]) =>
      input.exactCallIdentityHash === intentFor(providerTask, attempt1).exactCallIdentityHash ? ({
        effectScope: "provider_effect" as const,
        outcome: "CONFIRMED" as const,
        mutationOutcome: "confirmed" as const,
        terminalAt: "2026-09-03T00:00:00.000Z",
        failureCode: null,
        nativeFailureCode: null,
        authorityRef: "browser-mutation:same-attempt-submit",
        authorityHash: HASH_B,
        targetRef: "target:1",
        documentRef: "document:1",
        productStepId: call.productStepId,
        callId: call.callId,
        childCapabilityId: call.child,
        actionOrdinal: call.actionOrdinal,
      }) : null,
    countProviderTurnDispatches: () => 1,
  });
  const responseText = "stable recovered assistant response";
  const responseHash = textHash(responseText);
  const browser = recoveryBrowserLease(canonicalConversationUrl, (intent) => {
    if (intent.kind === "observe") {
      const queryIds = new Set(intent.queries.map((query) => query.queryId));
      if (queryIds.has("composer")) return recoveryObservationPacket(intent, {
        composer: Object.freeze({ rawCount: 1, eligibleCount: 1,
          matches: Object.freeze([{ exactEditableTextHash: textHash("") }]) }),
        "user-turns": Object.freeze({ rawCount: 1, eligibleCount: 1,
          matches: Object.freeze([{ testId: userTurnId, exactGptUserPromptHash: HASH_A }]) }),
      }, canonicalConversationUrl);
      return recoveryObservationPacket(intent, {
        "user-turns": Object.freeze({ rawCount: 1, eligibleCount: 1,
          matches: Object.freeze([{ testId: userTurnId, exactGptUserPromptHash: HASH_A }]) }),
        "assistant-turns": Object.freeze({ rawCount: 1, eligibleCount: 1,
          matches: Object.freeze([{ testId: assistantTurnId, semanticTextHash: responseHash }]) }),
        generating: Object.freeze({ rawCount: 0, eligibleCount: 0, matches: Object.freeze([]) }),
      }, canonicalConversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return recoveryAssistantTurnReply(intent, responseText);
    }
    throw new Error(`UNEXPECTED_SAME_ATTEMPT_RECOVERY_INTENT:${intent.kind}`);
  });
  Object.assign(sameAttemptRecoveryAuthority, {
    acquireJobBoundTargetLease: async () => browser,
  });
  const sameAttemptRecovery = execution(attempt1, 24, sameAttemptRecoveryAuthority);
  const recoverySessionKey = `public-knowledge-article-pipeline:${providerTask.job_id}:${attempt1}`;
  const confirmedSubmit = await sameAttemptRecovery.tools.readCallFacts(call);
  assert.equal(confirmedSubmit.mutation?.outcome, "CONFIRMED");
  const recoverableWait = await sameAttemptRecovery.tools.readCallFacts(waitCall);
  assert.equal(recoverableWait.evidence, null,
    "internal pending evidence must not enter Product's terminal evidence sequence");
  const reconcileCall = Object.freeze({
    productStepId: call.productStepId,
    callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 13,
    input: Object.freeze({
      expectedPromptHash: HASH_A,
      timeoutMs: 1_000,
      turnMarker: call.input.turnMarker,
    }),
  });
  const reconciled = await sameAttemptRecovery.tools.execute({ sessionKey: recoverySessionKey, ...reconcileCall });
  assert.equal(reconciled.value?.canonicalConversationUrl, canonicalConversationUrl);
  const stable = await sameAttemptRecovery.tools.execute({ sessionKey: recoverySessionKey, ...waitCall });
  assert.equal(stable.value?.responseText, responseText,
    "the same-attempt recovery must return the exact stable assistant answer through Product");
  const checkpointCall = Object.freeze({
    productStepId: call.productStepId,
    callId: "text-checkpoint",
    child: "checkpoint_gpt_text_response" as const,
    actionOrdinal: 15,
    input: Object.freeze({
      assistantTurnId,
      canonicalConversationUrl,
      expectedPromptHash: HASH_A,
      expectedResponseHash: responseHash,
      turnMarker: call.input.turnMarker,
    }),
  });
  const checkpoint = await sameAttemptRecovery.tools.execute({ sessionKey: recoverySessionKey, ...checkpointCall });
  assert.equal(checkpoint.value?.semanticText, responseText,
    "the recovered answer must cross the exact text checkpoint boundary");
  assert.equal(new Set([
    confirmedSubmit.evidence!.evidenceRef,
    reconciled.evidenceRef,
    stable.evidenceRef,
    checkpoint.evidenceRef,
  ]).size, 4, "the recovered action ordinals must retain distinct terminal evidence refs");
  const terminalWait = await evidenceStore.readExactCallEvidence({
    missionId: providerTask.job_id,
    runId: attempt1,
    exactCallIdentityHash: waitIntent.exactCallIdentityHash,
  });
  assert.equal(terminalWait?.record.idempotencyKey,
    `gpt-call-terminal-evidence:v1:${waitIntent.exactCallIdentityHash}`);
  assert.equal((terminalWait?.record.payload as Readonly<Record<string, unknown>>).postcondition_result, "passed");
  await sameAttemptRecovery.settle(null);

  const differentBinding = await secondExecution.tools.readCallFacts({
    ...call,
    callId: "different-submit",
    input: { ...call.input, turnMarker: "[GRASSEYE:different-task-effect]" },
    lookupKind: "task_exact_effect",
  });
  assert.equal(differentBinding.evidence, null,
    "a different exact call identity must not inherit an earlier task effect");

  await persistAttempt(attempt2);
  failAttempt(attempt2);
  const attempt3 = "attempt:runtime-task-exact-effect:3";
  store.acceptTask(providerTask, identityFor(providerTask), attempt3);
  const thirdExecution = execution(attempt3, 3);
  await assert.rejects(
    thirdExecution.tools.readCallFacts({ ...call, lookupKind: "task_exact_effect" }),
    (error: unknown) => typedExecutionFailure(error)?.code === "GPT_TASK_EXACT_EFFECT_AMBIGUOUS",
    "two prior exact-effect candidates must fail closed rather than choose one",
  );
  await secondExecution.settle(null);
  await thirdExecution.settle(null);
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}
