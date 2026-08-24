// GENERATED FILE. DO NOT EDIT.
// Provider: ADVISION-X/xuanxue-web@259d49a3dc3ad37d14b2604f5d298dbbdd7cebbc:packages/ai-contracts/src/production-control/v6-contract.ts
// Provider source SHA256: 3b8665f1f9eb8b0d8b8d751faf805077736cf608f27d666ac13fff9d22386d6a
import { createHash } from "node:crypto";

const canonicalForGeneratedHash = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalForGeneratedHash);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalForGeneratedHash(record[key])]));
  }
  return value;
};
const hashCanonicalJson = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalForGeneratedHash(value))).digest("hex")}`;
import {
  XUANXUE_PRODUCT_EXECUTION_CONTRACTS,
  XUANXUE_PRODUCT_EXECUTION_PROJECTION,
} from "../xuanxue-ai-production-product-contracts.js";

const productExecutionBundle = XUANXUE_PRODUCT_EXECUTION_PROJECTION.bundle;
const productExecutionContracts = XUANXUE_PRODUCT_EXECUTION_CONTRACTS;

export type V6Sha256 = `sha256:${string}`;
export type ClaimOutcomeV6 =
  | "LEASE_GRANTED"
  | "NO_ELIGIBLE_JOB"
  | "CAPACITY_ZERO"
  | "CLAIM_BLOCKED"
  | "DRAINING";

export type DeviceEnrollmentV6 = Readonly<{
  schema_version: "xuanxue-ai-device-enrollment.v6";
  request_id: string;
  environment_id: string;
  enrollment_token: string;
  control_manifest_hash: V6Sha256;
}>;

export type WorkerSessionOpenV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-session-open.v6";
  request_id: string;
  environment_id: string;
  origin: string;
  device_id: string;
  device_epoch: number;
  worker_instance_id: string;
  agent_build_hash: V6Sha256;
  control_manifest_hash: V6Sha256;
}>;

export type WorkerSessionCredentialV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-session-credential.v6";
  worker_session_id: string;
  worker_session_epoch: number;
  token: string;
  token_generation: number;
  issued_at: string;
  expires_at: string;
  previous_generation_valid_until: string | null;
}>;

export type WorkerRuntimeAttestationV6 = Readonly<{
  schema_version: "xuanxue-ai-worker-runtime-attestation.v6";
  request_id: string;
  attestation_seq: number;
  worker_session_id: string;
  worker_session_epoch: number;
  control_manifest_hash: V6Sha256;
  product_bundle_hash: V6Sha256;
  business_capacity_total: 10;
  business_in_flight: number;
  browser_action_capacity_total: 1;
  browser_action_in_flight: 0 | 1;
  browser_authority_state: "present" | "absent";
  browser_target_state: "claimed" | "absent";
  browser_lane_state: "idle" | "busy" | "blocked";
  drain_state: "open" | "draining";
  ledger_reconciled: boolean;
}>;

export type RuntimeAttestationReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-runtime-attestation-receipt.v6";
  receipt_id: string;
  receipt_hash: V6Sha256;
  worker_session_id: string;
  worker_session_epoch: number;
  attestation_seq: number;
  payload_hash: V6Sha256;
  server_signature: V6Sha256;
  issued_at: string;
  expires_at: string;
  claim_eligible: boolean;
  reason_codes: readonly string[];
}>;

export type ClaimRequestV6 = Readonly<{
  schema_version: "xuanxue-ai-claim-request.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  requested_limit: number;
  runtime_attestation_receipt_hash: V6Sha256;
}>;

export type ExecutionFenceV6 = Readonly<{
  schema_version: "xuanxue-ai-execution-fence.v6";
  environment_id: string;
  device_id: string;
  device_epoch: number;
  worker_session_id: string;
  worker_session_epoch: number;
  job_id: string;
  attempt_id: string;
  lease_version: number;
  lease_token_hash: V6Sha256;
  control_contract_manifest_hash: V6Sha256;
  fence_hash: V6Sha256;
}>;

export type LeaseTimingV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-timing.v6";
  server_now: string;
  accept_by: string;
  lease_expires_at: string;
  renew_after_ms: 20_000;
  safety_margin_ms: 10_000;
}>;

export type CloudExecutionGrantV6 = Readonly<{
  schema_version: "xuanxue-ai-cloud-execution-grant.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  claim_batch_id: string;
  job_id: string;
  source_task_id: string;
  request_hash: V6Sha256;
  job_contract_version: string;
  product_contract_hash: V6Sha256;
  required_capabilities: readonly string[];
  attempt_id: string;
  device_id: string;
  device_epoch: number;
  worker_session_id: string;
  worker_session_epoch: number;
  lease_token: string;
  lease_version: number;
  server_now: string;
  accept_by: string;
  lease_expires_at: string;
  renew_after_ms: 20_000;
  control_contract_manifest_hash: V6Sha256;
  execution_fence: ExecutionFenceV6;
}>;

export type ClaimBatchReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-claim-batch-receipt.v6";
  claim_batch_id: string;
  request_id: string;
  request_payload_hash: V6Sha256;
  outcome: ClaimOutcomeV6;
  jobs: readonly unknown[];
  server_now: string;
  next_claim_after_ms: number;
  queue_epoch: number;
  reason_codes: readonly string[];
}>;

export type ClaimResponseV6 = ClaimBatchReceiptV6;

export type LeaseReleaseV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-release.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  payload_hash: V6Sha256;
  reason_code:
    | "CAPABILITY_CHANGED_BEFORE_ACCEPT"
    | "DEADLINE_BUDGET_EXHAUSTED"
    | "LOCAL_CAPACITY_CHANGED";
}>;

export type LeaseRenewV6 = Readonly<{
  schema_version: "xuanxue-ai-lease-renew.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  checkpoint_hash: V6Sha256 | null;
}>;

export type CheckpointV6 = Readonly<{
  schema_version: "xuanxue-ai-checkpoint.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  local_order_id: string | null;
  status: "inputs_downloading" | "factory_running" | "recovery_pending";
  checkpoint_seq: number;
  checkpoint_kind: string;
  payload_hash: V6Sha256;
  object_receipts: readonly V6Sha256[];
}>;

export type ControlIntentV6 = Readonly<{
  schema_version: "xuanxue-ai-control-intent.v6";
  job_id: string;
  control_epoch: number;
  intent: "none" | "pause_requested" | "cancel_requested" | "handover_requested";
  reason_code: string | null;
}>;

export type TerminalCasV6 = Readonly<{
  schema_version: "xuanxue-ai-terminal-cas.v6";
  control_protocol_version: "xuanxue-ai-production-v6";
  request_id: string;
  idempotency_key: string;
  job_id: string;
  worker_session_id: string;
  worker_session_epoch: number;
  attempt_id: string;
  lease_version: number;
  fence_hash: V6Sha256;
  terminal_status: "completed" | "failed" | "review_required" | "cancelled";
  payload_hash: V6Sha256;
  result_object_receipts: readonly V6Sha256[];
}>;

export type HandoverV6 = Readonly<{
  schema_version: "xuanxue-ai-handover.v6";
  job_id: string;
  predecessor_fence_hash: V6Sha256;
  successor_device_id: string;
  successor_worker_session_id: string;
  control_epoch: number;
}>;

export type MaterialReceiptV6 = Readonly<{
  schema_version: "xuanxue-ai-material-receipt.v6";
  object_ref: string;
  sha256: V6Sha256;
  byte_length: number;
  media_type: string;
  lease_scope_hash: V6Sha256;
}>;

export type ErrorEnvelopeV6 = Readonly<{
  schema_version: "xuanxue-ai-error-envelope.v6";
  code: string;
  owner: "website" | "agent" | "browser";
  retryable: boolean;
  request_id: string | null;
  details: Readonly<Record<string, string | number | boolean | null>>;
}>;

export const xuanxueAiProductionV6ContractManifest = Object.freeze({
  schema_version: "xuanxue-ai-production-contract-manifest.v6",
  protocol_version: "xuanxue-ai-production-v6",
  max_business_in_flight: 10,
  max_browser_in_flight: 1,
  session_credential_ttl_seconds: 180,
  session_credential_overlap_seconds: 60,
  runtime_attestation_ttl_seconds: 45,
  agent_build_binding_scope: "worker_session",
  product_capability_identity: "product_bundle_hash",
  lease_seconds: 90,
  accept_seconds: 30,
  renew_after_ms: 20_000,
  required_structures: [
    "DeviceEnrollmentV6", "WorkerSessionOpenV6", "WorkerSessionCredentialV6",
    "WorkerRuntimeAttestationV6", "RuntimeAttestationReceiptV6", "ClaimRequestV6",
    "ClaimResponseV6", "ClaimBatchReceiptV6", "CloudExecutionGrantV6", "ExecutionFenceV6",
    "LeaseTimingV6", "LeaseReleaseV6", "LeaseRenewV6", "CheckpointV6", "ControlIntentV6",
    "TerminalCasV6", "HandoverV6", "MaterialReceiptV6", "ErrorEnvelopeV6",
  ],
  claim_outcomes: [
    "LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING",
  ],
  control_plane_status_fields: [
    "website_core_state", "website_domain_workers_state", "ai_control_plane_state",
    "agent_link_state", "agent_contract_state", "worker_session_state",
    "browser_authority_state", "browser_target_state", "browser_lane_state",
    "claim_admission_state", "e2e_proof_state",
  ],
});

export const XUANXUE_AI_PRODUCTION_V6_MANIFEST_HASH = hashCanonicalJson(
  xuanxueAiProductionV6ContractManifest,
);

const HASH = /^sha256:[a-f0-9]{64}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isIso = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));
const exact = (value: Record<string, unknown>, keys: readonly string[], code: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(code);
  }
};

export function assertDeviceEnrollmentV6(value: unknown): asserts value is DeviceEnrollmentV6 {
  if (!isRecord(value)) throw new Error("AI_V6_DEVICE_ENROLLMENT_INVALID");
  exact(value, ["schema_version", "request_id", "environment_id", "enrollment_token", "control_manifest_hash"], "AI_V6_DEVICE_ENROLLMENT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-device-enrollment.v6"
    || typeof value.request_id !== "string" || !value.request_id
    || !["production", "isolated-test"].includes(value.environment_id as string)
    || typeof value.enrollment_token !== "string" || value.enrollment_token.length < 16
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)) {
    throw new Error("AI_V6_DEVICE_ENROLLMENT_INVALID");
  }
}

export function assertWorkerSessionOpenV6(value: unknown): asserts value is WorkerSessionOpenV6 {
  if (!isRecord(value)) throw new Error("AI_V6_SESSION_OPEN_INVALID");
  exact(value, ["schema_version", "request_id", "environment_id", "origin", "device_id", "device_epoch", "worker_instance_id", "agent_build_hash", "control_manifest_hash"], "AI_V6_SESSION_OPEN_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-session-open.v6"
    || ![value.request_id, value.environment_id, value.origin, value.device_id, value.worker_instance_id].every((item) => typeof item === "string" && item.length > 0)
    || !Number.isInteger(value.device_epoch) || (value.device_epoch as number) < 1
    || typeof value.agent_build_hash !== "string" || !HASH.test(value.agent_build_hash)
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)) {
    throw new Error("AI_V6_SESSION_OPEN_INVALID");
  }
}

export function assertWorkerSessionCredentialV6(value: unknown): asserts value is WorkerSessionCredentialV6 {
  if (!isRecord(value)) throw new Error("AI_SESSION_TOKEN_STALE");
  exact(value, ["schema_version", "worker_session_id", "worker_session_epoch", "token", "token_generation", "issued_at", "expires_at", "previous_generation_valid_until"], "AI_V6_SESSION_CREDENTIAL_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-session-credential.v6"
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || typeof value.token !== "string" || !/^aisc_v6_[A-Za-z0-9_-]{32,}$/u.test(value.token)
    || !Number.isInteger(value.token_generation) || (value.token_generation as number) < 1
    || !isIso(value.issued_at) || !isIso(value.expires_at)
    || (value.previous_generation_valid_until !== null && !isIso(value.previous_generation_valid_until))
    || Date.parse(value.issued_at as string) >= Date.parse(value.expires_at as string)
    || Date.parse(value.expires_at as string) - Date.parse(value.issued_at as string) > 180_000) {
    throw new Error("AI_SESSION_TOKEN_STALE");
  }
}

export function assertRuntimeAttestationReceiptV6(value: unknown): asserts value is RuntimeAttestationReceiptV6 {
  if (!isRecord(value)) throw new Error("AI_RUNTIME_ATTESTATION_STALE");
  exact(value, ["schema_version", "receipt_id", "receipt_hash", "worker_session_id", "worker_session_epoch", "attestation_seq", "payload_hash", "server_signature", "issued_at", "expires_at", "claim_eligible", "reason_codes"], "AI_V6_ATTESTATION_RECEIPT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-runtime-attestation-receipt.v6"
    || typeof value.receipt_id !== "string" || !value.receipt_id
    || typeof value.receipt_hash !== "string" || !HASH.test(value.receipt_hash)
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.attestation_seq) || (value.attestation_seq as number) < 1
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || typeof value.server_signature !== "string" || !HASH.test(value.server_signature)
    || !isIso(value.issued_at) || !isIso(value.expires_at)
    || Date.parse(value.issued_at as string) >= Date.parse(value.expires_at as string)
    || Date.parse(value.expires_at as string) - Date.parse(value.issued_at as string) > 45_000
    || typeof value.claim_eligible !== "boolean"
    || !Array.isArray(value.reason_codes)
    || !value.reason_codes.every((item) => typeof item === "string")) {
    throw new Error("AI_RUNTIME_ATTESTATION_STALE");
  }
}

export function assertClaimRequestV6(value: unknown): asserts value is ClaimRequestV6 {
  if (!isRecord(value)) throw new Error("AI_V6_CLAIM_REQUEST_INVALID");
  exact(value, ["schema_version", "control_protocol_version", "request_id", "worker_session_id", "worker_session_epoch", "requested_limit", "runtime_attestation_receipt_hash"], "AI_V6_CLAIM_REQUEST_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-claim-request.v6"
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.requested_limit) || (value.requested_limit as number) < 1 || (value.requested_limit as number) > 10
    || typeof value.runtime_attestation_receipt_hash !== "string" || !HASH.test(value.runtime_attestation_receipt_hash)) {
    throw new Error("AI_V6_CLAIM_REQUEST_INVALID");
  }
}

export function assertWorkerRuntimeAttestationV6(
  value: unknown,
): asserts value is WorkerRuntimeAttestationV6 {
  if (!isRecord(value)) throw new Error("AI_V6_RUNTIME_ATTESTATION_INVALID");
  exact(value, ["schema_version", "request_id", "attestation_seq", "worker_session_id", "worker_session_epoch", "control_manifest_hash", "product_bundle_hash", "business_capacity_total", "business_in_flight", "browser_action_capacity_total", "browser_action_in_flight", "browser_authority_state", "browser_target_state", "browser_lane_state", "drain_state", "ledger_reconciled"], "AI_V6_RUNTIME_ATTESTATION_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-worker-runtime-attestation.v6"
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.attestation_seq) || (value.attestation_seq as number) < 1
    || typeof value.control_manifest_hash !== "string" || !HASH.test(value.control_manifest_hash)
    || typeof value.product_bundle_hash !== "string" || !HASH.test(value.product_bundle_hash)
    || value.business_capacity_total !== 10
    || !Number.isInteger(value.business_in_flight) || (value.business_in_flight as number) < 0 || (value.business_in_flight as number) > 10
    || value.browser_action_capacity_total !== 1
    || ![0, 1].includes(value.browser_action_in_flight as number)
    || !["present", "absent"].includes(value.browser_authority_state as string)
    || !["claimed", "absent"].includes(value.browser_target_state as string)
    || !["idle", "busy", "blocked"].includes(value.browser_lane_state as string)
    || !["open", "draining"].includes(value.drain_state as string)
    || typeof value.ledger_reconciled !== "boolean") {
    throw new Error("AI_V6_RUNTIME_ATTESTATION_INVALID");
  }
  if (value.product_bundle_hash !== productExecutionBundle.bundle_hash) {
    throw new Error("AI_V6_PRODUCT_CONTRACT_DENOMINATOR_MISMATCH");
  }
}

export function assertCloudExecutionGrantV6(value: unknown): asserts value is CloudExecutionGrantV6 {
  if (!isRecord(value)) throw new Error("AI_V6_GRANT_INVALID");
  exact(value, ["schema_version", "control_protocol_version", "claim_batch_id", "job_id", "source_task_id", "request_hash", "job_contract_version", "product_contract_hash", "required_capabilities", "attempt_id", "device_id", "device_epoch", "worker_session_id", "worker_session_epoch", "lease_token", "lease_version", "server_now", "accept_by", "lease_expires_at", "renew_after_ms", "control_contract_manifest_hash", "execution_fence"], "AI_V6_GRANT_UNKNOWN_FIELD");
  if (!isRecord(value.execution_fence)) throw new Error("AI_V6_GRANT_INVALID");
  const fence = value.execution_fence;
  exact(fence, ["schema_version", "environment_id", "device_id", "device_epoch", "worker_session_id", "worker_session_epoch", "job_id", "attempt_id", "lease_version", "lease_token_hash", "control_contract_manifest_hash", "fence_hash"], "AI_V6_FENCE_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-cloud-execution-grant.v6"
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || ![value.claim_batch_id, value.job_id, value.source_task_id, value.job_contract_version, value.attempt_id, value.device_id, value.worker_session_id, value.lease_token].every((item) => typeof item === "string" && item.length > 0)
    || typeof value.request_hash !== "string" || !HASH.test(value.request_hash)
    || typeof value.product_contract_hash !== "string" || !HASH.test(value.product_contract_hash)
    || !Array.isArray(value.required_capabilities)
    || !Number.isInteger(value.device_epoch) || (value.device_epoch as number) < 1
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || !Number.isInteger(value.lease_version) || (value.lease_version as number) < 1
    || fence.schema_version !== "xuanxue-ai-execution-fence.v6"
    || fence.job_id !== value.job_id || fence.attempt_id !== value.attempt_id || fence.lease_version !== value.lease_version
    || fence.device_id !== value.device_id || fence.device_epoch !== value.device_epoch
    || fence.worker_session_id !== value.worker_session_id || fence.worker_session_epoch !== value.worker_session_epoch
    || typeof fence.lease_token_hash !== "string" || !HASH.test(fence.lease_token_hash)
    || fence.control_contract_manifest_hash !== value.control_contract_manifest_hash
    || typeof fence.fence_hash !== "string" || !HASH.test(fence.fence_hash)
    || typeof value.control_contract_manifest_hash !== "string" || !HASH.test(value.control_contract_manifest_hash)
    || !isIso(value.server_now) || !isIso(value.accept_by) || !isIso(value.lease_expires_at)
    || value.renew_after_ms !== 20_000
    || Date.parse(value.server_now) >= Date.parse(value.accept_by)
    || Date.parse(value.accept_by) >= Date.parse(value.lease_expires_at)) {
    throw new Error("AI_V6_GRANT_INVALID");
  }
  const productContract = productExecutionContracts.find(
    (contract) => contract.product_contract_hash === value.product_contract_hash,
  );
  if (!productContract
    || JSON.stringify(value.required_capabilities) !== JSON.stringify(productContract.required_capabilities)) {
    throw new Error("AI_V6_GRANT_PRODUCT_CONTRACT_MISMATCH");
  }
}

export function assertClaimBatchReceiptV6(value: unknown): asserts value is ClaimBatchReceiptV6 {
  if (!isRecord(value)) throw new Error("AI_CLAIM_IDEMPOTENCY_CONFLICT");
  exact(value, ["schema_version", "claim_batch_id", "request_id", "request_payload_hash", "outcome", "jobs", "server_now", "next_claim_after_ms", "queue_epoch", "reason_codes"], "AI_V6_CLAIM_RECEIPT_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-claim-batch-receipt.v6"
    || typeof value.claim_batch_id !== "string" || !value.claim_batch_id
    || typeof value.request_id !== "string" || !value.request_id
    || typeof value.request_payload_hash !== "string" || !HASH.test(value.request_payload_hash)
    || !xuanxueAiProductionV6ContractManifest.claim_outcomes.includes(value.outcome as ClaimOutcomeV6)
    || !Array.isArray(value.jobs)
    || !isIso(value.server_now)
    || !Number.isInteger(value.next_claim_after_ms) || (value.next_claim_after_ms as number) < 1_000 || (value.next_claim_after_ms as number) > 30_000
    || !Number.isInteger(value.queue_epoch) || (value.queue_epoch as number) < 0
    || !Array.isArray(value.reason_codes) || !value.reason_codes.every((item) => typeof item === "string")
    || ((value.outcome === "LEASE_GRANTED") !== (value.jobs.length > 0))) {
    throw new Error("AI_CLAIM_IDEMPOTENCY_CONFLICT");
  }
  for (const job of value.jobs) assertCloudExecutionGrantV6(job);
}

export function assertHandoverV6(value: unknown): asserts value is HandoverV6 {
  if (!isRecord(value)) throw new Error("AI_HANDOVER_FENCE_STALE");
  exact(value, ["schema_version", "job_id", "predecessor_fence_hash", "successor_device_id", "successor_worker_session_id", "control_epoch"], "AI_V6_HANDOVER_UNKNOWN_FIELD");
  if (value.schema_version !== "xuanxue-ai-handover.v6"
    || typeof value.job_id !== "string" || !value.job_id
    || typeof value.predecessor_fence_hash !== "string" || !HASH.test(value.predecessor_fence_hash)
    || typeof value.successor_device_id !== "string" || !value.successor_device_id
    || typeof value.successor_worker_session_id !== "string" || !value.successor_worker_session_id
    || !Number.isInteger(value.control_epoch) || (value.control_epoch as number) < 1) {
    throw new Error("AI_HANDOVER_FENCE_STALE");
  }
}

export function assertXuanxueAiProductionV6Manifest(value: unknown): asserts value is typeof xuanxueAiProductionV6ContractManifest {
  if (!isRecord(value)) throw new Error("CONTRACT_CONTROL_MANIFEST_MISMATCH");
  exact(value, Object.keys(xuanxueAiProductionV6ContractManifest), "AI_V6_MANIFEST_UNKNOWN_FIELD");
  if (hashCanonicalJson(value) !== XUANXUE_AI_PRODUCTION_V6_MANIFEST_HASH) {
    throw new Error("CONTRACT_CONTROL_MANIFEST_MISMATCH");
  }
}

const assertJobFenceRequest = (
  value: Record<string, unknown>,
  schema: string,
  keys: readonly string[],
  code: string,
): void => {
  exact(value, keys, `${code}_UNKNOWN_FIELD`);
  if (value.schema_version !== schema
    || value.control_protocol_version !== "xuanxue-ai-production-v6"
    || typeof value.request_id !== "string" || !value.request_id
    || value.idempotency_key !== value.request_id
    || typeof value.job_id !== "string" || !value.job_id
    || typeof value.worker_session_id !== "string" || !value.worker_session_id
    || !Number.isInteger(value.worker_session_epoch) || (value.worker_session_epoch as number) < 1
    || typeof value.attempt_id !== "string" || !value.attempt_id
    || !Number.isInteger(value.lease_version) || (value.lease_version as number) < 1
    || typeof value.fence_hash !== "string" || !HASH.test(value.fence_hash)) {
    throw new Error(code);
  }
};

export function assertLeaseReleaseV6(value: unknown): asserts value is LeaseReleaseV6 {
  if (!isRecord(value)) throw new Error("AI_V6_LEASE_RELEASE_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-lease-release.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","payload_hash","reason_code"], "AI_V6_LEASE_RELEASE_INVALID");
  if (typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !["CAPABILITY_CHANGED_BEFORE_ACCEPT", "DEADLINE_BUDGET_EXHAUSTED", "LOCAL_CAPACITY_CHANGED"].includes(value.reason_code as string)) {
    throw new Error("AI_V6_LEASE_RELEASE_INVALID");
  }
}

export function assertLeaseRenewV6(value: unknown): asserts value is LeaseRenewV6 {
  if (!isRecord(value)) throw new Error("AI_V6_LEASE_RENEW_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-lease-renew.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","checkpoint_hash"], "AI_V6_LEASE_RENEW_INVALID");
  if (value.checkpoint_hash !== null
    && (typeof value.checkpoint_hash !== "string" || !HASH.test(value.checkpoint_hash))) {
    throw new Error("AI_V6_LEASE_RENEW_INVALID");
  }
}

export function assertCheckpointV6(value: unknown): asserts value is CheckpointV6 {
  if (!isRecord(value)) throw new Error("AI_V6_CHECKPOINT_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-checkpoint.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","local_order_id","status","checkpoint_seq","checkpoint_kind","payload_hash","object_receipts"], "AI_V6_CHECKPOINT_INVALID");
  if (!Number.isInteger(value.checkpoint_seq) || (value.checkpoint_seq as number) < 1
    || typeof value.checkpoint_kind !== "string" || !value.checkpoint_kind
    || (value.local_order_id !== null && (typeof value.local_order_id !== "string" || !value.local_order_id))
    || !["inputs_downloading","factory_running","recovery_pending"].includes(value.status as string)
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !Array.isArray(value.object_receipts)
    || !value.object_receipts.every((item) => typeof item === "string" && HASH.test(item))) {
    throw new Error("AI_V6_CHECKPOINT_INVALID");
  }
}

export function assertTerminalCasV6(value: unknown): asserts value is TerminalCasV6 {
  if (!isRecord(value)) throw new Error("AI_V6_TERMINAL_INVALID");
  assertJobFenceRequest(value, "xuanxue-ai-terminal-cas.v6", ["schema_version","control_protocol_version","request_id","idempotency_key","job_id","worker_session_id","worker_session_epoch","attempt_id","lease_version","fence_hash","terminal_status","payload_hash","result_object_receipts"], "AI_V6_TERMINAL_INVALID");
  if (!["completed", "failed", "review_required", "cancelled"].includes(value.terminal_status as string)
    || typeof value.payload_hash !== "string" || !HASH.test(value.payload_hash)
    || !Array.isArray(value.result_object_receipts)
    || !value.result_object_receipts.every((item) => typeof item === "string" && HASH.test(item))) {
    throw new Error("AI_V6_TERMINAL_INVALID");
  }
}

type GeneratedParser<T> = Readonly<{ parse(value: unknown): T }>;
const generatedParser = <T>(assertValue: (value: unknown) => asserts value is T): GeneratedParser<T> => ({
  parse(value: unknown): T {
    assertValue(value);
    return value;
  },
});

export const XuanxueAiProductionV6ManifestSchema = generatedParser(assertXuanxueAiProductionV6Manifest);
export const WorkerSessionCredentialV6Schema = generatedParser(assertWorkerSessionCredentialV6);
export const RuntimeAttestationReceiptV6Schema = generatedParser(assertRuntimeAttestationReceiptV6);
export const CloudExecutionGrantV6Schema = generatedParser(assertCloudExecutionGrantV6);
export const ClaimBatchReceiptV6Schema = generatedParser(assertClaimBatchReceiptV6);
export const HandoverV6Schema = generatedParser(assertHandoverV6);
