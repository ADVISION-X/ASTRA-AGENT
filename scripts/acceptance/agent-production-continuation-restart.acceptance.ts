import assert from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import {
  createGptAbilityGroup,
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
} from "../../src/capabilities/gpt/index.js";
import {
  createForensicsPersistenceAbilityGroupFromStorage,
  type ForensicsPersistenceAbilityGroup,
} from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import {
  ProductionGptChildTools,
  type ProductGptExecution,
} from "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { freshConfirmedAuthority } from "./agent-production-fresh-confirmed-authority-support.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";

const continuationAuthority = (): WorkbenchBrowserAuthority => Object.assign(
  Object.create(null) as WorkbenchBrowserAuthority,
  {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async () => { throw new Error("UNEXPECTED_CONTINUATION_BROWSER"); },
  },
);

const continuationExecution = (input: Readonly<{
  root: string;
  evidence: ForensicsPersistenceAbilityGroup;
  authority: WorkbenchBrowserAuthority;
  store: ProductionRuntimeStore;
  providerTask: WebsiteAgentTask;
  attemptId: string;
  leaseVersion: number;
}>): ProductGptExecution => new ProductionGptChildTools(
  input.root,
  HASH_A,
  createGptAbilityGroup(),
  input.evidence,
  input.authority,
  input.store,
  createRuntimeLogger({
    producer: "agent-continuation-rebuild",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(input.root, "runtime-logs") },
  }),
).createExecution({
  task: input.providerTask,
  pluginId: "public-knowledge-article-pipeline",
  pluginVersion: 16,
  lease: {
    attempt_id: input.attemptId,
    device_id: "device:continuation-rebuild",
    lease_version: input.leaseVersion,
    execution_fence_hash: input.leaseVersion === 1 ? HASH_A : HASH_B,
    control_manifest_hash: HASH_A,
    max_provider_turns: 2,
    provider_turns_used: 0,
    expires_at_monotonic: performance.now() + 10_000,
    command_ttl_ms: 1_000,
    abort_signal: new AbortController().signal,
  },
  parentSpanId: `span:continuation-rebuild:${input.leaseVersion}`,
});

