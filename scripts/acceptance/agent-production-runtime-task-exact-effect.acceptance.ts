import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGptAbilityGroup,
  createProductionGptChildTools,
} from "../../src/capabilities/gpt/index.js";
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

const intentFor = (taskInput: WebsiteAgentTask, attemptId: string) => {
  const identity = Object.freeze({
    jobId: taskInput.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: call.productStepId,
    callId: call.callId,
    childCapabilityId: call.child,
    inputHash: hashCanonical(call.input),
  });
  const exactCallIdentityHash = hashCanonical([
    identity.jobId, identity.attemptId, identity.pluginId, identity.pluginVersion,
    identity.productStepId, identity.callId, identity.childCapabilityId, identity.inputHash,
  ]);
  return Object.freeze({
    ...identity,
    exactCallIdentityHash,
    executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
    actionOrdinal: call.actionOrdinal,
    input: call.input,
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
    controlManifestHash: HASH_A,
    maxProviderTurns: 2,
    expiresAtMonotonic: performance.now() + 30_000,
    commandTtlMs: 1_000,
    abortSignal: new AbortController().signal,
    parentSpanId: `span:runtime-task-exact-effect:${leaseVersion}`,
  });

  const attempt1 = "attempt:runtime-task-exact-effect:1";
  store.acceptTask(providerTask, identityFor(providerTask), attempt1);
  const attempt1Hash = await persistAttempt(attempt1);
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
  const unique = await secondExecution.tools.readCallFacts({ ...call, lookupKind: "task_exact_effect" });
  assert.equal(unique.exactCallIdentityHash, attempt1Hash);
  assert.equal(unique.evidence?.readbackVerified, true);
  assert.equal(unique.evidence?.owner, "forensics-persistence");

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
