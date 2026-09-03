import assert from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";
import {
  createGptAbilityGroup,
  gptContinuationIdentityHash,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildInputMap,
} from "../index.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";
import { ProductionRuntimeStore } from "../../../lib/local-runtime/production/store.js";
import {
  HASH_A,
  HASH_B,
  identityFor,
  task,
} from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

const temporary = await mkdtemp(path.join(tmpdir(), "gpt-continuation-child-"));
const store = new ProductionRuntimeStore(temporary);
try {
  const sourceTask = task({
    jobId: "job:gpt-continuation-child",
    productId: "public_knowledge_article_pipeline",
    actionId: "produce_article",
  });
  const identity = identityFor(sourceTask);
  store.acceptTask(sourceTask, identity, "attempt:gpt-continuation-child");
  const gpt = createGptAbilityGroup();
  let ordinal = 0;
  const execute = <K extends GptChildCapabilityId>(
    childCapabilityId: K,
    input: GptChildInputMap[K],
    fixedOrdinal?: number,
  ) => {
    ordinal = fixedOrdinal ?? ordinal + 1;
    const intent: GptChildCapabilityIntent<K> = {
      childCapabilityId,
      executionId: `acceptance:continuation:${childCapabilityId}:${ordinal}`,
      jobId: sourceTask.job_id,
      attemptId: "attempt:gpt-continuation-child",
      pluginId: identity.plugin_id,
      pluginVersion: identity.plugin_version,
      productStepId: "continuation-transaction",
      callId: childCapabilityId,
      inputHash: hashCanonical(input),
      actionOrdinal: ordinal,
      input,
    };
    return gpt.execute(Object.freeze(intent), { dataDir: temporary, continuationStore: store });
  };
  const provider = Object.freeze({
    provider_page_url: "https://chatgpt.com/c/gpt-continuation-child",
    prior_task_id: sourceTask.job_id,
    prior_prompt_hash: HASH_A,
    prior_raw_output_hash: HASH_B,
    prior_turn_marker: "[GRASSEYE:gpt-continuation-child]",
  });
  const checkpoint = Object.freeze({
    checkpointKind: "text" as const,
    sourceAttemptId: "attempt:gpt-continuation-child",
    assistantTurnId: "conversation-turn-2",
    artifactRef: "artifact:gpt-continuation-child",
    rawDomHash: HASH_A,
    semanticTextHash: HASH_B,
    canonicalConversationUrl: provider.provider_page_url,
    promptHash: provider.prior_prompt_hash,
    turnMarker: provider.prior_turn_marker,
    evidenceRef: "evidence:gpt-continuation-child",
    evidenceHash: HASH_B,
  });

  const persistInput = Object.freeze({
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
    provider,
    currentCheckpoint: checkpoint,
  });
  const persisted = await execute("persist_gpt_continuation", persistInput);
  assert.equal(persisted.status, "success", persisted.failureCode ?? "persist failed");
  assert.equal(persisted.proof.internalDecisionCode, "ACT");
  const persistedRef = persisted.value?.continuationRef;
  assert.equal(typeof persistedRef, "string");
  assert.equal(store.readGptContinuation(persistedRef!)?.current_checkpoint?.checkpoint_kind, "text",
    "persist must commit provider and checkpoint before returning");
  const persistedReadback = await execute("persist_gpt_continuation", persistInput, ordinal);
  assert.equal(persistedReadback.value?.continuationRef, persistedRef,
    "identical exact-call replay must read the original continuation");
  assert.equal(persistedReadback.proof.internalDecisionCode, "DONE");
  assert.equal(persistedReadback.proof.committedMutation, "no");

  const reservationIdentityHash = hashCanonical({ kind: "gpt-child-reservation.v1" });
  const reservationFenceHash = hashCanonical({ kind: "gpt-child-fence.v1", reservationIdentityHash });
  const semanticContractHash = hashCanonical({ kind: "gpt-child-semantic-contract.v1" });
  const reserveInput = Object.freeze({
    reservationKind: "reusable_origin" as const,
    reservationIdentityHash,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorizationRef: sourceTask.business_identity.authorization_ref,
    reservationFenceHash,
    reservationEffectHash: hashCanonical({ kind: "gpt-child-effect.v1", reservationIdentityHash }),
    originProvenanceHash: hashCanonical({ kind: "gpt-child-origin.v1", jobId: sourceTask.job_id }),
    semanticContractHash,
    laneVersion: 1,
  });
  const [reserved, reservedReplay] = await Promise.all([
    execute("reserve_exact_gpt_continuation_once", reserveInput),
    execute("reserve_exact_gpt_continuation_once", reserveInput),
  ]);
  assert.equal(reserved.status, "success", reserved.failureCode ?? "reserve failed");
  assert.equal(reservedReplay.status, "success", reservedReplay.failureCode ?? "reserve replay failed");
  assert.equal(reserved.value?.continuationRef, reservedReplay.value?.continuationRef);
  const continuationRef = reserved.value!.continuationRef;
  assert.equal(store.readGptContinuation(continuationRef), null,
    "incomplete reservation must stay outside the usable read surface");

  const incompleteAcquire = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  assert.equal(incompleteAcquire.status, "failed");
  assert.equal(incompleteAcquire.failureCode, "GPT_CONTINUATION_NOT_AUTHORIZED");

  const storedCheckpoint = Object.freeze({
    checkpoint_kind: "text" as const,
    source_attempt_id: checkpoint.sourceAttemptId,
    assistant_turn_id: checkpoint.assistantTurnId,
    artifact_ref: checkpoint.artifactRef,
    raw_dom_hash: checkpoint.rawDomHash,
    semantic_text_hash: checkpoint.semanticTextHash,
    canonical_conversation_url: checkpoint.canonicalConversationUrl,
    prompt_hash: checkpoint.promptHash,
    turn_marker: checkpoint.turnMarker,
    evidence_ref: checkpoint.evidenceRef,
    evidence_hash: checkpoint.evidenceHash,
  });
  const semanticAdmissionReceipt = Object.freeze({
    schema_version: "exact-semantic-admission-receipt.v1" as const,
    artifact_ref: checkpoint.artifactRef,
    artifact_hash: HASH_B,
    contract_hash: semanticContractHash,
    contract_evaluation_hash: hashCanonical({
      kind: "exact-nested-result-contract-evaluation.v1",
      artifact_hash: HASH_B,
      contract_hash: semanticContractHash,
      outcome: "accepted",
    }),
    outcome: "accepted" as const,
  });
  const semanticAdmissionReceiptHash = hashCanonical(semanticAdmissionReceipt);
  const semanticAdmissionReceiptRef = `semantic-admission:${semanticAdmissionReceiptHash.slice(7)}`;
  const opaqueReadGrantHash = hashCanonical({
    kind: "current_artifact_read_grant.v1",
    owner_ref: sourceTask.business_identity.owner_ref,
    subject_ref: sourceTask.business_identity.subject_ref,
    source_artifact_ref: checkpoint.artifactRef,
    source_artifact_hash: HASH_B,
    source_checkpoint_hash: hashCanonical(storedCheckpoint),
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
    checkpoint_hash: hashCanonical(storedCheckpoint),
    artifact_ref: checkpoint.artifactRef,
    artifact_hash: HASH_B,
    semantic_admission_receipt_ref: semanticAdmissionReceiptRef,
    semantic_admission_receipt_hash: semanticAdmissionReceiptHash,
    opaque_read_grant_hash: opaqueReadGrantHash,
  });
  const completionInput = Object.freeze({
    reservationIdentityHash,
    laneVersion: 1,
    reservationFenceHash,
    provider,
    checkpoint,
    artifactRef: checkpoint.artifactRef,
    artifactHash: HASH_B,
    semanticAdmissionReceiptRef,
    semanticAdmissionReceiptHash,
    semanticAdmissionReceipt,
    opaqueReadGrantHash,
    completionReceiptHash,
  });
  const completed = await execute("complete_exact_gpt_continuation_reservation_once", completionInput);
  assert.equal(completed.status, "success", completed.failureCode ?? "completion failed");
  assert.equal(completed.value?.completionReceiptHash, completionReceiptHash);
  assert.equal(store.readGptContinuation(continuationRef)?.completion_receipt_hash, completionReceiptHash,
    "completion fields must commit atomically before return");
  const completionReadback = await execute(
    "complete_exact_gpt_continuation_reservation_once", completionInput,
  );
  assert.equal(completionReadback.value?.completionReceiptHash, completionReceiptHash);
  assert.equal(completionReadback.proof.internalDecisionCode, "DONE");

  const acquired = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  assert.equal(acquired.status, "success", acquired.failureCode ?? "acquire failed");
  assert.equal(acquired.value?.lane_version, 2);

  const nextProvider = Object.freeze({ ...provider, prior_turn_marker: "[GRASSEYE:gpt-continuation-next]" });
  const nextCheckpoint = Object.freeze({
    ...checkpoint,
    assistantTurnId: "conversation-turn-4",
    artifactRef: "artifact:gpt-continuation-next",
    turnMarker: nextProvider.prior_turn_marker,
  });
  const advanced = await execute("advance_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: acquired.value!,
    provider: nextProvider,
    currentCheckpoint: nextCheckpoint,
  });
  assert.equal(advanced.status, "success", advanced.failureCode ?? "advance failed");
  const advancedRow = store.readGptContinuation(continuationRef)!;
  assert.equal(advancedRow.provider.prior_turn_marker, nextProvider.prior_turn_marker);
  assert.equal(advancedRow.current_checkpoint?.turn_marker, nextProvider.prior_turn_marker);
  assert.equal(advancedRow.lane_owner_job_id, null,
    "advance must atomically write provider/checkpoint and release the lane");
  const advancedReadback = await execute("advance_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: acquired.value!,
    provider: nextProvider,
    currentCheckpoint: nextCheckpoint,
  });
  assert.equal(advancedReadback.status, "success", advancedReadback.failureCode ?? "advance readback failed");
  assert.equal(advancedReadback.proof.internalDecisionCode, "DONE");

  const reacquired = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  const imageProvider = Object.freeze({
    ...nextProvider,
    prior_raw_output_hash: HASH_A,
    prior_turn_marker: "[GRASSEYE:gpt-continuation-image]",
  });
  const imageCheckpoint = Object.freeze({
    checkpointKind: "generated_image" as const,
    sourceAttemptId: "attempt:gpt-continuation-child",
    assistantTurnId: "conversation-turn-6",
    canonicalConversationUrl: imageProvider.provider_page_url,
    promptHash: imageProvider.prior_prompt_hash,
    mediaHash: imageProvider.prior_raw_output_hash,
    turnMarker: imageProvider.prior_turn_marker,
    originalArtifactRef: "artifact:gpt-continuation-image-original",
    originalSha256: HASH_A,
    originalBytes: 1024,
    originalMediaType: "image/png" as const,
    originalWidth: 1200,
    originalHeight: 630,
    webpArtifactRef: "artifact:gpt-continuation-image-webp",
    webpSha256: HASH_B,
    webpBytes: 768,
    mediaType: "image/webp" as const,
    width: 1200 as const,
    height: 630 as const,
    evidenceRef: "evidence:gpt-continuation-image",
    evidenceHash: HASH_B,
    predecessorTextCheckpoint: nextCheckpoint,
  });
  const imageAdvanced = await execute("advance_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    pluginId: identity.plugin_id,
    lane: reacquired.value!,
    provider: imageProvider,
    currentCheckpoint: imageCheckpoint,
  });
  assert.equal(imageAdvanced.status, "success", imageAdvanced.failureCode ?? "image advance failed");
  const imageRow = store.readGptContinuation(continuationRef)!;
  assert.equal(imageRow.current_checkpoint?.checkpoint_kind, "generated_image");
  assert.equal(
    imageRow.current_checkpoint?.checkpoint_kind === "generated_image"
      ? imageRow.current_checkpoint.predecessor_text_checkpoint.assistant_turn_id : null,
    nextCheckpoint.assistantTurnId,
    "generated-image advance must durably bind its direct predecessor text checkpoint",
  );

  const releaseLane = await execute("acquire_gpt_continuation_lane", {
    continuationRef,
    ownerRef: sourceTask.business_identity.owner_ref,
    subjectRef: sourceTask.business_identity.subject_ref,
    authorization: {
      kind: "row_authorization",
      currentAuthorizationRef: sourceTask.business_identity.authorization_ref,
    },
  });
  const released = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: releaseLane.value!,
  });
  assert.equal(released.status, "success", released.failureCode ?? "release failed");
  assert.equal(store.readGptContinuation(continuationRef)?.lane_owner_job_id, null);
  const releasedAgain = await execute("release_gpt_continuation_lane", {
    jobId: sourceTask.job_id,
    lane: releaseLane.value!,
  });
  assert.equal(releasedAgain.status, "success", releasedAgain.failureCode ?? "release readback failed");
  assert.equal(releasedAgain.proof.internalDecisionCode, "DONE");

  const database = new Database(path.join(temporary, "production-runtime.sqlite"), { readonly: true });
  const rowCount = Number((database.prepare(
    "select count(*) as count from production_continuations where reservation_identity_hash=?",
  ).get(reservationIdentityHash) as { count: number }).count);
  database.close();
  assert.equal(rowCount, 1, "concurrent identical reserve calls must create exactly one durable row");
} finally {
  store.close();
  await rm(temporary, { recursive: true, force: true });
}

emitQualityProofObservation({
  lawId: "LAW-GPT-001-V20",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:15", "forbidden:16", "summary"],
  locator: "acceptance:gpt-continuation-transaction:state-machine",
  observedValue: "continuation reserve complete acquire advance release and identical readback transitions exercised",
});
