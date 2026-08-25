import { z } from "zod";

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const isoSchema = z.string().datetime();

const ExecutionFenceV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-execution-fence.v6"),
  environment_id: z.string().min(1),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  job_id: z.string().min(1),
  attempt_id: z.string().min(1),
  lease_version: z.number().int().positive(),
  lease_token_hash: hashSchema,
  control_contract_manifest_hash: hashSchema,
  fence_hash: hashSchema,
}).strict();

export const CloudExecutionGrantV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-cloud-execution-grant.v6"),
  control_protocol_version: z.literal("xuanxue-ai-production-v6"),
  claim_batch_id: z.string().min(1),
  job_id: z.string().min(1),
  source_task_id: z.string().min(1),
  request_hash: hashSchema,
  job_contract_version: z.string().min(1),
  product_contract_hash: hashSchema,
  required_capabilities: z.array(z.string().min(1)),
  attempt_id: z.string().min(1),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
  server_now: isoSchema,
  accept_by: isoSchema,
  lease_expires_at: isoSchema,
  renew_after_ms: z.literal(20_000),
  control_contract_manifest_hash: hashSchema,
  execution_fence: ExecutionFenceV6Schema,
}).strict().superRefine((grant, context) => {
  const fence = grant.execution_fence;
  if (fence.job_id !== grant.job_id
    || fence.attempt_id !== grant.attempt_id
    || fence.lease_version !== grant.lease_version
    || fence.device_id !== grant.device_id
    || fence.device_epoch !== grant.device_epoch
    || fence.worker_session_id !== grant.worker_session_id
    || fence.worker_session_epoch !== grant.worker_session_epoch
    || fence.control_contract_manifest_hash !== grant.control_contract_manifest_hash
    || Date.parse(grant.server_now) >= Date.parse(grant.accept_by)
    || Date.parse(grant.accept_by) >= Date.parse(grant.lease_expires_at)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI_V6_GRANT_INVALID" });
  }
});
export type CloudExecutionGrantV6 = z.infer<typeof CloudExecutionGrantV6Schema>;

export const WorkerSessionCredentialV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-worker-session-credential.v6"),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  token: z.string().regex(/^aisc_v6_[A-Za-z0-9_-]{32,}$/u),
  token_generation: z.number().int().positive(),
  issued_at: isoSchema,
  expires_at: isoSchema,
  previous_generation_valid_until: isoSchema.nullable(),
}).strict().superRefine((credential, context) => {
  if (Date.parse(credential.issued_at) >= Date.parse(credential.expires_at)
    || Date.parse(credential.expires_at) - Date.parse(credential.issued_at) > 180_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI_SESSION_TOKEN_STALE" });
  }
});
export type WorkerSessionCredentialV6 = z.infer<typeof WorkerSessionCredentialV6Schema>;

export const RuntimeAttestationReceiptV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-runtime-attestation-receipt.v6"),
  receipt_id: z.string().min(1),
  receipt_hash: hashSchema,
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  attestation_seq: z.number().int().positive(),
  payload_hash: hashSchema,
  server_signature: hashSchema,
  issued_at: isoSchema,
  expires_at: isoSchema,
  claim_eligible: z.boolean(),
  reason_codes: z.array(z.string()),
}).strict().superRefine((receipt, context) => {
  if (Date.parse(receipt.issued_at) >= Date.parse(receipt.expires_at)
    || Date.parse(receipt.expires_at) - Date.parse(receipt.issued_at) > 45_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI_RUNTIME_ATTESTATION_STALE" });
  }
});
export type RuntimeAttestationReceiptV6 = z.infer<typeof RuntimeAttestationReceiptV6Schema>;

export const ClaimBatchReceiptV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-claim-batch-receipt.v6"),
  claim_batch_id: z.string().min(1),
  request_id: z.string().min(1),
  request_payload_hash: hashSchema,
  outcome: z.enum(["LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING"]),
  jobs: z.array(z.unknown()),
  server_now: isoSchema,
  next_claim_after_ms: z.number().int().min(1_000).max(30_000),
  queue_epoch: z.number().int().nonnegative(),
  reason_codes: z.array(z.string()),
}).strict().superRefine((receipt, context) => {
  if ((receipt.outcome === "LEASE_GRANTED") !== (receipt.jobs.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AI_CLAIM_IDEMPOTENCY_CONFLICT" });
  }
});
export type ClaimBatchReceiptV6 = z.infer<typeof ClaimBatchReceiptV6Schema>;

export const HandoverV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-handover.v6"),
  job_id: z.string().min(1),
  predecessor_fence_hash: hashSchema,
  successor_device_id: z.string().min(1),
  successor_worker_session_id: z.string().min(1),
  control_epoch: z.number().int().positive(),
}).strict();
export type HandoverV6 = z.infer<typeof HandoverV6Schema>;
