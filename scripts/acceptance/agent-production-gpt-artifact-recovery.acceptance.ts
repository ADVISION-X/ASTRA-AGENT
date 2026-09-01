import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGptAbilityGroup, gptExactCallIdentityHash } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { ProductionGptChildTools, type ProductGptExecution } from "../../src/lib/local-runtime/production/production-gpt-child-tools.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import type { WorkbenchBrowserAuthority } from "../../src/lib/local-runtime/workbench-browser-authority-support.js";
import type { BrowserExecutionBinding } from "../../src/lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";
import { artifactReadbackExecution, attemptId, checkpointCall, digest, digestBytes, exerciseArtifactReadbackFailure, identity,
  persistCheckpointArtifact, providerTask, rawDomHtml, semanticText,
} from "./agent-production-gpt-artifact-readback-support.js";
const root = await mkdtemp(path.join(tmpdir(), "agent-artifact-readback-terminal-"));
const store = new ProductionRuntimeStore(root);
try {
  store.acceptTask(providerTask, identityFor(providerTask), attemptId);
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  await persistCheckpointArtifact(evidenceStore);
  const runtimeLogger = createRuntimeLogger({
    producer: "agent-artifact-readback-terminal",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(root, "runtime-logs") },
  });
  const exactCallIdentityHash = gptExactCallIdentityHash(identity);
  const checkpointEvidence = await evidenceStore.readExactCallEvidence({
    missionId: providerTask.job_id, runId: attemptId, exactCallIdentityHash,
  });
  assert(checkpointEvidence);
  const artifactRefs = checkpointEvidence.record.artifactRefs as readonly string[];
  const payload = checkpointEvidence.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(artifactRefs.length, 1);
  const frontierRef = hashCanonical({
    identity_type: "gpt-continuation-frontier.v1",
    job_id: providerTask.job_id,
    plugin_id: "public-knowledge-article-pipeline",
    owner_ref: providerTask.business_identity.owner_ref,
    subject_ref: providerTask.business_identity.subject_ref,
    authorization_ref: providerTask.business_identity.authorization_ref,
    product_step_id: "corpus_research",
  });
  const frontierRuntimeLogger = createRuntimeLogger({
    producer: "agent-frontier-artifact-readback",
    owner: "production-runtime",
    component: "gpt-child",
    terminalEnabled: false,
    fileSink: { directoryPath: path.join(root, "frontier-runtime-logs") },
  });
  const normalExecution = artifactReadbackExecution({
    root, evidenceStore, store, runtimeLogger: frontierRuntimeLogger,
  });
  const persisted = await normalExecution.tools.execute({
    sessionKey: "session:frontier-readback",
    productStepId: "corpus_research",
    callId: "continuation-persist",
    child: "persist_gpt_continuation",
    actionOrdinal: 16,
    input: {
      jobId: providerTask.job_id,
      pluginId: "public-knowledge-article-pipeline",
      ownerRef: providerTask.business_identity.owner_ref,
      subjectRef: providerTask.business_identity.subject_ref,
      authorizationRef: providerTask.business_identity.authorization_ref,
      provider: {
        provider_page_url: checkpointCall.input.canonicalConversationUrl,
        prior_task_id: providerTask.job_id,
        prior_prompt_hash: checkpointCall.input.expectedPromptHash,
        prior_raw_output_hash: checkpointCall.input.expectedResponseHash,
        prior_turn_marker: checkpointCall.input.turnMarker,
      },
      currentCheckpoint: {
        checkpointKind: "text",
        sourceAttemptId: attemptId,
        assistantTurnId: checkpointCall.input.assistantTurnId,
        artifactRef: artifactRefs[0]!,
        rawDomHash: digest(rawDomHtml),
        semanticTextHash: digest(semanticText),
        canonicalConversationUrl: checkpointCall.input.canonicalConversationUrl,
        promptHash: checkpointCall.input.expectedPromptHash,
        turnMarker: checkpointCall.input.turnMarker,
        evidenceRef: checkpointEvidence.recordRef,
        evidenceHash: payload.source_evidence_hash as `sha256:${string}`,
      },
      frontier: {
        frontierRef,
        originCheckpoint: {
          sourceAttemptId: attemptId,
          assistantTurnId: checkpointCall.input.assistantTurnId,
          artifactRef: artifactRefs[0]!,
          rawDomHash: digest(rawDomHtml),
          semanticTextHash: digest(semanticText),
          canonicalConversationUrl: checkpointCall.input.canonicalConversationUrl,
          promptHash: checkpointCall.input.expectedPromptHash,
          turnMarker: checkpointCall.input.turnMarker,
          evidenceRef: checkpointEvidence.recordRef,
          evidenceHash: payload.source_evidence_hash as `sha256:${string}`,
        },
      },
    },
  });
  const continuationRef = Reflect.get(persisted.value ?? {}, "continuationRef");
  assert.equal(typeof continuationRef, "string");
  const frontier = await normalExecution.tools.readContinuationExact({
    lookupKind: "frontier_ref", frontierRef,
  });
  assert.equal(frontier?.lookupKind, "frontier_ref");
  if (frontier?.lookupKind !== "frontier_ref") throw new Error("FRONTIER_READBACK_MISSING");
  assert.equal(frontier.originCheckpoint.rawDomHtml, rawDomHtml);
  assert.equal(frontier.originCheckpoint.semanticText, semanticText);
  assert.equal(frontier.originCheckpoint.rawDomHash, digest(rawDomHtml));
  assert.equal(frontier.originCheckpoint.semanticTextHash, digest(semanticText));

  const articleText = '{"schema_version":"public-knowledge-article-output.v3","title":"recovered"}';
  const articleRawDom = `<div>${articleText}</div>`;
  const articleInput = {
    assistantTurnId: "conversation-turn-4",
    canonicalConversationUrl: checkpointCall.input.canonicalConversationUrl,
    expectedPromptHash: HASH_B,
    expectedResponseHash: digest(articleText),
    turnMarker: "[GRASSEYE:artifact-readback-article]",
  } as const;
  const articleIdentity = {
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: "article_synthesis",
    callId: "text-checkpoint",
    childCapabilityId: "checkpoint_gpt_text_response" as const,
    inputHash: hashCanonical(articleInput),
  };
  const articleExactHash = gptExactCallIdentityHash(articleIdentity);
  const articleTimestamp = new Date().toISOString();
  await persistGptChildEvidence({
    intent: {
      ...articleIdentity,
      executionId: `gpt-call:${articleExactHash.slice(7)}`,
      actionOrdinal: 30,
      input: articleInput,
    },
    evidenceStore,
    jobId: providerTask.job_id,
    attemptId,
    stepId: "article_synthesis",
    exactCallIdentityHash: articleExactHash,
    result: {
      status: "success",
      failureCode: null,
      failureCause: null,
      value: {
        assistantTurnId: articleInput.assistantTurnId,
        rawDomHtml: articleRawDom,
        rawDomHash: digest(articleRawDom),
        semanticText: articleText,
        semanticTextHash: digest(articleText),
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...articleIdentity,
        executionId: `gpt-call:${articleExactHash.slice(7)}`,
        actionOrdinal: 30,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["article checkpoint"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: articleTimestamp,
        endedAt: articleTimestamp,
        evidenceRef: "browser:article-checkpoint",
        evidenceHash: HASH_B,
      },
    },
  });
  const articleEvidence = await evidenceStore.readExactCallEvidence({
    missionId: providerTask.job_id,
    runId: attemptId,
    exactCallIdentityHash: articleExactHash,
  });
  assert(articleEvidence);
  const articleArtifactRefs = articleEvidence.record.artifactRefs as readonly string[];
  const articlePayload = articleEvidence.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(articleArtifactRefs.length, 1);

  const originalBytes = new Uint8Array([1, 2, 3, 4]);
  const webpBytes = new Uint8Array([5, 6, 7]);
  const mediaHash = digestBytes(originalBytes);
  const webpHash = digestBytes(webpBytes);
  const imageInput = {
    assistantTurnId: "conversation-turn-6",
    canonicalConversationUrl: checkpointCall.input.canonicalConversationUrl,
    expectedMediaHash: mediaHash,
    expectedPromptHash: HASH_A,
    turnMarker: "[GRASSEYE:artifact-readback-image]",
  } as const;
  const imageIdentity = {
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: "article_image_generation",
    callId: "image-checkpoint",
    childCapabilityId: "checkpoint_gpt_generated_image" as const,
    inputHash: hashCanonical(imageInput),
  };
  const imageExactHash = gptExactCallIdentityHash(imageIdentity);
  const imageTimestamp = new Date().toISOString();
  await persistGptChildEvidence({
    intent: {
      ...imageIdentity,
      executionId: `gpt-call:${imageExactHash.slice(7)}`,
      actionOrdinal: 45,
      input: imageInput,
    },
    evidenceStore,
    jobId: providerTask.job_id,
    attemptId,
    stepId: "article_image_generation",
    exactCallIdentityHash: imageExactHash,
    result: {
      status: "success",
      failureCode: null,
      failureCause: null,
      value: {
        assistantTurnId: imageInput.assistantTurnId,
        semanticMediaId: "gpt-generated-image-main",
        mediaHash,
        authorityTargetHash: HASH_A,
        authorityDocumentHash: HASH_B,
        canonicalConversationUrl: imageInput.canonicalConversationUrl,
        promptHash: imageInput.expectedPromptHash,
        turnMarker: imageInput.turnMarker,
        artifactId: "airesult_recovered_image",
        originalBytes,
        webpBytes,
        originalSha256: mediaHash,
        originalSizeBytes: originalBytes.byteLength,
        originalMediaType: "image/png",
        originalWidth: 1200,
        originalHeight: 630,
        sha256: webpHash,
        bytes: webpBytes.byteLength,
        mediaType: "image/webp",
        width: 1200,
        height: 630,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...imageIdentity,
        executionId: `gpt-call:${imageExactHash.slice(7)}`,
        actionOrdinal: 45,
        targetRefHash: HASH_A,
        beforeDocumentRefHash: HASH_A,
        afterDocumentRefHash: HASH_B,
        candidateCount: 1,
        observedSemantics: ["image checkpoint"],
        committedMutation: "no",
        postconditionResult: "passed",
        startedAt: imageTimestamp,
        endedAt: imageTimestamp,
        evidenceRef: "browser:image-checkpoint",
        evidenceHash: HASH_B,
      },
    },
  });
  const imageEvidence = await evidenceStore.readExactCallEvidence({
    missionId: providerTask.job_id,
    runId: attemptId,
    exactCallIdentityHash: imageExactHash,
  });
  assert(imageEvidence);
  const imageArtifactRefs = imageEvidence.record.artifactRefs as readonly string[];
  const imagePayload = imageEvidence.record.payload as Readonly<Record<string, unknown>>;
  assert.equal(imageArtifactRefs.length, 3);

  const lane = await normalExecution.tools.execute({
    sessionKey: "session:image-frontier",
    productStepId: "article_image_generation",
    callId: "continuation-acquire",
    child: "acquire_gpt_continuation_lane",
    actionOrdinal: 32,
    input: {
      continuationRef: frontier.continuationRef,
      jobId: providerTask.job_id,
      pluginId: "public-knowledge-article-pipeline",
      allowedSourcePluginIds: ["public-knowledge-article-pipeline"],
      ownerRef: providerTask.business_identity.owner_ref,
      subjectRef: providerTask.business_identity.subject_ref,
      authorizationRef: providerTask.business_identity.authorization_ref,
    },
  });
  const imageProvider = {
    provider_page_url: imageInput.canonicalConversationUrl,
    prior_task_id: providerTask.job_id,
    prior_prompt_hash: imageInput.expectedPromptHash,
    prior_raw_output_hash: mediaHash,
    prior_turn_marker: imageInput.turnMarker,
  } as const;
  await normalExecution.tools.execute({
    sessionKey: "session:image-frontier",
    productStepId: "article_image_generation",
    callId: "continuation-advance",
    child: "advance_gpt_continuation_lane",
    actionOrdinal: 46,
    input: {
      jobId: providerTask.job_id,
      pluginId: "public-knowledge-article-pipeline",
      lane: lane.value as Readonly<Record<string, unknown>>,
      provider: imageProvider,
      currentCheckpoint: {
        checkpointKind: "generated_image",
        sourceAttemptId: attemptId,
        assistantTurnId: imageInput.assistantTurnId,
        canonicalConversationUrl: imageInput.canonicalConversationUrl,
        promptHash: imageInput.expectedPromptHash,
        mediaHash,
        turnMarker: imageInput.turnMarker,
        originalArtifactRef: imageArtifactRefs[0]!,
        originalSha256: mediaHash,
        originalBytes: originalBytes.byteLength,
        originalMediaType: "image/png",
        originalWidth: 1200,
        originalHeight: 630,
        webpArtifactRef: imageArtifactRefs[1]!,
        webpSha256: webpHash,
        webpBytes: webpBytes.byteLength,
        mediaType: "image/webp",
        width: 1200,
        height: 630,
        evidenceRef: imageEvidence.recordRef,
        evidenceHash: imagePayload.source_evidence_hash as `sha256:${string}`,
        predecessorTextCheckpoint: {
          checkpointKind: "text",
          sourceAttemptId: attemptId,
          assistantTurnId: articleInput.assistantTurnId,
          artifactRef: articleArtifactRefs[0]!,
          rawDomHash: digest(articleRawDom),
          semanticTextHash: digest(articleText),
          canonicalConversationUrl: articleInput.canonicalConversationUrl,
          promptHash: articleInput.expectedPromptHash,
          turnMarker: articleInput.turnMarker,
          evidenceRef: articleEvidence.recordRef,
          evidenceHash: articlePayload.source_evidence_hash as `sha256:${string}`,
        },
      },
    },
  });
  const imageFrontier = await normalExecution.tools.readContinuationExact({
    lookupKind: "frontier_ref", frontierRef,
  });
  assert.equal(imageFrontier?.lookupKind, "frontier_ref");
  if (imageFrontier?.lookupKind !== "frontier_ref") throw new Error("IMAGE_FRONTIER_READBACK_MISSING");
  assert.equal(imageFrontier.currentCheckpoint.checkpointKind, "generated_image");
  if (imageFrontier.currentCheckpoint.checkpointKind !== "generated_image") {
    throw new Error("IMAGE_FRONTIER_CHECKPOINT_MISSING");
  }
  assert.deepEqual(imageFrontier.currentCheckpoint.originalBytes, originalBytes);
  assert.deepEqual(imageFrontier.currentCheckpoint.webpBytes, webpBytes);
  assert.equal(imageFrontier.currentCheckpoint.predecessorTextCheckpoint.semanticText, articleText);

  const failedCall = Object.freeze({
    sessionKey: "session:failed-fact-replay",
    productStepId: "article_image_generation",
    callId: "failed-release-replay",
    child: "release_gpt_continuation_lane" as const,
    actionOrdinal: 47,
    input: Object.freeze({ jobId: providerTask.job_id, lane: { continuation_ref: "missing" } }),
  });
  const failedIdentity = {
    jobId: providerTask.job_id,
    attemptId,
    pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16,
    productStepId: failedCall.productStepId,
    callId: failedCall.callId,
    childCapabilityId: failedCall.child,
    inputHash: hashCanonical(failedCall.input),
  } as const;
  const failedExactHash = gptExactCallIdentityHash(failedIdentity);
  const failedAt = new Date().toISOString();
  await persistGptChildEvidence({
    intent: {
      ...failedIdentity, executionId: `gpt-call:${failedExactHash.slice(7)}`,
      actionOrdinal: failedCall.actionOrdinal, input: failedCall.input,
    },
    evidenceStore, jobId: providerTask.job_id, attemptId,
    stepId: failedCall.productStepId, exactCallIdentityHash: failedExactHash,
    result: {
      status: "failed",
      value: null,
      failureCode: "GPT_CONTINUATION_RELEASE_TEST_FAILURE",
      failureCause: { name: "Error", code: "ECONNRESET" },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...failedIdentity, executionId: `gpt-call:${failedExactHash.slice(7)}`,
        actionOrdinal: failedCall.actionOrdinal,
        targetRefHash: null, beforeDocumentRefHash: null, afterDocumentRefHash: null,
        candidateCount: null, observedSemantics: ["failed exact fact"], committedMutation: "no",
        postconditionResult: "failed", startedAt: failedAt, endedAt: failedAt,
        evidenceRef: "gpt:test-failed-fact", evidenceHash: HASH_B,
      },
    },
  });
  await assert.rejects(
    () => normalExecution.tools.execute(failedCall),
    (error: unknown) => {
      const typed = typedExecutionFailure(error);
      return typed?.code === "GPT_CONTINUATION_RELEASE_TEST_FAILURE"
        && typeof typed.cause === "object" && typed.cause !== null
        && Reflect.get(typed.cause, "code") === "ECONNRESET";
    },
    "a failed exact-call evidence fact must replay the original failure and native cause, never success",
  );

  const imageSubmitCall = Object.freeze({
    productStepId: "article_image_generation",
    callId: "turn-submit",
    child: "submit_exact_gpt_turn_once" as const,
    actionOrdinal: 42,
    input: Object.freeze({ promptHash: HASH_A, turnMarker: "[GRASSEYE:frozen-article-source]" }),
  });
  const priorSubmitIdentity = {
    jobId: providerTask.job_id, attemptId, pluginId: "public-knowledge-article-pipeline",
    pluginVersion: 16, productStepId: imageSubmitCall.productStepId, callId: imageSubmitCall.callId,
    childCapabilityId: imageSubmitCall.child, inputHash: hashCanonical(imageSubmitCall.input),
  } as const;
  const priorSubmitHash = gptExactCallIdentityHash(priorSubmitIdentity);
  const submittedAt = new Date().toISOString();
  await persistGptChildEvidence({
    intent: {
      ...priorSubmitIdentity, executionId: `gpt-call:${priorSubmitHash.slice(7)}`,
      actionOrdinal: imageSubmitCall.actionOrdinal, input: imageSubmitCall.input,
    },
    evidenceStore, jobId: providerTask.job_id, attemptId,
    stepId: imageSubmitCall.productStepId, exactCallIdentityHash: priorSubmitHash,
    result: {
      status: "success", value: null, failureCode: null, failureCause: null,
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...priorSubmitIdentity, executionId: `gpt-call:${priorSubmitHash.slice(7)}`,
        actionOrdinal: imageSubmitCall.actionOrdinal,
        targetRefHash: HASH_A, beforeDocumentRefHash: HASH_A, afterDocumentRefHash: HASH_A,
        candidateCount: 1, observedSemantics: ["confirmed prior image submit"],
        committedMutation: "confirmed", postconditionResult: "passed",
        startedAt: submittedAt, endedAt: submittedAt,
        evidenceRef: "browser:prior-image-submit", evidenceHash: HASH_B,
      },
    },
  });
  store.recordAttemptFailure(providerTask.job_id, attemptId, {
    code: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", mutation_outcome: "no",
    evidence_ref: null, evidence_hash: null, cause: null,
  });
  const nextAttemptId = "attempt:artifact-readback-terminal:2";
  const recoveryTask = providerTask;
  store.acceptTask(recoveryTask, identityFor(recoveryTask), nextAttemptId);
  const storedContinuation = store.readGptContinuation(continuationRef as string);
  assert(storedContinuation);
  const locatorCall = Object.freeze({
    sessionKey: "session:task-exact-effect-locator",
    productStepId: imageSubmitCall.productStepId,
    callId: "submission-reconcile",
    child: "reconcile_gpt_turn_submission" as const,
    actionOrdinal: 43,
    input: Object.freeze({
      expectedPromptHash: imageSubmitCall.input.promptHash,
      timeoutMs: 60_000,
      turnMarker: imageSubmitCall.input.turnMarker,
    }),
  });
  const locatorIdentity = {
    jobId: providerTask.job_id, attemptId: nextAttemptId,
    pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    productStepId: locatorCall.productStepId, callId: locatorCall.callId,
    childCapabilityId: locatorCall.child, inputHash: hashCanonical(locatorCall.input),
  } as const;
  const locatorExactHash = gptExactCallIdentityHash(locatorIdentity);
  const locatorUserTurnId = "conversation-turn-4";
  const locatorConversationIdentityHash = digest(
    `${storedContinuation.provider.provider_page_url}\n${imageSubmitCall.input.turnMarker}\n${locatorUserTurnId}\n${imageSubmitCall.input.promptHash}`,
  );
  await persistGptChildEvidence({
    intent: {
      ...locatorIdentity, executionId: `gpt-call:${locatorExactHash.slice(7)}`,
      actionOrdinal: locatorCall.actionOrdinal, input: locatorCall.input,
    },
    evidenceStore, jobId: providerTask.job_id, attemptId: nextAttemptId,
    stepId: locatorCall.productStepId, exactCallIdentityHash: locatorExactHash,
    result: {
      status: "success", failureCode: null, failureCause: null,
      value: {
        canonicalConversationUrl: storedContinuation.provider.provider_page_url,
        turnMarker: imageSubmitCall.input.turnMarker,
        userTurnId: locatorUserTurnId,
        promptHash: imageSubmitCall.input.promptHash,
        conversationIdentityHash: locatorConversationIdentityHash,
      },
      proof: {
        schemaVersion: "gpt-child-capability-proof.v2",
        ...locatorIdentity, executionId: `gpt-call:${locatorExactHash.slice(7)}`,
        actionOrdinal: locatorCall.actionOrdinal,
        targetRefHash: HASH_A, beforeDocumentRefHash: HASH_A, afterDocumentRefHash: HASH_A,
        candidateCount: 1, observedSemantics: ["durable submission locator"],
        committedMutation: "no", postconditionResult: "passed",
        startedAt: submittedAt, endedAt: submittedAt,
        evidenceRef: "browser:prior-image-submission-locator", evidenceHash: HASH_B,
      },
    },
  });
  const capturedRecoveryBinding = { value: null as BrowserExecutionBinding | null };
  const exactEffectAuthority = Object.assign(Object.create(null) as WorkbenchBrowserAuthority, {
    readExactCallMutationFact: (query: Readonly<{
      attemptId: string; exactCallIdentityHash: `sha256:${string}`;
    }>) => query.attemptId === attemptId && query.exactCallIdentityHash === priorSubmitHash
      ? {
        effectScope: "provider_effect" as const,
        outcome: "CONFIRMED" as const,
        terminalAt: submittedAt,
        targetRef: "target:prior-image-submit",
        documentRef: "document:prior-image-submit",
        productStepId: imageSubmitCall.productStepId,
        callId: imageSubmitCall.callId,
        childCapabilityId: imageSubmitCall.child,
        actionOrdinal: imageSubmitCall.actionOrdinal,
      }
      : null,
    countProviderTurnDispatches: () => 0,
    acquireJobBoundTargetLease: async (binding: BrowserExecutionBinding) => {
      capturedRecoveryBinding.value = binding;
      throw new Error("CAPTURED_TASK_EXACT_EFFECT_BROWSER_BINDING");
    },
  });
  const nextExecution = new ProductionGptChildTools(
    root, HASH_A, createGptAbilityGroup(), evidenceStore, exactEffectAuthority, store,
    frontierRuntimeLogger,
  ).createExecution({
    task: recoveryTask, pluginId: "public-knowledge-article-pipeline", pluginVersion: 16,
    lease: {
      attempt_id: nextAttemptId, device_id: "device:task-exact-effect", lease_version: 2,
      execution_fence_hash: HASH_A, control_manifest_hash: HASH_A, max_provider_turns: 2,
      provider_turns_used: 0, expires_at_monotonic: performance.now() + 10_000,
      command_ttl_ms: 1_000, abort_signal: new AbortController().signal,
    },
    parentSpanId: "span:task-exact-effect",
  });
  const currentFacts = await nextExecution.tools.readCallFacts(imageSubmitCall);
  assert.equal(currentFacts.mutation, null, "current-attempt lookup must not widen to an older attempt");
  const taskFacts = await nextExecution.tools.readCallFacts({
    ...imageSubmitCall, lookupKind: "task_exact_effect",
  });
  assert.equal(taskFacts.exactCallIdentityHash, priorSubmitHash);
  assert.equal(taskFacts.mutation?.outcome, "CONFIRMED");
  assert.equal(taskFacts.evidence?.readbackVerified, true);
  await nextExecution.tools.execute(locatorCall);
  await assert.rejects(
    nextExecution.tools.execute({
      sessionKey: "session:task-exact-effect-readback",
      productStepId: imageSubmitCall.productStepId,
      callId: "focus-recovered-conversation",
      child: "focus_exact_gpt_conversation",
      actionOrdinal: 43,
      input: { canonicalConversationUrl: storedContinuation.provider.provider_page_url },
    }),
    (error) => error instanceof Error && error.cause instanceof Error
      && error.cause.message === "CAPTURED_TASK_EXACT_EFFECT_BROWSER_BINDING",
  );
  assert.equal(capturedRecoveryBinding.value?.kind, "production-reconciliation",
    "only the unique Browser CONFIRMED plus Forensics passed fact may project a reconciliation binding");
  const captured = capturedRecoveryBinding.value;
  if (captured?.kind !== "production-reconciliation") {
    throw new Error("CONFIRMED_PROVIDER_READBACK_BINDING_MISSING");
  }
  assert.equal(captured.confirmedProviderReadback.sourceExactCallIdentityHash, priorSubmitHash);
  assert.equal(captured.confirmedProviderReadback.evidenceRef, taskFacts.evidence?.evidenceRef);
  assert.equal(captured.confirmedProviderReadback.canonicalConversationUrl,
    storedContinuation.provider.provider_page_url);
  assert.equal(captured.confirmedProviderReadback.promptHash, imageSubmitCall.input.promptHash);
  assert.equal(captured.confirmedProviderReadback.turnMarker, imageSubmitCall.input.turnMarker);
  await nextExecution.settle(null);
  await normalExecution.settle(null);

  await exerciseArtifactReadbackFailure({ root, evidenceStore, store, runtimeLogger, frontierRef });
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}