const submissionLocatorScenario = () => {
  const providerTask = task({
    jobId: "job:submission-locator-restart",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:submission-locator-restart";
  const promptHash = HASH_A;
  const turnMarker = "[GRASSEYE:submission-locator-restart]";
  const submitCall = Object.freeze({
    productStepId: "corpus_research",
    callId: "turn-submit",
    child: "submit_exact_gpt_turn_once" as const,
    actionOrdinal: 12,
    input: Object.freeze({ promptHash, turnMarker }),
  });
  const submitIdentity = Object.freeze({
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: submitCall.productStepId,
    callId: submitCall.callId,
    childCapabilityId: submitCall.child,
    inputHash: hashCanonical(submitCall.input),
  });
  const submitExactCallIdentityHash = gptExactCallIdentityHash(submitIdentity);
  const locatorCall = Object.freeze({
    sessionKey: "",
    productStepId: "corpus_research",
    callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 13,
    input: Object.freeze({ expectedPromptHash: promptHash, timeoutMs: 60_000, turnMarker }),
  });
  const identity = Object.freeze({
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: locatorCall.productStepId,
    callId: locatorCall.callId,
    childCapabilityId: locatorCall.child,
    inputHash: hashCanonical(locatorCall.input),
  });
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const locatorUrl = "https://chatgpt.com/c/submission-locator-restart";
  const userTurnId = "conversation-turn-3";
  const conversationIdentityHash = `sha256:${createHash("sha256")
    .update(`${locatorUrl}\n${turnMarker}\n${userTurnId}\n${promptHash}`).digest("hex")}` as const;
  return { providerTask, attemptId, promptHash, turnMarker, submitCall, submitIdentity,
    submitExactCallIdentityHash, locatorCall, identity, exactCallIdentityHash,
    locatorUrl, userTurnId, conversationIdentityHash };
};

type SubmissionScenario = ReturnType<typeof submissionLocatorScenario>;

const persistSubmissionLocator = async (
  evidence: ForensicsPersistenceAbilityGroup,
  scenario: SubmissionScenario,
): Promise<void> => {
  const timestamp = new Date().toISOString();
  const executionId = `gpt-call:${scenario.exactCallIdentityHash.slice(7)}`;
  await persistGptChildEvidence({
    intent: { ...scenario.identity, executionId, actionOrdinal: scenario.locatorCall.actionOrdinal,
      input: scenario.locatorCall.input },
    evidenceStore: evidence,
    jobId: scenario.providerTask.job_id,
    attemptId: scenario.attemptId,
    stepId: scenario.locatorCall.productStepId,
    exactCallIdentityHash: scenario.exactCallIdentityHash,
    result: {
      status: "success",
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
      value: {
        canonicalConversationUrl: scenario.locatorUrl,
        turnMarker: scenario.turnMarker,
        userTurnId: scenario.userTurnId,
        promptHash: scenario.promptHash,
        conversationIdentityHash: scenario.conversationIdentityHash,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...scenario.identity,
        executionId,
        actionOrdinal: scenario.locatorCall.actionOrdinal,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["submission locator"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: timestamp,
        endedAt: timestamp,
        evidenceRef: "browser:submission-locator-restart",
        evidenceHash: HASH_B,
      },
    },
  });
};

const persistConfirmedSubmit = async (
  evidence: ForensicsPersistenceAbilityGroup,
  scenario: SubmissionScenario,
): Promise<string> => {
  const timestamp = new Date().toISOString();
  const executionId = `gpt-call:${scenario.submitExactCallIdentityHash.slice(7)}`;
  const persisted = await persistGptChildEvidence({
    intent: {
      ...scenario.submitIdentity,
      executionId,
      actionOrdinal: scenario.submitCall.actionOrdinal,
      input: scenario.submitCall.input,
    },
    evidenceStore: evidence,
    jobId: scenario.providerTask.job_id,
    attemptId: scenario.attemptId,
    stepId: scenario.submitCall.productStepId,
    exactCallIdentityHash: scenario.submitExactCallIdentityHash,
    result: {
      status: "success",
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
      value: null,
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...scenario.submitIdentity,
        executionId,
        actionOrdinal: scenario.submitCall.actionOrdinal,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_A,
        candidateCount: 1,
        observedSemantics: ["confirmed submit"],
        committedMutation: "confirmed",
        postconditionResult: "passed",
        startedAt: timestamp,
        endedAt: timestamp,
        evidenceRef: "browser:confirmed-submit",
        evidenceHash: HASH_B,
      },
    },
  });
  return persisted.evidenceRef;
};

const replaySubmissionLocator = async (input: Readonly<{
  root: string;
  evidence: ForensicsPersistenceAbilityGroup;
  store: ProductionRuntimeStore;
  scenario: SubmissionScenario;
}>): Promise<void> => {
  let browserAcquisitions = 0;
  let providerDispatchReads = 0;
  const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: () => null,
    countProviderTurnDispatches: () => { providerDispatchReads += 1; return 0; },
    acquireJobBoundTargetLease: async () => {
      browserAcquisitions += 1;
      throw new Error("UNEXPECTED_SUBMISSION_LOCATOR_BROWSER");
    },
  });
  const execution = continuationExecution({
    root: input.root, evidence: input.evidence, authority, store: input.store,
    providerTask: input.scenario.providerTask, attemptId: input.scenario.attemptId, leaseVersion: 2,
  });
  const replayed = await execution.tools.execute(input.scenario.locatorCall);
  assert.deepEqual(replayed.value, {
    canonicalConversationUrl: input.scenario.locatorUrl,
    turnMarker: input.scenario.turnMarker,
    userTurnId: input.scenario.userTurnId,
    promptHash: input.scenario.promptHash,
    conversationIdentityHash: input.scenario.conversationIdentityHash,
  });
  assert.equal(browserAcquisitions, 0, "restart replay must read the locator before Browser acquisition");
  assert.equal(providerDispatchReads, 0, "restart replay must not enter submit budget or mutation logic");
  await execution.settle(null);
};

