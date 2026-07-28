import { z } from "zod";

import {
  XuanxueAiProductIdSchema,
  XuanxueAiStageIdSchema,
} from "./xuanxue-ai-production.schema.js";

export const XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION =
  "xuanxue-ai-production-v1" as const;

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const XuanxueAiProductionCloudInputSchema = z.object({
  input_id: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  kind: z.string().min(1),
  summary: z.string().min(1),
  file_name: z.string().min(1).max(240),
  mime_type: z.string().min(1).max(160),
  sha256: hashSchema,
  byte_count: z.number().int().nonnegative(),
  object_ref: z.string().min(1),
}).strict();

const CloudStageMaterialSchema = z.object({
  stage_id: XuanxueAiStageIdSchema,
  prompt_package_id: z.string().min(1),
  prompt_contract_id: z.string().min(1),
  output_schema_ref: z.string().min(1).nullable(),
  text_prompt: z.string().min(1),
  timeout_ms: z.number().int().min(60_000).max(3_600_000),
  max_input_chars: z.number().int().positive(),
  max_file_count: z.number().int().min(0).max(64),
  max_file_bytes: z.number().int().positive(),
  inputs: z.array(XuanxueAiProductionCloudInputSchema),
}).strict();

export const XuanxueAiProductionCloudClaimedJobSchema = z.object({
  protocol_version: z.literal(
    XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  ),
  job_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  source_task_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  request_hash: hashSchema,
  continuation_parent: z.object({
    job_id: z.string().min(1),
    stage_id: XuanxueAiStageIdSchema,
    raw_output_hash: hashSchema,
  }).strict().nullable().default(null),
  seeded_stages: z.array(z.object({
    stage_id: XuanxueAiStageIdSchema,
    execution_id: z.string().min(1),
    raw_response_text: z.string(),
    raw_output_hash: hashSchema,
    provider_proof: z.record(z.string(), z.unknown()),
    transport_warnings: z.array(z.string()),
  }).strict()).max(4).default([]),
  execution_lane: z.literal("supervised_local_gpt_web"),
  materials: z.array(CloudStageMaterialSchema).min(1).max(4),
  status: z.literal("leased"),
  lease_owner: z.string().min(1),
  lease_expires_at: z.string().min(1),
  retry_not_before: z.string().nullable(),
  result_json: z.unknown().nullable(),
  failure_ledger: z.array(z.unknown()),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
}).strict();

export type XuanxueAiProductionCloudClaimedJob = z.infer<
  typeof XuanxueAiProductionCloudClaimedJobSchema
>;

export interface XuanxueAiProductionCloudCredential {
  readonly protocol_version:
    typeof XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION;
  readonly server_base_url: string;
  readonly device_id: string;
  readonly device_name: string;
  readonly credential: string;
  readonly max_in_flight: number;
  readonly enrolled_at: string;
}

export interface XuanxueAiProductionCloudWorkerHandle {
  close(): Promise<void>;
}
