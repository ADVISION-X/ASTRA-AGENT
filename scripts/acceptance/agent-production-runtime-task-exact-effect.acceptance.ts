import assert from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createGptAbilityGroup,
  gptExactCallIdentityHash,
  persistGptChildEvidence,
  ProductionGptChildTools,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
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
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  return Object.freeze({
    ...identity,
    executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
    actionOrdinal: call.actionOrdinal,
    input: call.input,
  }) satisfies GptChildCapabilityIntent<"submit_exact_gpt_turn_once">;
};

const proofFor = (
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">,
): GptChildCapabilityProof => Object.freeze({
  schemaVersion: "gpt-child-capability-proof.v2",
  childCapabilityId: intent.childCapabilityId,
  childContractVersion: 2,
  childStatus: "success",
  childReasonCode: "GPT_CHILD_SUCCEEDED",
  exactCallIdentityHash: gptExactCallIdentityHash(intent),
  internalDecisionCode: "DONE",
  executionId: intent.executionId,
  jobId: intent.jobId,
  attemptId: intent.attemptId,
  pluginId: intent.pluginId,
  pluginVersion: intent.pluginVersion,
  productStepId: intent.productStepId,
  callId: intent.callId,
  inputHash: intent.inputHash,
  actionOrdinal: intent.actionOrdinal,
  targetRefHash: HASH_A,
  beforeDocumentRefHash: HASH_A,
  afterDocumentRefHash: HASH_B,
  authorityRefHashes: Object.freeze([HASH_A]),
  factResultIds: Object.freeze([]),
  candidateCardinality: Object.freeze({ raw: 1, eligible: 1 }),
  observationRevisionHash: HASH_B,
  committedMutation: "confirmed",
  postconditionResult: "passed",
  browserFact: null,
  nativeFailureCode: null,
  startedAt: "2026-09-03T00:00:00.000Z",
  endedAt: "2026-09-03T00:00:00.001Z",
  evidenceRef: `browser:${intent.attemptId}`,
  evidenceHash: hashCanonical({ attemptId: intent.attemptId }),
});

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
    const proof = proofFor(intent);
    const result: GptChildCapabilityResult<"submit_exact_gpt_turn_once"> = Object.freeze({
      status: "success",
      value: Object.freeze({ promptHash: call.input.promptHash, mutationSent: true }),
      proof,
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
    });
    await persistGptChildEvidence({
      result, intent, evidenceStore, jobId: providerTask.job_id, attemptId,
      stepId: call.productStepId, exactCallIdentityHash: proof.exactCallIdentityHash,
    });
    return proof.exactCallIdentityHash;
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
  const execution = (attemptId: string, leaseVersion: number) => new ProductionGptChildTools(
    root,
    HASH_A,
    createGptAbilityGroup(),
    evidenceStore,
    authority,
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