const exerciseSubmissionLocatorRestart = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-submission-locator-restart-"));
  const scenario = submissionLocatorScenario();
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(scenario.providerTask, identityFor(scenario.providerTask), scenario.attemptId);
    await persistSubmissionLocator(
      createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root)), scenario,
    );
    store.close();
    store = new ProductionRuntimeStore(root);
    await replaySubmissionLocator({
      root, store, scenario,
      evidence: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root)),
    });
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const exerciseFreshConfirmedSubmitLocatorRestart = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-fresh-confirmed-submit-restart-"));
  const scenario = submissionLocatorScenario();
  const store = new ProductionRuntimeStore(root);
  try {
    assert.equal(scenario.providerTask.continuation_ref ?? null, null);
    store.acceptTask(scenario.providerTask, identityFor(scenario.providerTask), scenario.attemptId);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    const evidenceRef = await persistConfirmedSubmit(evidence, scenario);
    await persistSubmissionLocator(evidence, scenario);
    const captured = { value: null as BrowserExecutionBinding | null };
    let providerDispatchReads = 0;
    let browserAcquisitions = 0;
    const authority = freshConfirmedAuthority({
      scenario, captured,
      onDispatchRead: () => { providerDispatchReads += 1; },
      onBrowserAcquisition: () => { browserAcquisitions += 1; },
    });
    const execution = continuationExecution({
      root, evidence, authority, store,
      providerTask: scenario.providerTask,
      attemptId: scenario.attemptId,
      leaseVersion: 2,
    });
    const submitFacts = await execution.tools.readCallFacts(scenario.submitCall);
    assert.equal(submitFacts.mutation?.outcome, "CONFIRMED");
    assert.equal(submitFacts.evidence?.evidenceRef, evidenceRef);
    assert.equal(submitFacts.evidence?.readbackVerified, true);
    await execution.tools.execute(scenario.locatorCall);
    assert.equal(browserAcquisitions, 0, "durable locator replay must happen before Browser acquisition");
    await assert.rejects(
      execution.tools.execute({
        sessionKey: "session:fresh-confirmed-readback",
        productStepId: scenario.submitCall.productStepId,
        callId: "text-wait",
        child: "wait_for_stable_gpt_text",
        actionOrdinal: 14,
        input: {
          absoluteDeadline: new Date(Date.now() + 60_000).toISOString(),
          canonicalConversationUrl: scenario.locatorUrl,
          expectedPromptHash: scenario.promptHash,
          turnMarker: scenario.turnMarker,
        },
      }),
      (error) => error instanceof Error && error.cause instanceof Error
        && error.cause.message === "CAPTURED_FRESH_CONFIRMED_READBACK_BINDING",
    );
    const binding = captured.value;
    assert.equal(binding?.kind, "production-reconciliation");
    if (binding?.kind !== "production-reconciliation") {
      throw new Error("FRESH_CONFIRMED_PROVIDER_READBACK_BINDING_MISSING");
    }
    assert.equal(binding.attemptId, scenario.attemptId);
    assert.equal(binding.callId, "text-wait");
    assert.equal(binding.confirmedProviderReadback.sourceExactCallIdentityHash,
      scenario.submitExactCallIdentityHash);
    assert.equal(binding.confirmedProviderReadback.canonicalConversationUrl, scenario.locatorUrl);
    assert.equal(binding.confirmedProviderReadback.conversationIdentityHash,
      scenario.conversationIdentityHash);
    assert.equal(providerDispatchReads, 0, "readback resume must not enter submit budget or dispatch");
    await execution.settle(null);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const exerciseFreshConfirmedSubmitMissingLocator = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-fresh-confirmed-submit-missing-locator-"));
  const scenario = submissionLocatorScenario();
  const store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(scenario.providerTask, identityFor(scenario.providerTask), scenario.attemptId);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    await persistConfirmedSubmit(evidence, scenario);
    const captured = { value: null as BrowserExecutionBinding | null };
    let providerDispatchReads = 0;
    const terminalAt = new Date().toISOString();
    const authority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
      readExactCallMutationFact: (query: Readonly<{
        attemptId: string;
        exactCallIdentityHash: `sha256:${string}`;
      }>) => query.attemptId === scenario.attemptId
        && query.exactCallIdentityHash === scenario.submitExactCallIdentityHash
        ? {
          effectScope: "provider_effect" as const,
          outcome: "CONFIRMED" as const,
          terminalAt,
          targetRef: "target:fresh-confirmed-submit",
          documentRef: "document:fresh-confirmed-submit",
          productStepId: scenario.submitCall.productStepId,
          callId: scenario.submitCall.callId,
          childCapabilityId: scenario.submitCall.child,
          actionOrdinal: scenario.submitCall.actionOrdinal,
        }
        : null,
      countProviderTurnDispatches: () => { providerDispatchReads += 1; return 0; },
      acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
        captured.value = binding;
        throw new Error("MISSING_LOCATOR_READBACK_BLOCKED");
      },
    });
    const execution = continuationExecution({
      root, evidence, authority, store,
      providerTask: scenario.providerTask,
      attemptId: scenario.attemptId,
      leaseVersion: 2,
    });
    assert.equal((await execution.tools.readCallFacts(scenario.submitCall)).mutation?.outcome,
      "CONFIRMED");
    await assert.rejects(
      execution.tools.execute({
        ...scenario.locatorCall,
        sessionKey: "session:missing-submission-locator",
      }),
      (error) => error instanceof Error && error.cause instanceof Error
        && error.cause.message === "MISSING_LOCATOR_READBACK_BLOCKED",
    );
    assert.equal(captured.value?.kind, "production",
      "without a durable locator Runtime must not grant confirmed-provider replacement authority");
    assert.equal(captured.value?.callId, "submission-reconcile");
    assert.equal(providerDispatchReads, 0,
      "a missing locator must fail closed without entering submit budget or repeating submit");
    await execution.settle(null);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const continuationPersistCall = (providerTask: WebsiteAgentTask) => Object.freeze({
  sessionKey: "session:continuation-rebuild",
  productStepId: "corpus_research",
  callId: "continuation-persist",
  child: "persist_gpt_continuation" as const,
  actionOrdinal: 16,
  input: Object.freeze({
    jobId: providerTask.job_id,
    pluginId: "public-knowledge-article-pipeline",
    ownerRef: providerTask.business_identity.owner_ref,
    subjectRef: providerTask.business_identity.subject_ref,
    authorizationRef: providerTask.business_identity.authorization_ref,
    provider: Object.freeze({
      provider_page_url: "https://chatgpt.com/c/continuation-rebuild",
      prior_task_id: providerTask.job_id,
      prior_prompt_hash: HASH_A,
      prior_raw_output_hash: HASH_B,
      prior_turn_marker: "[GRASSEYE:continuation-rebuild]",
    }),
    currentCheckpoint: Object.freeze({
      checkpointKind: "text" as const,
      sourceAttemptId: "attempt:continuation-rebuild",
      assistantTurnId: "conversation-turn-2",
      artifactRef: "artifact:continuation-rebuild",
      rawDomHash: HASH_B,
      semanticTextHash: HASH_B,
      canonicalConversationUrl: "https://chatgpt.com/c/continuation-rebuild",
      promptHash: HASH_A,
      turnMarker: "[GRASSEYE:continuation-rebuild]",
      evidenceRef: "evidence:continuation-rebuild",
      evidenceHash: HASH_B,
    }),
  }),
});

