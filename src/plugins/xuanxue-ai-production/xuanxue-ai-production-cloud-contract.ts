import { z } from "zod";
import { CloudExecutionGrantV6Schema } from "./xuanxue-ai-production-runtime-protocol.js";

import {
  XuanxueAiProductionTriggerKindSchema,
  XuanxueMetaphysicsProviderExecutionProfileSchema,
  XuanxueAiProductIdSchema,
  XuanxueAiStageIdSchema,
} from "./xuanxue-ai-production.schema.js";
import {
  XuanxueLocalizationRoleSchema,
  XuanxueProviderExecutionProfileSchema,
  assertXuanxueLocalizationContract,
} from "./xuanxue-ai-production-localization-contract.js";
import {
  isXuanxueTerminalMetaphysicsProfile,
} from "./xuanxue-ai-production-terminal-profile.js";
import {
  xuanxueLocalOrderNode,
} from "./xuanxue-ai-production-product-contracts.js";
import { CloudFrozenSubjectSchema } from "./xuanxue-ai-production-cloud-subject-contract.js";

export const XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION =
  "xuanxue-ai-production-v6" as const;

/**
 * Generated projection of the xuanxue-web canonical V6 manifest.  This is
 * deliberately distinct from the localization product-contract manifest:
 * device pairing and Cloud grants bind the production protocol, while an
 * individual localization order still carries its own product contract hash.
 */
export const XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH =
  "sha256:84c4d00a33f712454278ec47896a96eadf61083c3e8df4e2547a7bc473287dd9" as const;

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

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
  storage_class: z.enum(["shared_static", "private_owner_scoped"]),
  owner_scope_hash: hashSchema.nullable(),
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

const CloudStageMaterialBaseSchema = z.object({
  stage_id: XuanxueAiStageIdSchema,
  instruction_package_id: z.string().min(1),
  output_contract_ref: z.string().min(1),
  output_schema_ref: z.string().min(1).nullable(),
  expected_output_kind: z.enum(["text", "generated_image"]),
  task_directive: z.string().min(1),
  timeout_ms: z.number().int().min(60_000).max(3_600_000),
  max_file_count: z.number().int().min(0).max(64),
  inputs: z.array(XuanxueAiProductionCloudInputSchema),
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
      "localization_article_translation", "localization_static_review_candidate",
      "localization_static_review_selector", "scheduled_quality_reflection",
    ]),
  }).strict(),
]);

const cloudSemanticIdentityShape = {
  contract_manifest_hash: hashSchema.nullable(),
  product_contract_hash: hashSchema,
  localization_role: XuanxueLocalizationRoleSchema.nullable(),
  provider_execution_profile: z.union([
    XuanxueMetaphysicsProviderExecutionProfileSchema,
    XuanxueProviderExecutionProfileSchema,
  ]).nullable(),
} as const;

const cloudReplayOrderShape = {
  job_id: z.string().min(1),
  source_task_id: z.string().min(1),
  product_id: XuanxueAiProductIdSchema,
  service_class: z.enum(["user_delivery", "public_content", "quality_background", "localization"]),
  trigger_kind: XuanxueAiProductionTriggerKindSchema,
  lineage_id: z.string().min(1).nullable(),
  reflection_snapshot_ref: z.string().min(1).nullable(),
  reflection_plan_id: z.string().min(1).nullable(),
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  request_hash: hashSchema,
  ...cloudSemanticIdentityShape,
  frozen_subject: CloudFrozenSubjectSchema,
  conversation_scope_ref: z.string().min(1),
  materials: z.array(CloudStageMaterialSchema).min(1).max(5),
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
  service_class: z.enum(["user_delivery", "public_content", "quality_background", "localization"]),
  trigger_kind: XuanxueAiProductionTriggerKindSchema,
  lineage_id: z.string().min(1).nullable(),
  reflection_snapshot_ref: z.string().min(1).nullable(),
  reflection_plan_id: z.string().min(1).nullable(),
  input_bundle_ref: z.string().min(1),
  input_bundle_hash: hashSchema,
  request_hash: hashSchema,
  ...cloudSemanticIdentityShape,
  frozen_subject: CloudFrozenSubjectSchema,
  conversation_scope_ref: z.string().min(1),
} as const;

