import {
  type GptContinuationLane,
} from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  gptTextContinuationCheckpointInput,
  type SharedExecutionContext,
} from "../../lib/local-runtime/production/plugin.js";
import { failureCode } from "../../lib/typed-failure.js";
import { localBaziPrivateBaseTurn } from "./private-base-turn-contract.js";
import {
  applyAttachments,
  applyProfile,
  checkpointRecord,
  fail,
  hashValue,
  integerValue,
  objectValue,
  providerFor,
  submitTurn,
  textValue,
  uploadedFilesForRoles,
  type OwnedExecution,
} from "./product-turn.js";
import {
  baseFactsFromReadback,
  basePrompt,
  completionHashes,
  reservationValue,
  validateBaseOutput,
  type BaseFacts,
} from "./private-base-admission.js";

export const createOrReadBase = async (
  task: WebsiteAgentTask,
  context: SharedExecutionContext,
  flow: OwnedExecution,
  baseInput: Record<string, unknown>,
  identity: ProductionHash,
): Promise<BaseFacts> => {
  const candidate = task.parameters.reusable_base_candidate === null
    ? null : objectValue(task.parameters.reusable_base_candidate, "BAZI_REUSABLE_BASE_CANDIDATE_INVALID");
  if (candidate && (candidate.reusable_identity_hash !== identity
    || typeof candidate.source_job_id !== "string" || !candidate.source_job_id)) {
    fail("BAZI_REUSABLE_BASE_CANDIDATE_INVALID");
  }
  const candidateGrant = candidate
    ? hashValue(candidate.opaque_read_grant_hash, "BAZI_REUSABLE_BASE_CANDIDATE_INVALID") : null;
  const existing = await context.gpt.readContinuationExact({
    lookupKind: "frontier_ref",
    frontierRef: identity,
    authorization: candidateGrant ? {
      kind: "current_artifact_read_grant",
      currentAuthorizationRef: task.business_identity.authorization_ref,
      opaqueReadGrantHash: candidateGrant,
    } : {
      kind: "origin_authorization",
      originAuthorizationRef: task.business_identity.authorization_ref,
    },
  });
  if (existing) return baseFactsFromReadback(task, identity, baseInput, existing, candidateGrant);
  const fenceHash = hashCanonical({ kind: "bazi-reusable-base-reservation-fence.v1", identity });
  const reserve = reservationValue((await flow.execute({
    productStepId: "private-base", callId: "reserve-reusable-origin",
    child: "reserve_exact_gpt_continuation_once", actionOrdinal: 1,
    input: {
      reservationKind: "reusable_origin",
      reservationIdentityHash: identity,
      ownerRef: task.business_identity.owner_ref,
      subjectRef: task.business_identity.subject_ref,
      authorizationRef: task.business_identity.authorization_ref,
      reservationFenceHash: fenceHash,
      reservationEffectHash: hashCanonical({ kind: "bazi-reusable-base-effect.v1", identity }),
      originProvenanceHash: hashCanonical({ kind: "bazi-reusable-base-origin.v1", job_id: task.job_id }),
      semanticContractHash: hashCanonical(objectValue(
        baseInput.base_output_contract, "BAZI_PRIVATE_BASE_CONTRACT_INVALID",
      )),
      laneVersion: 1,
    },
  })).value);
  if (reserve.reservationIdentityHash !== identity || reserve.reservationFenceHash !== fenceHash) {
    fail("BAZI_REUSABLE_BASE_RESERVATION_DRIFT");
  }
  if (reserve.complete) {
    const completedGrant = candidateGrant ?? reserve.opaqueReadGrantHash;
    const recovered = await context.gpt.readContinuationExact({
      lookupKind: "frontier_ref", frontierRef: identity,
      authorization: completedGrant ? {
        kind: "current_artifact_read_grant",
        currentAuthorizationRef: task.business_identity.authorization_ref,
        opaqueReadGrantHash: completedGrant,
      } : { kind: "origin_authorization", originAuthorizationRef: task.business_identity.authorization_ref },
    });
    if (!recovered) fail("BAZI_REUSABLE_BASE_READBACK_MISSING");
    return baseFactsFromReadback(task, identity, baseInput, recovered, completedGrant);
  }
  const marker = `${localBaziPrivateBaseTurn.markerNamespace}:${identity.slice(7, 31)}`;
  const prompt = basePrompt(marker);
  const baseSubmit = {
    productStepId: "private-base", callId: "turn-submit", child: "submit_exact_gpt_turn_once",
    actionOrdinal: 13, input: { promptHash: sha256(prompt), turnMarker: marker },
    effectLookupKind: "task_exact_effect" as const,
  } as const;
  const currentSubmit = await flow.facts(baseSubmit);
  const priorSubmit = !currentSubmit.mutation && !currentSubmit.evidence
    ? await flow.taskExactFacts(baseSubmit) : null;
  if (!currentSubmit.mutation && !currentSubmit.evidence && !priorSubmit?.mutation && !priorSubmit?.evidence) {
    await flow.execute({
      productStepId: "private-base", callId: "fresh-chat", child: "prepare_clean_gpt_chat",
      actionOrdinal: 2, input: { timeoutMs: 60_000 },
    });
    await applyProfile(flow, "private-base", localBaziPrivateBaseTurn.profile, [3, 4, 5, 6, 7], false);
    await applyAttachments(flow, context, "private-base", ["bazi_private_base_input"], [8, 9, 10], false);
  }
  let checkpoint = await submitTurn(
    flow, "private-base", prompt, marker,
    uploadedFilesForRoles(context, ["bazi_private_base_input"]), [11, 12, 13, 14, 15, 16],
  );
  let admission: ReturnType<typeof validateBaseOutput>;
  try {
    admission = validateBaseOutput(checkpoint, baseInput);
  } catch (error) {
    const code = failureCode(error, "BAZI_PRIVATE_BASE_OUTPUT_INVALID");
    if (checkpoint.sourceAttemptId === context.gpt.attemptId || !code.startsWith("BAZI_PRIVATE_BASE_")) {
      throw error;
    }
    const retrySuffix = `semantic-retry-${context.gpt.attemptId}`;
    await flow.execute({
      productStepId: "private-base", callId: `fresh-chat:${retrySuffix}`,
      child: "prepare_clean_gpt_chat", actionOrdinal: 18, input: { timeoutMs: 60_000 },
    });
    await applyProfile(flow, "private-base", localBaziPrivateBaseTurn.profile, [19, 20, 21, 22, 23], false);
    await applyAttachments(flow, context, "private-base", ["bazi_private_base_input"], [24, 25, 26], false);
    checkpoint = await submitTurn(
      flow, "private-base", prompt, marker,
      uploadedFilesForRoles(context, ["bazi_private_base_input"]), [27, 28, 29, 30, 31, 32], retrySuffix,
    );
    admission = validateBaseOutput(checkpoint, baseInput);
  }
  const provider = providerFor(task, checkpoint);
  const completion = completionHashes({
    identity, continuationRef: reserve.continuationRef, laneVersion: reserve.laneVersion,
    fenceHash, provider,
    checkpoint,
    semanticReceiptRef: admission.receiptRef,
    semanticReceiptHash: admission.receiptHash,
    ownerRef: task.business_identity.owner_ref,
    subjectRef: task.business_identity.subject_ref,
  });
  await flow.execute({
    productStepId: "private-base", callId: "complete-reusable-origin",
    child: "complete_exact_gpt_continuation_reservation_once", actionOrdinal: 33,
    input: {
      reservationIdentityHash: identity,
      laneVersion: reserve.laneVersion,
      reservationFenceHash: fenceHash,
      provider,
      checkpoint: gptTextContinuationCheckpointInput(checkpoint.sourceAttemptId, checkpoint),
      artifactRef: checkpoint.artifactRef,
      artifactHash: checkpoint.semanticTextHash,
      semanticAdmissionReceiptRef: admission.receiptRef,
      semanticAdmissionReceiptHash: admission.receiptHash,
      semanticAdmissionReceipt: admission.receipt,
      opaqueReadGrantHash: completion.opaqueReadGrantHash,
      completionReceiptHash: completion.completionReceiptHash,
    },
  });
  return Object.freeze({
    continuationRef: reserve.continuationRef,
    provider,
    checkpoint,
    semanticAdmissionReceiptRef: admission.receiptRef,
    semanticAdmissionReceiptHash: admission.receiptHash,
    semanticAdmissionReceipt: admission.receipt,
    semanticContractHash: admission.receipt.contract_hash,
    opaqueReadGrantHash: completion.opaqueReadGrantHash,
  });
};

