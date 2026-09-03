import assert from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  GptContinuationReadback,
  gptContinuationIdentityHash,
  gptExactCallIdentityHash,
  persistGptChildEvidence,
  type GptChildCapabilityIntent,
  type GptChildCapabilityProof,
  type GptChildCapabilityResult,
  type GptContinuationGeneratedImageCheckpoint,
  type GptContinuationOriginCheckpoint,
  type GptContinuationTextCheckpoint,
  type GptContinuationReadbackPort,
  type StoredGptContinuation,
} from "../index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../../lib/storage/index.js";

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonicalHash = (value: unknown): `sha256:${string}` => {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
    return typeof input === "string" ? input.normalize("NFC") : input;
  };
  return hash(JSON.stringify(canonical(value)));
};

const HASH_A = hash("a");
const HASH_B = hash("b");
const JOB_ID = "job:gpt-native-checkpoint-readback";
const ATTEMPT_ID = "attempt:gpt-native-checkpoint-readback";
const PLUGIN_ID = "acceptance-product";
const PLUGIN_VERSION = 16;
const URL = "https://chatgpt.com/c/gpt-native-checkpoint-readback";
const FRONTIER = canonicalHash({ kind: "gpt-native-checkpoint-frontier.v1" });

const successProof = <K extends "checkpoint_gpt_text_response" | "checkpoint_gpt_generated_image">(
  intent: GptChildCapabilityIntent<K>,
  evidenceHash: `sha256:${string}`,
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
  committedMutation: "no",
  postconditionResult: "passed",
  browserFact: null,
  nativeFailureCode: null,
  startedAt: "2026-09-03T00:00:00.000Z",
  endedAt: "2026-09-03T00:00:00.001Z",
  evidenceRef: `browser:${intent.callId}`,
  evidenceHash,
});

