import { createHash } from "node:crypto";

import { z } from "zod";

export const XUANXUE_DYNAMIC_PROOF_BINDING_FILE =
  "xuanxue-ai-production-dynamic-proof-binding.v2.json";
export const XUANXUE_DYNAMIC_PROOF_MAX_AGE_MS = 30 * 60 * 1_000;
const XUANXUE_DYNAMIC_PROOF_FUTURE_CLOCK_TOLERANCE_MS = 60 * 1_000;
const XuanxueDynamicProofHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
  .transform((value): `sha256:${string}` => value as `sha256:${string}`);
const XuanxueDynamicProofBindingSchema = z.object({
  schema_version: z.literal("xuanxue-ai-production-dynamic-proof-binding.v2"),
  run_id: z.string().trim().min(1),
  candidate_hash: XuanxueDynamicProofHashSchema,
  contract_manifest_hash: XuanxueDynamicProofHashSchema,
  runtime_receipt_hash: XuanxueDynamicProofHashSchema,
  cloud_terminal_job_ids: z.array(z.string().trim().min(1)).min(1)
    .refine((jobIds) => (
      new Set(jobIds).size === jobIds.length
      && jobIds.every((jobId, index) => index === 0 || jobIds[index - 1]! < jobId)
    )),
  provider_record_hashes: z.record(
    z.string().trim().min(1),
    XuanxueDynamicProofHashSchema,
  ).refine((hashes) => Object.keys(hashes).length > 0),
  captured_at: z.string().datetime(),
}).strict();

export type XuanxueDynamicProofBinding = z.infer<typeof XuanxueDynamicProofBindingSchema>;

export const parseXuanxueSourceCandidateHash = (
  value: string | undefined,
): `sha256:${string}` => {
  const parsed = XuanxueDynamicProofHashSchema.safeParse(value?.trim());
  if (!parsed.success) {
    throw new Error("GRASSEYE_SOURCE_FINGERPRINT must bind the current source candidate");
  }
  return parsed.data;
};

export const validateXuanxueDynamicProofBinding = (
  raw: unknown,
  expectedCandidateHash: `sha256:${string}`,
  expectedContractManifestHash: `sha256:${string}`,
  nowMs = Date.now(),
): XuanxueDynamicProofBinding => {
  const parsed = XuanxueDynamicProofBindingSchema.safeParse(raw);
  if (!parsed.success) throw new Error("dynamic proof binding shape is invalid");
  if (parsed.data.candidate_hash !== expectedCandidateHash) {
    throw new Error("dynamic proof belongs to a foreign source candidate");
  }
  if (parsed.data.contract_manifest_hash !== expectedContractManifestHash) {
    throw new Error("dynamic proof belongs to a foreign contract manifest");
  }
  const capturedAtMs = Date.parse(parsed.data.captured_at);
  if (capturedAtMs > nowMs + XUANXUE_DYNAMIC_PROOF_FUTURE_CLOCK_TOLERANCE_MS) {
    throw new Error("dynamic proof captured_at is in the future");
  }
  if (nowMs - capturedAtMs > XUANXUE_DYNAMIC_PROOF_MAX_AGE_MS) {
    throw new Error("dynamic proof is stale");
  }
  return parsed.data;
};

export const assertXuanxueProviderRecordHash = (
  binding: XuanxueDynamicProofBinding,
  executionId: string,
  rawRecord: string,
): void => {
  const expected = binding.provider_record_hashes[executionId];
  if (!expected) throw new Error("provider record is absent from the bound real run");
  const actual = `sha256:${createHash("sha256").update(rawRecord).digest("hex")}`;
  if (actual !== expected) {
    throw new Error("provider record hash does not match the bound real run");
  }
};

export const assertXuanxueDynamicTimestampFresh = (
  value: string,
  binding: XuanxueDynamicProofBinding,
  field: string,
): void => {
  const valueMs = Date.parse(value);
  const capturedAtMs = Date.parse(binding.captured_at);
  if (!Number.isFinite(valueMs)) throw new Error(`${field} is invalid`);
  if (valueMs > capturedAtMs + XUANXUE_DYNAMIC_PROOF_FUTURE_CLOCK_TOLERANCE_MS) {
    throw new Error(`${field} is after the bound run`);
  }
  if (capturedAtMs - valueMs > XUANXUE_DYNAMIC_PROOF_MAX_AGE_MS) {
    throw new Error(`${field} is stale for the bound run`);
  }
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
};

export const hashXuanxueDynamicReceipt = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
