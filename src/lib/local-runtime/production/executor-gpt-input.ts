import type { GptProductionExecutionInput } from "../../../capabilities/gpt/index.js";
import type { ProductionExecutionLease, WebsiteAgentTask } from "./contracts.js";

/** Maps the one Website lease to the GPT child contract without changing its authority. */
export const gptLeaseInput = (
  task: Readonly<Pick<WebsiteAgentTask, "job_id" | "product_id" | "business_identity">>,
  lease: ProductionExecutionLease, parentSpanId: string,
): Omit<GptProductionExecutionInput, "expiresAtMonotonic" | "commandTtlMs"> => ({
  jobId: task.job_id,
  productId: task.product_id,
  ownerRef: task.business_identity.owner_ref,
  subjectRef: task.business_identity.subject_ref,
  authorizationRef: task.business_identity.authorization_ref,
  resultRevision: lease.result_revision,
  ...(lease.readback_only_calls ? { readbackOnlyCalls: lease.readback_only_calls.map((call) => ({
    productStepId: call.product_step_id, callId: call.call_id,
    childCapabilityId: call.child_capability_id,
    ...(call.source ? { source: call.source } : {}),
  })) } : {}),
  ...(lease.source_reusable_calls ? { sourceReusableCalls: lease.source_reusable_calls.map((call) => ({
    productStepId: call.product_step_id, callId: call.call_id,
    childCapabilityId: call.child_capability_id,
    sourceEffectSetHash: call.source_effect_set_hash,
    sourceAttemptId: call.source_attempt_id,
    sourceResultRevision: call.source_result_revision,
    effectIdentityHash: call.effect_identity_hash,
    walAuthorityHash: call.wal_authority_hash,
    checkpointExactCallIdentityHash: call.checkpoint_exact_call_identity_hash,
    artifactRef: call.artifact_ref,
    artifactContentHash: call.artifact_content_hash,
    submitPromptHash: call.submit_prompt_hash,
    canonicalConversationHash: call.canonical_conversation_hash,
    userTurnHash: call.user_turn_hash,
  })) } : {}),
  domainRejectionRevision: lease.prior_result_rejection !== null,
  sourceReuseZeroSubmitGrant: lease.delivery_priority_replay_grant !== null
    && lease.delivery_priority_replay_grant.calls.length === 0
    && (lease.source_reusable_calls?.length ?? 0) > 0,
  deliveryPriorityReplayCalls: lease.delivery_priority_replay_grant?.calls.map((call) => ({
    productStepId: call.product_step_id, callId: call.call_id,
    childCapabilityId: call.child_capability_id,
    sourceEffectSetHash: call.source_effect_set_hash,
    callGrantHash: call.call_grant_hash,
  })) ?? [],
  attemptId: lease.attempt_id,
  deviceId: lease.device_id,
  leaseVersion: lease.lease_version,
  executionFenceHash: lease.execution_fence_hash,
  capabilityManifestHash: lease.capability_manifest_hash,
  maxProviderTurns: lease.max_provider_turns,
  abortSignal: lease.abort_signal,
  parentSpanId,
});