const root = await mkdtemp(path.join(tmpdir(), "gpt-native-checkpoint-readback-"));
try {
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(root));
  let ordinal = 0;
  const persistText = async (input: Readonly<{
    assistantTurnId: string;
    callId: string;
    promptHash: `sha256:${string}`;
    rawDomHtml: string;
    semanticText: string;
    turnMarker: string;
  }>): Promise<GptContinuationOriginCheckpoint | GptContinuationTextCheckpoint> => {
    ordinal += 1;
    const childInput = Object.freeze({
      assistantTurnId: input.assistantTurnId,
      canonicalConversationUrl: URL,
      expectedPromptHash: input.promptHash,
      expectedResponseHash: hash(input.semanticText),
      turnMarker: input.turnMarker,
    });
    const identity = Object.freeze({
      jobId: JOB_ID,
      attemptId: ATTEMPT_ID,
      pluginId: PLUGIN_ID,
      pluginVersion: PLUGIN_VERSION,
      productStepId: "checkpoint-readback",
      callId: input.callId,
      childCapabilityId: "checkpoint_gpt_text_response" as const,
      inputHash: canonicalHash(childInput),
    });
    const exactCallIdentityHash = gptExactCallIdentityHash(identity);
    const intent: GptChildCapabilityIntent<"checkpoint_gpt_text_response"> = Object.freeze({
      ...identity,
      executionId: `gpt-call:${exactCallIdentityHash.slice(7)}`,
      actionOrdinal: ordinal,
      input: childInput,
    });
    const evidenceHash = hash(`evidence:${input.callId}`);
    const result: GptChildCapabilityResult<"checkpoint_gpt_text_response"> = Object.freeze({
      status: "success",
      value: Object.freeze({
        assistantTurnId: input.assistantTurnId,
        rawDomHtml: input.rawDomHtml,
        rawDomHash: hash(input.rawDomHtml),
        semanticText: input.semanticText,
        semanticTextHash: hash(input.semanticText),
      }),
      proof: successProof(intent, evidenceHash),
      failureCode: null,
      failureCause: null,
      failureBrowserEffect: null,
    });
    const persisted = await persistGptChildEvidence({
      result, intent, evidenceStore, jobId: JOB_ID, attemptId: ATTEMPT_ID,
      stepId: identity.productStepId, exactCallIdentityHash,
    });
    return Object.freeze({
      ...(input.callId === "origin-text" ? {} : { checkpoint_kind: "text" as const }),
      source_attempt_id: ATTEMPT_ID,
      assistant_turn_id: input.assistantTurnId,
      artifact_ref: persisted.artifactRefs[0]!,
      raw_dom_hash: result.value.rawDomHash,
      semantic_text_hash: result.value.semanticTextHash,
      canonical_conversation_url: URL,
      prompt_hash: input.promptHash,
      turn_marker: input.turnMarker,
      evidence_ref: persisted.evidenceRef,
      evidence_hash: evidenceHash,
    });
  };

  const origin = await persistText({
    assistantTurnId: "conversation-turn-2",
    callId: "origin-text",
    promptHash: HASH_A,
    rawDomHtml: "<article><p>origin raw DOM</p></article>",
    semanticText: "origin semantic text",
    turnMarker: "[GRASSEYE:gpt-native-origin]",
  }) as GptContinuationOriginCheckpoint;
  const predecessor = await persistText({
    assistantTurnId: "conversation-turn-4",
    callId: "predecessor-text",
    promptHash: HASH_B,
    rawDomHtml: "<article><p>predecessor raw DOM</p></article>",
    semanticText: "predecessor semantic text",
    turnMarker: "[GRASSEYE:gpt-native-predecessor]",
  }) as GptContinuationTextCheckpoint;

  ordinal += 1;
  const originalBytes = new Uint8Array([1, 3, 5, 7, 9]);
  const webpBytes = new Uint8Array([2, 4, 6, 8]);
  const imageInput = Object.freeze({
    assistantTurnId: "conversation-turn-6",
    canonicalConversationUrl: URL,
    expectedMediaHash: hash(originalBytes),
    expectedPromptHash: HASH_A,
    predecessorTextCheckpoint: Object.freeze({
      checkpointKind: "text" as const,
      sourceAttemptId: predecessor.source_attempt_id,
      assistantTurnId: predecessor.assistant_turn_id,
      artifactRef: predecessor.artifact_ref,
      rawDomHash: predecessor.raw_dom_hash,
      semanticTextHash: predecessor.semantic_text_hash,
      canonicalConversationUrl: predecessor.canonical_conversation_url,
      promptHash: predecessor.prompt_hash,
      turnMarker: predecessor.turn_marker,
      evidenceRef: predecessor.evidence_ref,
      evidenceHash: predecessor.evidence_hash,
    }),
    turnMarker: "[GRASSEYE:gpt-native-image]",
  });
  const imageIdentity = Object.freeze({
    jobId: JOB_ID,
    attemptId: ATTEMPT_ID,
    pluginId: PLUGIN_ID,
    pluginVersion: PLUGIN_VERSION,
    productStepId: "checkpoint-readback",
    callId: "generated-image",
    childCapabilityId: "checkpoint_gpt_generated_image" as const,
    inputHash: canonicalHash(imageInput),
  });
  const imageExactCallIdentityHash = gptExactCallIdentityHash(imageIdentity);
  const imageIntent: GptChildCapabilityIntent<"checkpoint_gpt_generated_image"> = Object.freeze({
    ...imageIdentity,
    executionId: `gpt-call:${imageExactCallIdentityHash.slice(7)}`,
    actionOrdinal: ordinal,
    input: imageInput,
  });
  const imageEvidenceHash = hash("evidence:generated-image");
  const imageValue = Object.freeze({
      assistantTurnId: imageInput.assistantTurnId,
      semanticMediaId: "gpt-generated-image-main",
      mediaHash: hash(originalBytes),
      authorityTargetHash: HASH_A,
      authorityDocumentHash: HASH_B,
      canonicalConversationUrl: URL,
      promptHash: imageInput.expectedPromptHash,
      turnMarker: imageInput.turnMarker,
      artifactId: "airesult_gpt_native_image",
      originalBytes,
      webpBytes,
      originalSha256: hash(originalBytes),
      originalSizeBytes: originalBytes.byteLength,
      originalMediaType: "image/png",
      originalWidth: 1600,
      originalHeight: 900,
      sha256: hash(webpBytes),
      bytes: webpBytes.byteLength,
      mediaType: "image/webp",
      width: 1200,
      height: 630,
      predecessorTextCheckpoint: imageInput.predecessorTextCheckpoint,
  });
  const imageResult: GptChildCapabilityResult<"checkpoint_gpt_generated_image"> = Object.freeze({
    status: "success",
    value: imageValue,
    proof: successProof(imageIntent, imageEvidenceHash),
    failureCode: null,
    failureCause: null,
    failureBrowserEffect: null,
  });
  const imagePersisted = await persistGptChildEvidence({
    result: imageResult, intent: imageIntent, evidenceStore, jobId: JOB_ID, attemptId: ATTEMPT_ID,
    stepId: imageIdentity.productStepId, exactCallIdentityHash: imageExactCallIdentityHash,
  });
  const imageCheckpoint: GptContinuationGeneratedImageCheckpoint = Object.freeze({
    checkpoint_kind: "generated_image",
    source_attempt_id: ATTEMPT_ID,
    assistant_turn_id: imageInput.assistantTurnId,
    canonical_conversation_url: URL,
    prompt_hash: imageInput.expectedPromptHash,
    media_hash: imageValue.mediaHash,
    turn_marker: imageInput.turnMarker,
    original_artifact_ref: imagePersisted.artifactRefs[0]!,
    original_sha256: imageValue.originalSha256,
    original_bytes: originalBytes.byteLength,
    original_media_type: "image/png",
    original_width: 1600,
    original_height: 900,
    webp_artifact_ref: imagePersisted.artifactRefs[1]!,
    webp_sha256: imageValue.sha256,
    webp_bytes: webpBytes.byteLength,
    media_type: "image/webp",
    width: 1200,
    height: 630,
    evidence_ref: imagePersisted.evidenceRef,
    evidence_hash: imageEvidenceHash,
    predecessor_text_checkpoint: predecessor,
  });
  const originProvider = Object.freeze({
    provider_page_url: URL,
    prior_task_id: JOB_ID,
    prior_prompt_hash: origin.prompt_hash,
    prior_raw_output_hash: origin.semantic_text_hash,
    prior_turn_marker: origin.turn_marker,
  });
  const currentProvider = Object.freeze({
    provider_page_url: URL,
    prior_task_id: JOB_ID,
    prior_prompt_hash: imageCheckpoint.prompt_hash,
    prior_raw_output_hash: imageCheckpoint.media_hash,
    prior_turn_marker: imageCheckpoint.turn_marker,
  });
  const stored: StoredGptContinuation = Object.freeze({
    continuation_ref: "gpt-continuation:native-checkpoint-readback",
    reservation_kind: "persisted",
    reservation_identity_hash: HASH_A,
    origin_job_id: JOB_ID,
    origin_plugin_version: PLUGIN_VERSION,
    plugin_id: PLUGIN_ID,
    owner_ref: "owner:gpt-native",
    subject_ref: "subject:gpt-native",
    authorization_ref: "authorization:gpt-native",
    conversation_identity_hash: gptContinuationIdentityHash(currentProvider),
    frontier_ref: FRONTIER,
    source_checkpoint_hash: null,
    reservation_fence_hash: null,
    reservation_effect_hash: null,
    origin_provenance_hash: null,
    semantic_contract_hash: null,
    artifact_ref: null,
    artifact_hash: null,
    semantic_admission_receipt_ref: null,
    semantic_admission_receipt_hash: null,
    semantic_admission_receipt: null,
    opaque_read_grant_hash: null,
    completion_receipt_hash: null,
    origin_provider: originProvider,
    origin_checkpoint: origin,
    provider: currentProvider,
    current_checkpoint: imageCheckpoint,
    lane_version: 3,
    lane_owner_job_id: null,
  });
  const port: GptContinuationReadbackPort = Object.freeze({
    readGptContinuation: (ref: string) => ref === stored.continuation_ref ? stored : null,
    readGptContinuationForOriginJob: () => stored,
    readGptContinuationForFrontier: (ref: `sha256:${string}`) => ref === FRONTIER ? stored : null,
    readTaskPluginVersion: (jobId: string) => jobId === JOB_ID ? PLUGIN_VERSION : null,
  });
  const readback = await new GptContinuationReadback(evidenceStore, port).readExact({
    jobId: JOB_ID,
    continuationRef: stored.continuation_ref,
    ownerRef: stored.owner_ref,
    subjectRef: stored.subject_ref,
    authorizationRef: stored.authorization_ref,
    pluginId: PLUGIN_ID,
    pluginVersion: PLUGIN_VERSION,
  }, {
    lookupKind: "frontier_ref",
    frontierRef: FRONTIER,
    authorization: { kind: "origin_authorization", originAuthorizationRef: stored.authorization_ref },
  });
  assert.equal(readback?.lookupKind, "frontier_ref");
  if (readback?.lookupKind !== "frontier_ref") throw new Error("GPT_NATIVE_CHECKPOINT_READBACK_MISSING");
  assert.equal(readback.originCheckpoint.rawDomHtml, "<article><p>origin raw DOM</p></article>");
  assert.equal(readback.originCheckpoint.semanticText, "origin semantic text");
  assert.equal(readback.originCheckpoint.rawDomHash, hash(readback.originCheckpoint.rawDomHtml));
  assert.equal(readback.originCheckpoint.semanticTextHash, hash(readback.originCheckpoint.semanticText));
  assert.equal(readback.currentCheckpoint.checkpointKind, "generated_image");
  if (readback.currentCheckpoint.checkpointKind !== "generated_image") {
    throw new Error("GPT_NATIVE_IMAGE_CHECKPOINT_MISSING");
  }
  assert.deepEqual(readback.currentCheckpoint.originalBytes, originalBytes);
  assert.deepEqual(readback.currentCheckpoint.webpBytes, webpBytes);
  assert.equal(readback.currentCheckpoint.originalSha256, hash(originalBytes));
  assert.equal(readback.currentCheckpoint.webpSha256, hash(webpBytes));
  assert.equal(readback.currentCheckpoint.predecessorTextCheckpoint.assistantTurnId, "conversation-turn-4");
  assert.equal(readback.currentCheckpoint.predecessorTextCheckpoint.semanticText, "predecessor semantic text");
} finally {
  await rm(root, { recursive: true, force: true });
}
