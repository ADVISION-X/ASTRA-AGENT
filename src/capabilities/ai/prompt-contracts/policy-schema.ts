import { z } from "zod";

const PromptContractFailureDispositionSchema = z.enum(["failed", "review_required"]);
const PromptContractReviewTriggerSchema = z.enum([
  "low_confidence",
  "schema_mismatch",
  "bad_json",
  "prompt_contract_failure",
  "disabled_by_policy",
]);

const PromptContractConfidencePolicySchema = z.object({
  minConfidence: z.number().min(0).max(1),
  belowMin: PromptContractFailureDispositionSchema,
}).strict();

const PromptContractReviewPolicySchema = z.object({
  requiredWhen: z.array(PromptContractReviewTriggerSchema).default([]),
}).strict();

const PromptContractFailurePolicySchema = z.object({
  badJson: PromptContractFailureDispositionSchema,
  schemaMismatch: PromptContractFailureDispositionSchema,
  timeout: z.literal("failed"),
  modelUnavailable: z.literal("failed"),
}).strict();

const PromptContractDebugPolicySchema = z.object({
  rawOutputRetention: z.enum(["hash", "ref"]),
  includePromptHash: z.literal(true),
}).strict();

type PromptContractConfidencePolicy = z.output<typeof PromptContractConfidencePolicySchema>;
type PromptContractReviewPolicy = z.output<typeof PromptContractReviewPolicySchema>;
type PromptContractFailurePolicy = z.output<typeof PromptContractFailurePolicySchema>;
type PromptContractDebugPolicy = z.output<typeof PromptContractDebugPolicySchema>;

export {
  PromptContractConfidencePolicySchema,
  PromptContractReviewPolicySchema,
  PromptContractFailurePolicySchema,
  PromptContractDebugPolicySchema,
};

export type {
  PromptContractConfidencePolicy,
  PromptContractReviewPolicy,
  PromptContractFailurePolicy,
  PromptContractDebugPolicy,
};