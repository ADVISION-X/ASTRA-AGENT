import type { BrowserMutationIdentity, BrowserMutationState } from "./browser-mutation-types.js";

export type MutationRow = Readonly<{
  command_id: string;
  logical_mutation_id: `sha256:${string}` | null;
  exact_call_identity_hash: `sha256:${string}`;
  job_id: string;
  result_revision: number;
  attempt_id: string;
  lease_version: number;
  execution_fence_hash: `sha256:${string}`;
  delivery_priority_replay_grant_hash: `sha256:${string}` | null;
  product_step_id: string;
  call_id: string;
  child_capability_id: string;
  effect_scope: "target_local" | "provider_effect";
  action_ordinal: number;
  target_ref: string;
  document_ref: string;
  action_id: string;
  positive_postcondition_hash: `sha256:${string}`;
  negative_postcondition_hash: `sha256:${string}`;
  request_hash: `sha256:${string}`;
  payload_hash: `sha256:${string}`;
  state: BrowserMutationState;
  mutation_outcome: "no" | "dispatched" | "confirmed" | null;
  terminal_at: string | null;
}>;

export const mutationIdentity = (row: MutationRow): BrowserMutationIdentity => ({
  commandId: row.command_id,
  logicalMutationId: row.logical_mutation_id,
  exactCallIdentityHash: row.exact_call_identity_hash,
  jobId: row.job_id,
  resultRevision: row.result_revision,
  attemptId: row.attempt_id,
  leaseVersion: row.lease_version,
  executionFenceHash: row.execution_fence_hash,
  deliveryPriorityReplayGrantHash: row.delivery_priority_replay_grant_hash,
  productStepId: row.product_step_id,
  callId: row.call_id,
  childCapabilityId: row.child_capability_id,
  effectScope: row.effect_scope,
  actionOrdinal: row.action_ordinal,
  targetRef: row.target_ref,
  documentRef: row.document_ref,
  actionId: row.action_id,
  positivePostconditionHash: row.positive_postcondition_hash,
  negativePostconditionHash: row.negative_postcondition_hash,
  requestHash: row.request_hash,
  payloadHash: row.payload_hash,
});
