import { z } from "zod";

import type { XuanxueAiProductionCloudTerminalStatus } from "./xuanxue-ai-production-cloud-client-contract.js";

const hashSchema = z.custom<`sha256:${string}`>((value) =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value));
const UploadedOutputArtifactSchema = z.object({
  artifact_id: z.string().min(1),
  object_ref: z.string().min(1),
  sha256: hashSchema,
  mime_type: z.literal("image/webp"),
  byte_count: z.number().int().nonnegative(),
  width: z.literal(1200),
  height: z.literal(630),
  state: z.literal("staged"),
}).strict();
const CloudTerminalStatusSchema = z.object({
  schema_version: z.literal("xuanxue-ai-device-job-status.v6"),
  job_id: z.string().min(1),
  status: z.string().min(1),
  terminal_status: z.string().min(1).nullable(),
  terminal_payload_hash: hashSchema.nullable(),
  terminalized_at: z.string().datetime().nullable(),
  terminal_receipt: z.record(z.unknown()).nullable(),
}).strict();
const LeaseRenewResponseSchema = z.object({
  server_now: z.string().datetime(),
  lease_expires_at: z.string().datetime(),
  renew_after_ms: z.literal(20_000),
  control_intent: z.object({
    intent: z.enum(["none", "pause_requested", "cancel_requested", "handover_requested"]),
    control_epoch: z.number().int().nonnegative(),
    reason_code: z.string().min(1).nullable(),
  }).strict(),
}).strict();

export type UploadedOutputArtifact = z.infer<typeof UploadedOutputArtifactSchema>;
export type LeaseRenewResponse = z.infer<typeof LeaseRenewResponseSchema>;

export const parseUploadedOutputArtifact = (value: unknown): UploadedOutputArtifact =>
  UploadedOutputArtifactSchema.parse(value);
export const parseCloudTerminalStatus = (value: unknown): XuanxueAiProductionCloudTerminalStatus =>
  CloudTerminalStatusSchema.parse(value);
export const parseLeaseRenewResponse = (value: unknown): LeaseRenewResponse =>
  LeaseRenewResponseSchema.parse(value);
export const parseCloudResponseRecord = (value: unknown): Record<string, unknown> =>
  z.record(z.unknown()).parse(value);
export const parseUploadedHash = (value: unknown): `sha256:${string}` =>
  z.object({ sha256: hashSchema }).strict().parse(value).sha256;
