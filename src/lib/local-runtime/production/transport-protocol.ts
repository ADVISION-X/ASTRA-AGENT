import { z } from "zod";
import { executionFailure } from "../../typed-failure.js";

import {
  WebsiteAgentTaskBaseSchema,
  WebsiteAgentTaskSchema,
  type WebsiteAgentTask,
} from "./contracts.js";
import { PRODUCTION_V6_MANIFEST_HASH } from "./v6-manifest-projection.js";

export { PRODUCTION_V6_MANIFEST_HASH } from "./v6-manifest-projection.js";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
  .transform((value): `sha256:${string}` => value as `sha256:${string}`);
const reasonCode = z.string().min(1).max(512);

export const DeviceCredentialSchema = z.object({
  protocol_version: z.literal("xuanxue-ai-production-v6"),
  server_base_url: z.string().url(),
  environment_id: z.literal("production"),
  origin: z.string().url(),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  credential: z.string().regex(/^aidc_v6_[A-Za-z0-9_-]{32,}$/u),
  enrolled_at: z.string().datetime(),
}).strict();

export type DeviceCredential = z.infer<typeof DeviceCredentialSchema>;

export const WorkerSessionCredentialSchema = z.object({
  schema_version: z.literal("xuanxue-ai-worker-session-credential.v6"),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  token: z.string().regex(/^aisc_v6_[A-Za-z0-9_-]{32,}$/u),
  token_generation: z.number().int().positive(),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  previous_generation_valid_until: z.string().datetime().nullable(),
}).strict();

export type WorkerSessionCredential = z.infer<typeof WorkerSessionCredentialSchema>;

export const RuntimeAttestationReceiptSchema = z.object({
  schema_version: z.literal("xuanxue-ai-runtime-attestation-receipt.v6"),
  receipt_id: z.string().min(1),
  receipt_hash: hash,
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  attestation_seq: z.number().int().positive(),
  payload_hash: hash,
  server_signature: hash,
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  claim_eligible: z.boolean(),
  reason_codes: z.array(reasonCode).max(32),
}).strict();

export type RuntimeAttestationReceipt = z.infer<typeof RuntimeAttestationReceiptSchema>;

const ExecutionFenceSchema = z.object({
  schema_version: z.literal("xuanxue-ai-execution-fence.v6"),
  environment_id: z.literal("production"),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  job_id: z.string().min(1),
  attempt_id: z.string().min(1),
  lease_version: z.number().int().positive(),
  lease_token_hash: hash,
  control_contract_manifest_hash: z.literal(PRODUCTION_V6_MANIFEST_HASH),
  fence_hash: hash,
}).strict();

const ExecutionGrantSchema = z.object({
  schema_version: z.literal("xuanxue-ai-cloud-execution-grant.v6"),
  control_protocol_version: z.literal("xuanxue-ai-production-v6"),
  claim_batch_id: z.string().min(1),
  job_id: z.string().min(1),
  source_task_id: z.string().min(1),
  request_hash: hash,
  task_contract_id: z.literal("website-agent-task"),
  task_contract_version: z.literal(1),
  result_contract_id: z.literal("website-agent-result"),
  result_contract_version: z.literal(1),
  capability_manifest_hash: hash,
  expected_catalog_hash: hash,
  expected_plugin_id: z.string().min(1),
  expected_plugin_version: z.number().int().positive(),
  accepted_attempt_count: z.number().int().min(0),
  max_provider_turns: z.number().int().positive(),
}).extend({
  attempt_id: z.string().min(1),
  device_id: z.string().min(1),
  device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1),
  worker_session_epoch: z.number().int().positive(),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
  server_now: z.string().datetime(),
  accept_by: z.string().datetime(),
  lease_expires_at: z.string().datetime(),
  renew_after_ms: z.literal(20_000),
  control_contract_manifest_hash: z.literal(PRODUCTION_V6_MANIFEST_HASH),
  execution_fence: ExecutionFenceSchema,
}).strict();

const projectWebsiteAgentTaskEnvelope = (value: object): Record<string, unknown> => {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(WebsiteAgentTaskBaseSchema.shape)
    .flatMap((key) => record[key] === undefined ? [] : [[key, record[key]]]));
};

