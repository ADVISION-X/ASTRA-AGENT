import { z } from "zod";

export const XUANYUAN_CLOUD_PROTOCOL_VERSION = "ai-acceptance-protocol-v1" as const;

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const XuanyuanCloudInputSchema = z.object({
  input_id: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  kind: z.string().min(1),
  summary: z.string(),
  file_name: z.string().min(1).max(240),
  mime_type: z.string().min(1).max(160),
  sha256: hashSchema,
  byte_count: z.number().int().nonnegative(),
  object_ref: z.string().min(1),
}).strict();

const XuanyuanCloudJobIdentitySchema = z.object({
  protocol_version: z.literal(XUANYUAN_CLOUD_PROTOCOL_VERSION),
  job_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  source_task_id: z.string().min(1),
  parent_job_id: z.string().nullable(),
  challenge_id: z.string().nullable(),
  domain_id: z.string().min(1).max(80),
  stage: z.string().min(1).max(120),
  attempt: z.number().int().positive(),
  execution_lane: z.literal("local_gpt_web"),
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  prompt_contract_ref: z.string().min(1),
  output_schema_ref: z.string().min(1),
  payload_json: z.unknown(),
  request_hash: hashSchema,
});

const XuanyuanCloudJobExecutionSchema = z.object({
  status: z.literal("leased"),
  lease_owner: z.string().min(1),
  lease_expires_at: z.string().min(1),
  provider_execution_ref: z.string().nullable(),
  raw_response_ref: z.string().nullable(),
  raw_response_hash: hashSchema.nullable(),
  raw_response_byte_count: z.number().int().nonnegative().nullable(),
  provider_proof: z.unknown(),
  provider_response: z.unknown(),
  transport_warnings: z.array(z.string()),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  prompt_text: z.string().min(1),
  inputs: z.array(XuanyuanCloudInputSchema),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
  continuation: z.object({
    parent_job_id: z.string().min(1),
    provider_execution_ref: z.string().min(1),
    raw_response_hash: hashSchema,
  }).strict().nullable(),
});

export const XuanyuanCloudClaimedJobSchema = XuanyuanCloudJobIdentitySchema
  .merge(XuanyuanCloudJobExecutionSchema)
  .strict();

export type XuanyuanCloudClaimedJob = z.infer<typeof XuanyuanCloudClaimedJobSchema>;

export interface XuanyuanCloudCredential {
  readonly protocol_version: typeof XUANYUAN_CLOUD_PROTOCOL_VERSION;
  readonly server_base_url: string;
  readonly device_id: string;
  readonly device_name: string;
  readonly credential: string;
  readonly max_in_flight: number;
  readonly enrolled_at: string;
}

export interface XuanyuanCloudWorkerHandle {
  close(): Promise<void>;
}