const laneValue = (value: unknown): GptContinuationLane => {
  const row = objectValue(value, "BAZI_DERIVED_LANE_INVALID");
  const provider = objectValue(row.provider, "BAZI_DERIVED_LANE_INVALID");
  return Object.freeze({
    continuation_ref: textValue(row.continuation_ref, "BAZI_DERIVED_LANE_INVALID"),
    lane_version: integerValue(row.lane_version, "BAZI_DERIVED_LANE_INVALID"),
    provider: Object.freeze({
      provider_page_url: textValue(provider.provider_page_url, "BAZI_DERIVED_LANE_INVALID"),
      prior_task_id: textValue(provider.prior_task_id, "BAZI_DERIVED_LANE_INVALID"),
      prior_prompt_hash: hashValue(provider.prior_prompt_hash, "BAZI_DERIVED_LANE_INVALID"),
      prior_raw_output_hash: hashValue(provider.prior_raw_output_hash, "BAZI_DERIVED_LANE_INVALID"),
      prior_turn_marker: textValue(provider.prior_turn_marker, "BAZI_DERIVED_LANE_INVALID"),
    }),
  });
};

export const reserveCompleteAndAcquireDerived = async (
  task: WebsiteAgentTask,
  flow: OwnedExecution,
  base: BaseFacts,
): Promise<GptContinuationLane> => {
  const sourceCheckpointHash = hashCanonical(checkpointRecord(base.checkpoint));
  const identity = hashCanonical({
    kind: "bazi-derived-formal-continuation.v1",
    job_id: task.job_id,
    source_artifact_ref: base.checkpoint.artifactRef,
    source_artifact_hash: base.checkpoint.semanticTextHash,
    source_checkpoint_hash: sourceCheckpointHash,
  });
  const fenceHash = hashCanonical({ kind: "bazi-derived-continuation-fence.v1", identity });
  const reservation = reservationValue((await flow.execute({
    productStepId: "formal", callId: "reserve-derived-continuation",
    child: "reserve_exact_gpt_continuation_once", actionOrdinal: 34,
    input: {
      reservationKind: "derived_continuation", reservationIdentityHash: identity,
      ownerRef: task.business_identity.owner_ref, subjectRef: task.business_identity.subject_ref,
      authorizationRef: task.business_identity.authorization_ref,
      sourceCheckpointHash, reservationFenceHash: fenceHash,
      reservationEffectHash: hashCanonical({ kind: "bazi-derived-continuation-effect.v1", identity }),
      originProvenanceHash: hashCanonical({
        kind: "bazi-derived-continuation-origin.v1", job_id: task.job_id,
        base_artifact_hash: base.checkpoint.semanticTextHash,
      }),
      semanticContractHash: base.semanticContractHash,
      laneVersion: 1,
    },
  })).value);
  const completion = completionHashes({
    identity, continuationRef: reservation.continuationRef,
    laneVersion: reservation.laneVersion, fenceHash, provider: base.provider,
    checkpoint: base.checkpoint,
    semanticReceiptRef: base.semanticAdmissionReceiptRef,
    semanticReceiptHash: base.semanticAdmissionReceiptHash,
    ownerRef: task.business_identity.owner_ref,
    subjectRef: task.business_identity.subject_ref,
  });
  await flow.execute({
    productStepId: "formal", callId: "complete-derived-continuation",
    child: "complete_exact_gpt_continuation_reservation_once", actionOrdinal: 35,
    input: {
      reservationIdentityHash: identity, laneVersion: reservation.laneVersion,
      reservationFenceHash: fenceHash, provider: base.provider,
      checkpoint: {
        checkpointKind: "text", sourceAttemptId: base.checkpoint.sourceAttemptId,
        assistantTurnId: base.checkpoint.assistantTurnId, artifactRef: base.checkpoint.artifactRef,
        rawDomHash: base.checkpoint.rawDomHash, semanticTextHash: base.checkpoint.semanticTextHash,
        canonicalConversationUrl: base.checkpoint.canonicalConversationUrl,
        promptHash: base.checkpoint.promptHash, turnMarker: base.checkpoint.turnMarker,
        evidenceRef: base.checkpoint.evidenceRef, evidenceHash: base.checkpoint.evidenceHash,
      },
      artifactRef: base.checkpoint.artifactRef, artifactHash: base.checkpoint.semanticTextHash,
      semanticAdmissionReceiptRef: base.semanticAdmissionReceiptRef,
      semanticAdmissionReceiptHash: base.semanticAdmissionReceiptHash,
      semanticAdmissionReceipt: base.semanticAdmissionReceipt,
      opaqueReadGrantHash: completion.opaqueReadGrantHash,
      completionReceiptHash: completion.completionReceiptHash,
    },
  });
  return laneValue((await flow.execute({
    productStepId: "formal", callId: "acquire-derived-continuation",
    child: "acquire_gpt_continuation_lane", actionOrdinal: 36,
    input: {
      continuationRef: reservation.continuationRef,
      ownerRef: task.business_identity.owner_ref,
      subjectRef: task.business_identity.subject_ref,
      authorization: {
        kind: "row_authorization",
        currentAuthorizationRef: task.business_identity.authorization_ref,
      },
    },
  })).value);
};