const cloudClaimConversationShape = {
  conversation_parent: CloudConversationParentSchema.nullable(),
  join_parents: z.array(CloudJoinParentSchema).max(32),
  continuation_parent_replay: CloudParentReplaySchema.nullable(),
  execution_lane: z.literal("supervised_local_gpt_web"),
  materials: z.array(CloudStageMaterialSchema).min(1).max(5),
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
  grant: z.unknown().transform((value) => CloudExecutionGrantV6Schema.parse(value)),
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

const inspectLocalizationClaim = (
  job: CloudClaimedJobCandidate,
  context: z.RefinementCtx,
): void => {
  if (job.service_class !== "localization") {
    inspectNonLocalizationClaim(job, context);
    return;
  }
  inspectLocalizationContract(job, context);
  inspectLocalizationTopology(job, context);
};

const inspectNonLocalizationClaim = (
  job: CloudClaimedJobCandidate,
  context: z.RefinementCtx,
): void => {
  if (
    job.contract_manifest_hash !== null
    || job.localization_role !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_LOCALIZATION_IDENTITY_FORBIDDEN",
      path: ["localization_role"],
    });
  }
  const profile = job.provider_execution_profile as Record<string, unknown> | null;
  if (profile && !isXuanxueTerminalMetaphysicsProfile(profile)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_MISMATCH",
        path: ["provider_execution_profile"],
      });
  }
};

const inspectLocalizationContract = (
  job: CloudClaimedJobCandidate,
  context: z.RefinementCtx,
): void => {
  const material = job.materials[0];
  try {
    assertXuanxueLocalizationContract({
      contractManifestHash: job.contract_manifest_hash,
      productContractHash: job.product_contract_hash,
      role: job.localization_role,
      providerProfile: job.provider_execution_profile as never,
      inputKinds: material?.inputs.map((item) => item.kind) ?? [],
    });
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error
        ? error.message
        : "XUANXUE_AI_PRODUCTION_LOCALIZATION_CONTRACT_INVALID",
      path: ["localization_role"],
    });
  }
};

const inspectLocalizationTopology = (
  job: CloudClaimedJobCandidate,
  context: z.RefinementCtx,
): void => {
  const material = job.materials[0];
  if (
    job.service_class !== "localization"
    || job.materials.length !== 1
    || material?.control_plane !== "excluded_specialized_capability"
    || job.join_parents.length !== 0
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "XUANXUE_AI_PRODUCTION_LOCALIZATION_SINGLE_STAGE_INVALID",
      path: ["materials"],
    });
  }
};

const inspectGeneratedLocalOrder = (
  job: CloudClaimedJobCandidate,
  context: z.RefinementCtx,
): void => {
  try {
    xuanxueLocalOrderNode({
      productId: job.product_id,
      productContractHash: job.product_contract_hash,
      materials: job.materials.map((material) => ({ stageId: material.stage_id })),
    });
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error
        ? error.message
        : "XUANXUE_PRODUCT_EXECUTION_LOCAL_ORDER_INVALID",
      path: ["materials"],
    });
  }
};

export const XuanxueAiProductionCloudClaimedJobSchema =
XuanxueAiProductionCloudClaimedJobBaseSchema.superRefine((job, context) => {
  if (job.grant.job_id !== job.job_id
    || job.grant.device_id !== job.lease_owner
    || job.grant.lease_token !== job.lease_token
    || job.grant.lease_version !== job.lease_version
    || job.grant.lease_expires_at !== job.lease_expires_at
    || job.grant.source_task_id !== job.source_task_id
    || job.grant.request_hash !== job.request_hash
    || job.grant.product_contract_hash !== job.product_contract_hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_V6_CLAIM_GRANT_MISMATCH", path: ["grant"] });
  }
  inspectParentReplay(job, context);
  inspectGeneratedLocalOrder(job, context);
  inspectLocalizationClaim(job, context);
});

export type XuanxueAiProductionCloudClaimedJob = z.infer<
  typeof XuanxueAiProductionCloudClaimedJobSchema
>;

export interface XuanxueAiProductionCloudCredential {
  readonly protocol_version:
    typeof XUANXUE_AI_PRODUCTION_CLOUD_PROTOCOL_VERSION;
  readonly server_base_url: string;
  readonly environment_id: "production";
  readonly origin: string;
  readonly device_id: string;
  readonly device_epoch: number;
  readonly credential: string;
  readonly control_manifest_hash: `sha256:${string}`;
  readonly enrolled_at: string;
}

export interface XuanxueAiProductionCloudWorkerHandle {
  close(): Promise<void>;
}
