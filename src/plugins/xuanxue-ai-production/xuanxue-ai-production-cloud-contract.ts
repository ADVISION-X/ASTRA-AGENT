import { z } from "zod";
import { createHash } from "node:crypto";

import {
  XuanxueAiProductIdSchema,
  XuanxueAiStageIdSchema,
} from "./xuanxue-ai-production.schema.js";

export const XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION =
  "xuanxue-ai-production-v4" as const;

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

const canonicalJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
};

const canonicalHash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(canonicalJsonValue(value))).digest("hex")}`;

const CloudFrozenSubjectSchema = z.object({
  privacy_owner_ref: z.string().min(1),
  snapshot_ref: z.string().min(1),
  snapshot_hash: hashSchema,
  case_revision_ref: z.string().min(1),
  primary_person_ref: z.string().min(1).nullable(),
  participant_manifest_hash: hashSchema,
  participants: z.array(z.object({
    slot_ref: z.string().min(1),
    role_code: z.string().min(1),
    person_ref: z.string().min(1),
    profile_version_ref: z.string().min(1),
    chart_state_ref: z.string().min(1),
    chart_state_version: z.string().min(1),
    chart_state_hash: hashSchema,
    purpose_code: z.string().min(1),
    authorization_receipt_ref: z.string().min(1),
  }).strict()).min(1).max(32),
}).strict();

const CloudConversationParentSchema = z.object({
  relation: z.enum(["same_conversation", "forked_from_checkpoint"]),
  job_id: z.string().min(1),
  stage_id: XuanxueAiStageIdSchema,
  execution_id: z.string().min(1),
  raw_output_hash: hashSchema,
  input_bundle_hash: hashSchema,
  conversation_scope_ref: z.string().min(1),
}).strict();

const CloudJoinParentSchema = z.object({
  participant_slot_ref: z.string().min(1),
  participant_role_code: z.string().min(1),
  person_ref: z.string().min(1),
  job_id: z.string().min(1),
  stage_id: XuanxueAiStageIdSchema,
  execution_id: z.string().min(1),
  raw_output_hash: hashSchema,
  conversation_scope_ref: z.string().min(1),
}).strict();

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
  material_role: z.enum([
    "control_capsule", "complete_case", "question_case", "parent_report",
    "prior_private_interpretation", "ready_book_text", "ready_book_index",
    "transport_receipt",
  ]).optional(),
  trust_class: z.enum([
    "instruction", "locked_fact", "nonbinding_prior_interpretation",
    "user_provided_data", "classical_source_data", "transport_evidence",
  ]).optional(),
  may_issue_instruction: z.boolean().optional(),
}).strict();

const ProviderInputPreflightReceiptSchema = z.object({
  schema_version: z.literal("ai-production-provider-input-preflight-receipt.v1"),
  status: z.literal("verified"),
  source_task_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  stage_id: XuanxueAiStageIdSchema,
  input_set_hash: hashSchema,
  files: z.array(z.object({
    input_id: z.string().min(1), ordinal: z.number().int().nonnegative(),
    file_name: z.string().min(1), sha256: hashSchema,
    byte_count: z.number().int().nonnegative(),
    provider_receipt_ref: z.string().min(1),
  }).strict()),
  provider_profile_ref: z.string().min(1),
  provider_profile_hash: hashSchema,
  issued_at: z.string().datetime(),
  receipt_hash: hashSchema,
}).strict();

const CloudStageMaterialBaseSchema = z.object({
  stage_id: XuanxueAiStageIdSchema,
  instruction_package_id: z.string().min(1),
  output_contract_ref: z.string().min(1),
  output_schema_ref: z.string().min(1).nullable(),
  expected_output_kind: z.enum(["text", "generated_image"]).default("text"),
  task_directive: z.string().min(1),
  timeout_ms: z.number().int().min(60_000).max(3_600_000),
  max_input_chars: z.number().int().positive(),
  max_file_count: z.number().int().min(0).max(64),
  inputs: z.array(XuanxueAiProductionCloudInputSchema),
  provider_input_preflight_receipt: ProviderInputPreflightReceiptSchema.optional(),
});

const ProviderSkillPackageIdentitySchema = z.object({
  schema_version: z.literal("xuanxue-provider-skill-package.v1"),
  skill_id: z.literal("xuanxue-ai-consumption-analysis"),
  skill_version: z.literal("2.0.0"),
  skill_hash: hashSchema,
  compiler_version: z.literal("xuanxue-ai-control-capsule-compiler.v1"),
  compiler_hash: hashSchema,
}).strict();

const ProductProfileSchema = z.object({
  profile_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  stage_id: XuanxueAiStageIdSchema,
  profile_version: z.literal("1.0.0"),
  profile_hash: hashSchema,
  active_domain_ids: z.array(z.enum(["bazi", "qimen", "hehun", "naming"])),
  active_section_ids: z.array(z.string().min(1)),
  conversation_mode: z.string().min(1),
  required_material_roles: z.array(z.string().min(1)),
  forbidden_material_roles: z.array(z.string().min(1)),
  prior_artifact_semantics: z.array(z.string()),
  user_delivery_semantics: z.string(),
  output_contract_ref: z.string().min(1),
}).strict();

const ActiveStageBindingSchema = z.object({
  schema_version: z.literal("xuanxue-ai-active-stage-binding.v1"),
  binding_key: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  stage_id: XuanxueAiStageIdSchema,
  profile: ProductProfileSchema,
  skill_package: ProviderSkillPackageIdentitySchema,
}).strict();

const CapsuleIdentitySchema = z.object({
  schema_version: z.literal("xuanxue-ai-control-capsule-v1"),
  canonical_skill_id: z.literal("xuanxue-ai-consumption-analysis"),
  canonical_skill_version: z.literal("2.0.0"),
  canonical_skill_hash: hashSchema,
  capsule_ref: z.string().min(1),
  capsule_hash: hashSchema,
  product_id: XuanxueAiProductIdSchema,
  stage_id: XuanxueAiStageIdSchema,
  active_profile_id: z.string().min(1),
  active_profile_hash: hashSchema,
  active_domain_ids: z.array(z.enum(["bazi", "qimen", "hehun", "naming"])),
  conversation_mode: z.string().min(1),
  output_contract_ref: z.string().min(1),
  output_contract_hash: hashSchema,
  case_ref: z.string().min(1),
  case_hash: hashSchema,
  attachment_manifest_hash: hashSchema,
  provider_profile_ref: z.string().min(1),
  provider_profile_hash: hashSchema,
  compiler_version: z.literal("xuanxue-ai-control-capsule-compiler.v1"),
  compiler_hash: hashSchema,
}).strict();

const ExecutionCandidateBindingSchema = z.object({
  schema_version: z.literal("xuanxue-ai-execution-candidate-binding.v1"),
  source_candidate_ref: z.string().min(1),
  source_candidate_hash: hashSchema,
  artifact_candidate_ref: z.string().min(1),
  artifact_candidate_hash: hashSchema,
  environment_candidate_ref: z.string().min(1),
  environment_candidate_hash: hashSchema,
}).strict();

const CloudStageMaterialSchema = z.discriminatedUnion("control_plane", [
  CloudStageMaterialBaseSchema.extend({
    control_plane: z.literal("provider_skill_capsule"),
    active_stage_binding: ActiveStageBindingSchema,
    capsule_identity: CapsuleIdentitySchema,
    execution_candidate_binding: ExecutionCandidateBindingSchema,
  }).strict(),
  CloudStageMaterialBaseSchema.extend({
    control_plane: z.literal("excluded_specialized_capability"),
    exclusion_reason: z.enum([
      "manual_accuracy_challenge", "payment_screenshot_observation",
      "public_knowledge_article_pipeline", "localization_report_translation",
      "localization_article_translation", "scheduled_quality_reflection",
    ]),
  }).strict(),
]);

const CloudSeededStageSchema = z.object({
  stage_id: XuanxueAiStageIdSchema,
  execution_id: z.string().min(1),
  raw_response_text: z.string(),
  raw_output_hash: hashSchema,
  provider_proof: z.record(z.string(), z.unknown()),
  transport_warnings: z.array(z.string()),
}).strict();

const cloudReplayOrderShape = {
  job_id: z.string().min(1),
  source_task_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  service_class: z.enum(["user_delivery", "public_content", "quality_background"]),
  trigger_kind: z.enum(["user_request", "manual_accuracy_challenge", "scheduled_public_content", "scheduled_quality_reflection"]),
  lineage_id: z.string().min(1).nullable(),
  reflection_snapshot_ref: z.string().min(1).nullable(),
  reflection_plan_id: z.string().min(1).nullable(),
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  request_hash: hashSchema,
  frozen_subject: CloudFrozenSubjectSchema,
  conversation_scope_ref: z.string().min(1),
  seeded_stages: z.array(CloudSeededStageSchema).max(4),
  materials: z.array(CloudStageMaterialSchema).min(1).max(4),
  created_at: z.string().min(1),
} as const;

const CloudDependencyReplaySchema = z.object({
  ...cloudReplayOrderShape,
  conversation_parent: z.null(),
  join_parents: z.tuple([]),
}).strict();

const CloudParentReplaySchema = z.object({
  ...cloudReplayOrderShape,
  conversation_parent: CloudConversationParentSchema.nullable(),
  join_parents: z.array(CloudJoinParentSchema).max(32),
  dependency_replays: z.array(CloudDependencyReplaySchema).max(32),
}).strict().superRefine((replay, context) => {
  const requiredIds = [
    ...(replay.conversation_parent
      ? [replay.conversation_parent.job_id]
      : []),
    ...replay.join_parents.map((parent) => parent.job_id),
  ];
  const providedIds = replay.dependency_replays.map(
    (dependency) => dependency.job_id,
  );
  if (
    new Set(requiredIds).size !== requiredIds.length
    || new Set(providedIds).size !== providedIds.length
    || requiredIds.length !== providedIds.length
    || requiredIds.some((jobId) => !providedIds.includes(jobId))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_GRAPH_INCOMPLETE",
      path: ["dependency_replays"],
    });
  }
});

const cloudClaimIdentityShape = {
  protocol_version: z.literal(
    XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION,
  ),
  job_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  source_task_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  service_class: z.enum(["user_delivery", "public_content", "quality_background"]),
  trigger_kind: z.enum(["user_request", "manual_accuracy_challenge", "scheduled_public_content", "scheduled_quality_reflection"]),
  lineage_id: z.string().min(1).nullable(),
  reflection_snapshot_ref: z.string().min(1).nullable(),
  reflection_plan_id: z.string().min(1).nullable(),
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  request_hash: hashSchema,
  frozen_subject: CloudFrozenSubjectSchema,
  conversation_scope_ref: z.string().min(1),
} as const;

const cloudClaimConversationShape = {
  conversation_parent: CloudConversationParentSchema.nullable(),
  join_parents: z.array(CloudJoinParentSchema).max(32),
  seeded_stages: z.array(CloudSeededStageSchema).max(4).default([]),
  continuation_parent_replay: CloudParentReplaySchema.nullable(),
  execution_lane: z.literal("supervised_local_gpt_web"),
  materials: z.array(CloudStageMaterialSchema).min(1).max(4),
} as const;

const cloudClaimLeaseShape = {
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
} as const;

const XuanxueAiProductionCloudClaimedJobBaseSchema = z.object({
  ...cloudClaimIdentityShape,
  ...cloudClaimConversationShape,
  ...cloudClaimLeaseShape,
}).strict();

type CloudClaimedJobCandidate = z.infer<typeof XuanxueAiProductionCloudClaimedJobBaseSchema>;

const inspectParentReplay = (job: CloudClaimedJobCandidate, context: z.RefinementCtx): void => {
  if (Boolean(job.conversation_parent) !== Boolean(job.continuation_parent_replay)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_REQUIRED",
      path: ["continuation_parent_replay"],
    });
  }
  if (job.conversation_parent
    && job.continuation_parent_replay?.job_id !== job.conversation_parent.job_id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_IDENTITY_INVALID",
      path: ["continuation_parent_replay", "job_id"],
    });
  }
};

const buildPreflightInputSet = (job: CloudClaimedJobCandidate, material: CloudClaimedJobCandidate["materials"][number]) => ({
  schema_version: "ai-production-provider-input-preflight-request.v1",
  source_task_id: job.source_task_id,
  product_id: job.product_id,
  input_bundle_ref: job.input_bundle_ref,
  input_bundle_hash: job.input_bundle_hash,
  stage_id: material.stage_id,
  inputs: material.inputs.map(({ input_id, ordinal, file_name, sha256, byte_count, object_ref }) => ({
    input_id,
    ordinal,
    file_name,
    sha256,
    byte_count,
    object_ref,
  })),
});

const preflightFilesMatch = (material: CloudClaimedJobCandidate["materials"][number]): boolean => {
  const receipt = material.provider_input_preflight_receipt;
  return Boolean(receipt && receipt.files.length === material.inputs.length
    && material.inputs.every((input, index) => {
      const file = receipt.files[index];
      return file?.input_id === input.input_id && file.ordinal === input.ordinal
        && file.file_name === input.file_name && file.sha256 === input.sha256
        && file.byte_count === input.byte_count;
    }));
};

const inspectMaterialPreflight = (
  job: CloudClaimedJobCandidate,
  material: CloudClaimedJobCandidate["materials"][number],
  context: z.RefinementCtx,
): void => {
  const receipt = material.provider_input_preflight_receipt;
  if (job.product_id === "public_knowledge_article_pipeline" && material.stage_id === "corpus_research" && !receipt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_PREFLIGHT_REQUIRED", path: ["materials"] });
    return;
  }
  if (!receipt) return;
  const { receipt_hash: receiptHash, ...receiptBody } = receipt;
  if (receipt.source_task_id !== job.source_task_id || receipt.product_id !== job.product_id
    || receipt.input_bundle_ref !== job.input_bundle_ref || receipt.input_bundle_hash !== job.input_bundle_hash
    || receipt.stage_id !== material.stage_id || receipt.input_set_hash !== canonicalHash(buildPreflightInputSet(job, material))
    || !preflightFilesMatch(material) || receiptHash !== canonicalHash(receiptBody)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_PREFLIGHT_INVALID", path: ["materials"] });
  }
};

export const XuanxueAiProductionCloudClaimedJobSchema = XuanxueAiProductionCloudClaimedJobBaseSchema.superRefine((job, context) => {
  inspectParentReplay(job, context);
  for (const material of job.materials) {
    inspectMaterialPreflight(job, material, context);
  }
});

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
