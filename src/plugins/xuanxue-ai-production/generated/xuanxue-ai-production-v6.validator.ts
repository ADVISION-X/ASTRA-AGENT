import { z } from "zod";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const iso = z.string().datetime();

export const XuanxueAiProductionV6ManifestSchema = z.object({
  schema_version: z.literal("xuanxue-ai-production-contract-manifest.v6"),
  protocol_version: z.literal("xuanxue-ai-production-v6"),
  max_business_in_flight: z.literal(10),
  max_browser_in_flight: z.literal(1),
  session_credential_ttl_seconds: z.literal(180),
  session_credential_overlap_seconds: z.literal(60),
  runtime_attestation_ttl_seconds: z.literal(45),
  lease_seconds: z.literal(90),
  accept_seconds: z.literal(30),
  renew_after_ms: z.literal(20_000),
  required_structures: z.array(z.string()).length(19),
  claim_outcomes: z.tuple([
    z.literal("LEASE_GRANTED"), z.literal("NO_ELIGIBLE_JOB"),
    z.literal("CAPACITY_ZERO"), z.literal("CLAIM_BLOCKED"), z.literal("DRAINING"),
  ]),
  control_plane_status_fields: z.array(z.string()).length(11),
}).strict();

export const WorkerSessionCredentialV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-worker-session-credential.v6"),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  token: z.string().regex(/^aisc_v6_[A-Za-z0-9_-]{32,}$/u),
  token_generation: z.number().int().positive(),
  issued_at: iso,
  expires_at: iso,
  previous_generation_valid_until: iso.nullable(),
}).strict();

export const RuntimeAttestationReceiptV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-runtime-attestation-receipt.v6"),
  receipt_id: z.string().min(1), receipt_hash: hash,
  worker_session_id: z.string().min(1), worker_session_epoch: z.number().int().positive(),
  attestation_seq: z.number().int().positive(), payload_hash: hash, server_signature: hash,
  issued_at: iso, expires_at: iso, claim_eligible: z.boolean(),
  reason_codes: z.array(z.string()),
}).strict();

export const ExecutionFenceV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-execution-fence.v6"),
  environment_id: z.string().min(1), device_id: z.string().min(1), device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1), worker_session_epoch: z.number().int().positive(),
  job_id: z.string().min(1), attempt_id: z.string().min(1), lease_version: z.number().int().positive(),
  lease_token_hash: hash, control_contract_manifest_hash: hash, fence_hash: hash,
}).strict();

export const CloudExecutionGrantV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-cloud-execution-grant.v6"),
  control_protocol_version: z.literal("xuanxue-ai-production-v6"),
  claim_batch_id: z.string().min(1), job_id: z.string().min(1), source_task_id: z.string().min(1),
  request_hash: hash, job_contract_version: z.string().min(1), product_contract_hash: hash,
  required_capabilities: z.array(z.string().min(1)), attempt_id: z.string().min(1),
  device_id: z.string().min(1), device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1), worker_session_epoch: z.number().int().positive(),
  lease_token: z.string().regex(/^aipl_v6_[A-Za-z0-9_-]{32,}$/u), lease_version: z.number().int().positive(),
  server_now: iso, accept_by: iso, lease_expires_at: iso, renew_after_ms: z.literal(20_000),
  control_contract_manifest_hash: hash, execution_fence: ExecutionFenceV6Schema,
}).strict().superRefine((grant, context) => {
  const fence = grant.execution_fence;
  if (fence.job_id !== grant.job_id || fence.attempt_id !== grant.attempt_id
    || fence.device_id !== grant.device_id || fence.device_epoch !== grant.device_epoch
    || fence.worker_session_id !== grant.worker_session_id
    || fence.worker_session_epoch !== grant.worker_session_epoch
    || fence.lease_version !== grant.lease_version
    || fence.control_contract_manifest_hash !== grant.control_contract_manifest_hash
    || Date.parse(grant.server_now) >= Date.parse(grant.accept_by)
    || Date.parse(grant.accept_by) >= Date.parse(grant.lease_expires_at)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_V6_GRANT_BINDING_INVALID" });
  }
});

export const ClaimBatchReceiptV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-claim-batch-receipt.v6"),
  claim_batch_id: z.string().min(1), request_id: z.string().min(1), request_payload_hash: hash,
  outcome: z.enum(["LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING"]),
  jobs: z.array(z.unknown()), server_now: iso, next_claim_after_ms: z.number().int().min(1_000).max(30_000),
  queue_epoch: z.number().int().nonnegative(), reason_codes: z.array(z.string()),
}).strict().superRefine((receipt, context) => {
  if ((receipt.outcome === "LEASE_GRANTED") !== (receipt.jobs.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_V6_CLAIM_OUTCOME_INVALID" });
  }
});

export const HandoverV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-handover.v6"),
  job_id: z.string().min(1),
  predecessor_fence_hash: hash,
  successor_device_id: z.string().min(1),
  successor_worker_session_id: z.string().min(1),
  control_epoch: z.number().int().positive(),
}).strict();

export type WorkerSessionCredentialV6 = z.infer<typeof WorkerSessionCredentialV6Schema>;
export type RuntimeAttestationReceiptV6 = z.infer<typeof RuntimeAttestationReceiptV6Schema>;
export type CloudExecutionGrantV6 = z.infer<typeof CloudExecutionGrantV6Schema>;
export type ClaimBatchReceiptV6 = z.infer<typeof ClaimBatchReceiptV6Schema>;
export type HandoverV6 = z.infer<typeof HandoverV6Schema>;