export const ClaimedProductionTaskSchema = WebsiteAgentTaskBaseSchema.extend({
  status: z.literal("failed"),
  current_reason: z.literal("LEASE_GRANTED"),
  lease_owner: z.string().min(1),
  lease_expires_at: z.string().datetime(),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
  grant: ExecutionGrantSchema,
}).strict().superRefine((task, context) => {
  const base = projectWebsiteAgentTaskEnvelope(task);
  const validated = WebsiteAgentTaskSchema.safeParse(base);
  if (!validated.success) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_CLAIM_TASK_INVALID" });
  }
  const grant = task.grant;
  if (grant.job_id !== task.job_id || grant.source_task_id !== task.source_task_id
    || grant.request_hash !== task.request_hash || grant.device_id !== task.lease_owner
    || grant.lease_version !== task.lease_version || grant.lease_token !== task.lease_token
    || grant.lease_expires_at !== task.lease_expires_at
    || grant.execution_fence.job_id !== task.job_id
    || grant.execution_fence.attempt_id !== grant.attempt_id
    || grant.execution_fence.lease_version !== grant.lease_version
    || grant.expected_catalog_hash !== grant.capability_manifest_hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_CLAIM_TASK_GRANT_MISMATCH" });
  }
});

export type ClaimedProductionTask = z.infer<typeof ClaimedProductionTaskSchema>;

export const websiteAgentTaskFromClaim = (claim: ClaimedProductionTask): WebsiteAgentTask =>
  WebsiteAgentTaskSchema.parse(projectWebsiteAgentTaskEnvelope(claim));

export const ClaimBatchReceiptSchema = z.object({
  schema_version: z.literal("xuanxue-ai-claim-batch-receipt.v6"),
  claim_batch_id: z.string().min(1),
  request_id: z.string().min(1),
  request_payload_hash: hash,
  outcome: z.enum(["LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING"]),
  jobs: z.array(z.unknown()),
  server_now: z.string().datetime(),
  next_claim_after_ms: z.number().int().min(1_000).max(30_000),
  queue_epoch: z.number().int().nonnegative(),
  reason_codes: z.array(reasonCode).max(32),
}).strict();

export const LeaseRenewReceiptSchema = z.object({
  schema_version: z.literal("xuanxue-ai-lease-renew-receipt.v6"),
  job_id: z.string().min(1),
  server_now: z.string().datetime(),
  lease_expires_at: z.string().datetime(),
  renew_after_ms: z.literal(20_000),
  control_intent: z.object({
    schema_version: z.literal("xuanxue-ai-control-intent.v6"),
    job_id: z.string().min(1),
    intent: z.enum(["none", "pause_requested", "cancel_requested", "handover_requested"]),
    control_epoch: z.number().int().nonnegative(),
    reason_code: z.string().nullable(),
  }).strict().superRefine((controlIntent, context) => {
    if (controlIntent.control_epoch === 0 && controlIntent.intent !== "none") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AI_V6_CONTROL_INTENT_INITIAL_EPOCH_INVALID",
        path: ["control_epoch"],
      });
    }
  }),
}).strict();

export const UploadedResultReceiptSchema = z.object({
  schema_version: z.literal("xuanxue-ai-material-receipt.v6"),
  artifact_id: z.string().min(1),
  role: z.enum(["result_payload", "result_envelope", "generated_image"]),
  object_ref: z.string().min(1),
  sha256: hash,
  byte_length: z.number().int().positive(),
  media_type: z.enum(["application/json", "image/webp"]),
  state: z.literal("staged"),
  receipt_hash: hash,
}).passthrough();

export type UploadedResultReceipt = z.infer<typeof UploadedResultReceiptSchema>;

export const parseJsonEnvelope = (value: unknown, httpStatus?: number): unknown => {
  const envelope = z.object({
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.object({ code: z.string(), message: z.string() }).passthrough().optional(),
  }).passthrough().parse(value);
  if (!envelope.ok || envelope.data === undefined) {
    const code = envelope.error?.code ?? "PRODUCTION_CLOUD_API_UNKNOWN_FAILURE";
    throw executionFailure("failed", code, {
      ...(httpStatus === undefined ? {} : { httpStatus }),
      cause: new Error(envelope.error?.message ?? "Production cloud API rejected the request."),
    });
  }
  return envelope.data;
};