const exerciseContinuationRebuild = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-continuation-rebuild-"));
  const providerTask = task({
    jobId: "job:continuation-rebuild",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const attemptId = "attempt:continuation-rebuild";
  let store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(providerTask, identityFor(providerTask), attemptId);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    const authority = continuationAuthority();
    const execution = (leaseVersion: number) => continuationExecution({
      root, evidence, authority, store, providerTask, attemptId, leaseVersion,
    });
    const call = continuationPersistCall(providerTask);
    const first = execution(1);
    const persisted = await first.tools.execute(call);
    await first.settle(null);
    const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
    assert.equal(typeof continuationRef, "string");
    store.close();
    const database = new Database(path.join(root, "production-runtime.sqlite"));
    const deleted = database.prepare("delete from production_continuations where continuation_ref=?")
      .run(continuationRef);
    database.close();
    assert.equal(deleted.changes, 1);
    store = new ProductionRuntimeStore(root);
    const recovered = execution(2);
    const rebuilt = await recovered.tools.execute(call);
    await recovered.settle(null);
    assert.equal(Reflect.get(rebuilt.value ?? {}, "continuationRef"), continuationRef);
    assert.equal(store.readGptContinuation(continuationRef as string)?.provider.prior_prompt_hash, HASH_A,
      "exact persisted evidence must rebuild only the missing local continuation row");
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

const exerciseAtomicReservationCompletionAndGrant = async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "agent-continuation-reservation-"));
  const originTask = task({
    jobId: "job:continuation-reservation-origin",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const originAttempt = "attempt:continuation-reservation-origin";
  const store = new ProductionRuntimeStore(root);
  try {
    store.acceptTask(originTask, identityFor(originTask), originAttempt);
    const evidence = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
    const origin = continuationExecution({
      root, evidence, authority: continuationAuthority(), store,
      providerTask: originTask, attemptId: originAttempt, leaseVersion: 1,
    });
    const reservationIdentityHash = hashCanonical({
      kind: "reservation-acceptance.v1", owner_ref: originTask.business_identity.owner_ref,
      subject_ref: originTask.business_identity.subject_ref,
    });
    const reservationFenceHash = hashCanonical({ kind: "reservation-fence.v1", reservationIdentityHash });
    const semanticContractHash = hashCanonical({ kind: "reservation-semantic-contract.v1" });
    const reserveInput = Object.freeze({
      reservationKind: "reusable_origin",
      reservationIdentityHash,
      ownerRef: originTask.business_identity.owner_ref,
      subjectRef: originTask.business_identity.subject_ref,
      authorizationRef: originTask.business_identity.authorization_ref,
      reservationFenceHash,
      reservationEffectHash: hashCanonical({ kind: "reservation-effect.v1", reservationIdentityHash }),
      originProvenanceHash: hashCanonical({ kind: "origin-provenance.v1", jobId: originTask.job_id }),
      semanticContractHash,
      laneVersion: 1,
    });
    const reserved = await origin.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "reserve-origin",
      child: "reserve_exact_gpt_continuation_once", actionOrdinal: 1, input: reserveInput,
    });
    const continuationRef = String(Reflect.get(reserved.value ?? {}, "continuationRef"));
    assert.equal(continuationRef, `gpt-continuation:${reservationIdentityHash.slice(7)}`);
    assert.equal(store.readGptContinuation(continuationRef), null,
      "an incomplete reservation must not enter the usable continuation read surface");
    await assert.rejects(
      origin.tools.execute({
        sessionKey: "", productStepId: "atomic-reservation", callId: "acquire-incomplete",
        child: "acquire_gpt_continuation_lane", actionOrdinal: 2,
        input: {
          continuationRef,
          ownerRef: originTask.business_identity.owner_ref,
          subjectRef: originTask.business_identity.subject_ref,
          authorization: {
            kind: "row_authorization",
            currentAuthorizationRef: originTask.business_identity.authorization_ref,
          },
        },
      }),
      (error: unknown) => typedExecutionFailure(error)?.code === "GPT_CONTINUATION_NOT_AUTHORIZED",
    );
    const provider = Object.freeze({
      provider_page_url: "https://chatgpt.com/c/continuation-reservation-origin",
      prior_task_id: originTask.job_id,
      prior_prompt_hash: HASH_A,
      prior_raw_output_hash: HASH_B,
      prior_turn_marker: "[GRASSEYE:continuation-reservation-origin]",
    });
    const checkpointInput = Object.freeze({
      checkpointKind: "text", sourceAttemptId: originAttempt,
      assistantTurnId: "conversation-turn-2", artifactRef: "artifact:reservation-origin",
      rawDomHash: HASH_A, semanticTextHash: HASH_B,
      canonicalConversationUrl: provider.provider_page_url, promptHash: HASH_A,
      turnMarker: provider.prior_turn_marker, evidenceRef: "evidence:reservation-origin", evidenceHash: HASH_B,
    });
    const checkpoint = Object.freeze({
      checkpoint_kind: "text", source_attempt_id: checkpointInput.sourceAttemptId,
      assistant_turn_id: checkpointInput.assistantTurnId, artifact_ref: checkpointInput.artifactRef,
      raw_dom_hash: checkpointInput.rawDomHash, semantic_text_hash: checkpointInput.semanticTextHash,
      canonical_conversation_url: checkpointInput.canonicalConversationUrl,
      prompt_hash: checkpointInput.promptHash, turn_marker: checkpointInput.turnMarker,
      evidence_ref: checkpointInput.evidenceRef, evidence_hash: checkpointInput.evidenceHash,
    });
    const semanticAdmissionReceipt = Object.freeze({
      schema_version: "exact-semantic-admission-receipt.v1",
      artifact_ref: checkpointInput.artifactRef,
      artifact_hash: HASH_B,
      contract_hash: semanticContractHash,
      contract_evaluation_hash: hashCanonical({
        kind: "exact-nested-result-contract-evaluation.v1",
        artifact_hash: HASH_B,
        contract_hash: semanticContractHash,
        outcome: "accepted",
      }),
      outcome: "accepted",
    });
    const semanticAdmissionReceiptHash = hashCanonical(semanticAdmissionReceipt);
    const semanticAdmissionReceiptRef = `semantic-admission:${semanticAdmissionReceiptHash.slice(7)}`;
    const opaqueReadGrantHash = hashCanonical({
      kind: "current_artifact_read_grant.v1",
      owner_ref: originTask.business_identity.owner_ref,
      subject_ref: originTask.business_identity.subject_ref,
      source_artifact_ref: checkpointInput.artifactRef,
      source_artifact_hash: HASH_B,
      source_checkpoint_hash: hashCanonical(checkpoint),
      semantic_admission_receipt_ref: semanticAdmissionReceiptRef,
      semantic_admission_receipt_hash: semanticAdmissionReceiptHash,
    });
    const completionReceiptHash = hashCanonical({
      kind: "gpt-continuation-completion.v1",
      reservation_identity_hash: reservationIdentityHash,
      continuation_ref: continuationRef,
      lane_version: 1,
      reservation_fence_hash: reservationFenceHash,
      conversation_identity_hash: gptContinuationIdentityHash(provider),
      checkpoint_hash: hashCanonical(checkpoint),
      artifact_ref: checkpointInput.artifactRef,
      artifact_hash: HASH_B,
      semantic_admission_receipt_ref: semanticAdmissionReceiptRef,
      semantic_admission_receipt_hash: semanticAdmissionReceiptHash,
      opaque_read_grant_hash: opaqueReadGrantHash,
    });
    const completionInput = Object.freeze({
      reservationIdentityHash, laneVersion: 1, reservationFenceHash, provider,
      checkpoint: checkpointInput, artifactRef: checkpointInput.artifactRef, artifactHash: HASH_B,
      semanticAdmissionReceiptRef, semanticAdmissionReceiptHash, semanticAdmissionReceipt,
      opaqueReadGrantHash, completionReceiptHash,
    });
    const completed = await origin.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "complete-origin",
      child: "complete_exact_gpt_continuation_reservation_once", actionOrdinal: 3, input: completionInput,
    });
    assert.equal(Reflect.get(completed.value ?? {}, "completionReceiptHash"), completionReceiptHash);
    assert.equal(store.readGptContinuation(continuationRef)?.completion_receipt_hash, completionReceiptHash,
      "completion must be durably readable before the Child returns");
    const acquired = await origin.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "acquire-complete",
      child: "acquire_gpt_continuation_lane", actionOrdinal: 4,
      input: {
        continuationRef,
        ownerRef: originTask.business_identity.owner_ref,
        subjectRef: originTask.business_identity.subject_ref,
        authorization: {
          kind: "row_authorization", currentAuthorizationRef: originTask.business_identity.authorization_ref,
        },
      },
    });
    const originLane = Reflect.get(acquired.value ?? {}, "lane_version");
    assert.equal(originLane, 2);
    await origin.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "release-complete",
      child: "release_gpt_continuation_lane", actionOrdinal: 5,
      input: { jobId: originTask.job_id, lane: acquired.value },
    });

    const currentTask = task({
      jobId: "job:continuation-reservation-current",
      productId: "public_knowledge_article_pipeline",
      actionId: "produce_article",
      extra: { business_identity: {
        owner_ref: originTask.business_identity.owner_ref,
        subject_ref: originTask.business_identity.subject_ref,
        authorization_ref: "authorization:current",
      } },
    });
    const currentAttempt = "attempt:continuation-reservation-current";
    store.acceptTask(currentTask, identityFor(currentTask), currentAttempt);
    const current = continuationExecution({
      root, evidence, authority: continuationAuthority(), store,
      providerTask: currentTask, attemptId: currentAttempt, leaseVersion: 1,
    });
    const parentManifestId = "manifest:parent";
    const parentManifestHash = hashCanonical({ parentManifestId, continuationRef });
    const laneUseGrantHash = hashCanonical({
      kind: "continuation_lane_use_grant.v1",
      current_job_id: currentTask.job_id,
      current_authorization_ref: currentTask.business_identity.authorization_ref,
      parent_authorization_ref: originTask.business_identity.authorization_ref,
      owner_ref: originTask.business_identity.owner_ref,
      subject_ref: originTask.business_identity.subject_ref,
      parent_manifest_id: parentManifestId,
      parent_manifest_hash: parentManifestHash,
      continuation_ref: continuationRef,
    });
    await assert.rejects(
      current.tools.execute({
        sessionKey: "", productStepId: "atomic-reservation", callId: "acquire-bad-grant",
        child: "acquire_gpt_continuation_lane", actionOrdinal: 6,
        input: {
          continuationRef, ownerRef: currentTask.business_identity.owner_ref,
          subjectRef: currentTask.business_identity.subject_ref, parentManifestId, parentManifestHash,
          authorization: {
            kind: "continuation_lane_use_grant", currentJobId: currentTask.job_id,
            currentAuthorizationRef: currentTask.business_identity.authorization_ref,
            opaqueLaneUseGrantHash: HASH_A,
          },
        },
      }),
      (error: unknown) => typedExecutionFailure(error)?.code === "GPT_CONTINUATION_LANE_USE_GRANT_INVALID",
    );
    const granted = await current.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "acquire-valid-grant",
      child: "acquire_gpt_continuation_lane", actionOrdinal: 7,
      input: {
        continuationRef, ownerRef: currentTask.business_identity.owner_ref,
        subjectRef: currentTask.business_identity.subject_ref, parentManifestId, parentManifestHash,
        authorization: {
          kind: "continuation_lane_use_grant", currentJobId: currentTask.job_id,
          currentAuthorizationRef: currentTask.business_identity.authorization_ref,
          opaqueLaneUseGrantHash: laneUseGrantHash,
        },
      },
    });
    assert.equal(Reflect.get(granted.value ?? {}, "lane_version"), 3);
    await current.tools.execute({
      sessionKey: "", productStepId: "atomic-reservation", callId: "release-granted",
      child: "release_gpt_continuation_lane", actionOrdinal: 8,
      input: { jobId: currentTask.job_id, lane: granted.value },
    });
    await current.settle(null);
    await origin.settle(null);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
};

await exerciseSubmissionLocatorRestart();
await exerciseFreshConfirmedSubmitLocatorRestart();
await exerciseFreshConfirmedSubmitMissingLocator();
await exerciseContinuationRebuild();
await exerciseAtomicReservationCompletionAndGrant();
