import assert from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gptExactCallIdentityHash } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { persistGptChildEvidence } from "../../src/lib/local-runtime/production/gpt-evidence-writer.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { HASH_A, HASH_B, identityFor, task } from "./agent-production-runtime-fixtures.js";
import { artifactReadbackExecution, attemptId, checkpointCall, digest, digestBytes, exerciseArtifactReadbackFailure, identity,
  persistCheckpointArtifact, providerTask, rawDomHtml, semanticText,
} from "./agent-production-gpt-artifact-readback-support.js";
import { exerciseTaskExactEffectRecovery } from "./agent-production-task-exact-effect-support.js";
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

  await exerciseTaskExactEffectRecovery({
    root, evidenceStore, store, runtimeLogger: frontierRuntimeLogger, normalExecution,
    providerTask, attemptId, continuationRef: continuationRef as string,
  });

  await exerciseArtifactReadbackFailure({ root, evidenceStore, store, runtimeLogger, frontierRef });
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}
