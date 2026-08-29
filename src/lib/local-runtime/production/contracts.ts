import { createHash } from "node:crypto";
import { z } from "zod";

import { executionFailure } from "../../typed-failure.js";

const WEBSITE_AGENT_PROTOCOL_VERSION = "xuanxue-ai-production-v6" as const;
export const TASK_CONTRACT_ID = "website-agent-task" as const;
export const TASK_CONTRACT_VERSION = 1 as const;
export const RESULT_CONTRACT_ID = "website-agent-result" as const;
export const RESULT_CONTRACT_VERSION = 1 as const;

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
  .transform((value): `sha256:${string}` => value as `sha256:${string}`);

const TerminalStatusSchema = z.literal("completed");
export const SerializedExecutionFailureSchema = z.object({
  code: z.string().min(1).max(240),
  mutation_outcome: z.enum(["no", "dispatched", "confirmed"]),
  evidence_ref: z.string().min(1).max(1_000).nullable(),
  evidence_hash: hashSchema.nullable(),
  cause: z.object({
    name: z.string().min(1).max(240),
    code: z.string().min(1).max(240).nullable(),
  }).strict().nullable(),
}).strict();

const TerminalReceiptSchema = z.object({
  schema_version: z.literal("xuanxue-ai-terminal-receipt.v6"),
  job_id: z.string().min(1).max(240),
  terminal_status: TerminalStatusSchema,
  payload_hash: hashSchema,
  failure: z.null(),
  first_terminal: z.boolean(),
  device_id: z.string().min(1).max(240),
  device_epoch: z.number().int().positive(),
  worker_session_id: z.string().min(1).max(240),
  worker_session_epoch: z.number().int().positive(),
  runtime_attestation_receipt_hash: hashSchema,
}).strict().superRefine((receipt, context) => {
  if (receipt.failure !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_COMPLETION_RECEIPT_FAILURE_FORBIDDEN" });
  }
});

export type TerminalReceipt = z.infer<typeof TerminalReceiptSchema>;
type TerminalReceiptExpectation = Readonly<{
  job_id: string;
  terminal_status: TerminalReceipt["terminal_status"];
  payload_hash: ProductionHash;
  failure: null;
  worker_session_id: string;
  worker_session_epoch: number;
}>;

const TerminalReceiptExpectationSourceSchema = z.object({
  schema_version: z.literal("xuanxue-ai-terminal-cas.v6"),
  job_id: z.string().min(1).max(240),
  terminal_status: TerminalStatusSchema,
  payload_hash: hashSchema,
  failure: z.null(),
  worker_session_id: z.string().min(1).max(240),
  worker_session_epoch: z.number().int().positive(),
}).passthrough().superRefine((request, context) => {
  if (request.failure !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_COMPLETION_REQUEST_FAILURE_FORBIDDEN" });
  }
});

export const ProductionProductIdSchema = z.enum([
  "bazi_chart_interpretation",
  "bazi_ai_full_analysis",
  "bazi_report_followup",
  "qimen_professional_answer",
  "qimen_report_followup",
  "hehun_ai_analysis",
  "hehun_report_followup",
  "naming_bazi_analysis_and_naming",
  "naming_from_existing_bazi_report",
  "public_knowledge_article_pipeline",
  "localization_report_translation",
  "localization_article_translation",
  "payment_screenshot_observation",
]);

const ProductionActionIdSchema = z.enum([
  "produce",
  "followup",
  "produce_article",
  "report_translation",
  "article_translation",
  "observe",
  "accuracy_challenge",
  "quality_reflection",
]);

const ProductionMaterialSchema = z.object({
  material_id: z.string().min(1).max(240),
  ordinal: z.number().int().nonnegative(),
  role: z.string().min(1).max(120),
  display_name: z.string().min(1).max(240),
  object_ref: z.string().min(1).max(1_000),
  sha256: hashSchema,
  bytes: z.number().int().nonnegative(),
  media_type: z.string().min(1).max(160),
  storage_class: z.enum(["shared_static", "private_owner_scoped"]),
  owner_scope_hash: hashSchema.nullable(),
  trust_class: z.enum([
    "instruction",
    "locked_fact",
    "nonbinding_prior_interpretation",
    "user_provided_data",
    "classical_source_data",
    "transport_evidence",
  ]),
  may_issue_instruction: z.boolean(),
}).strict().superRefine((material, context) => {
  if (material.display_name !== material.display_name.normalize("NFC")
    || material.display_name.includes("/") || material.display_name.includes("\\")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_MATERIAL_DISPLAY_NAME_INVALID" });
  }
  if (material.storage_class === "private_owner_scoped" && material.owner_scope_hash === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_PRIVATE_MATERIAL_OWNER_REQUIRED" });
  }
  if (material.storage_class === "shared_static" && material.owner_scope_hash !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_SHARED_MATERIAL_OWNER_FORBIDDEN" });
  }
  if (material.may_issue_instruction && material.trust_class !== "instruction") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_MATERIAL_INSTRUCTION_AUTHORITY_INVALID" });
  }
  if (/(?:^|_)(?:stage|step|feed_to|selector_first|continue_exact_prompt)(?:_|$)/iu.test(material.role)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_MATERIAL_EXECUTION_ROLE_FORBIDDEN" });
  }
});

export const WebsiteAgentTaskBaseSchema = z.object({
  schema_version: z.literal("website-agent-task.v1"),
  protocol_version: z.literal(WEBSITE_AGENT_PROTOCOL_VERSION),
  job_id: z.string().min(1).max(240),
  source_task_id: z.string().min(1).max(240),
  product_id: ProductionProductIdSchema,
  action_id: ProductionActionIdSchema,
  idempotency_key: z.string().min(1).max(500),
  request_hash: hashSchema,
  task_contract_id: z.literal(TASK_CONTRACT_ID),
  task_contract_version: z.literal(TASK_CONTRACT_VERSION),
  business_identity: z.object({
    owner_ref: z.string().min(1).max(240),
    subject_ref: z.string().min(1).max(500),
    authorization_ref: z.string().min(1).max(500),
  }).strict(),
  business_context_ref: z.string().min(1).max(500),
  business_context_hash: hashSchema,
  parameters: z.record(z.unknown()),
  material_refs: z.array(ProductionMaterialSchema).max(64),
  result_contract_id: z.literal(RESULT_CONTRACT_ID),
  result_contract_version: z.literal(RESULT_CONTRACT_VERSION),
  privacy_subject_ref: z.string().min(1).max(240).optional(),
  continuation_ref: z.string().min(1).max(1_000).optional(),
  parent_task_ref: z.string().min(1).max(500).optional(),
  parent_result_ref: z.string().min(1).max(1_000).optional(),
  parent_result_hash: hashSchema.optional(),
  subject_task_ref: z.string().min(1).max(500).optional(),
  subject_result_ref: z.string().min(1).max(1_000).optional(),
  subject_result_hash: hashSchema.optional(),
  review_policy: z.string().min(1).max(500).optional(),
}).strict();

export const WebsiteAgentTaskSchema = WebsiteAgentTaskBaseSchema.superRefine((task, context) => {
  const identities = new Set(task.material_refs.map((material) => material.material_id));
  const ordinals = new Set(task.material_refs.map((material) => material.ordinal));
  const names = new Set(task.material_refs.map((material) => material.display_name));
  if (identities.size !== task.material_refs.length || ordinals.size !== task.material_refs.length
    || names.size !== task.material_refs.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_MATERIAL_IDENTITY_DUPLICATE" });
  }
  const review = task.action_id === "accuracy_challenge" || task.action_id === "quality_reflection";
  const reviewFields = [
    task.subject_task_ref,
    task.subject_result_ref,
    task.subject_result_hash,
    task.review_policy,
  ];
  if ((review && reviewFields.some((value) => value === undefined))
    || (!review && reviewFields.some((value) => value !== undefined))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_REVIEW_SUBJECT_INVALID" });
  }
  const { request_hash: _requestHash, job_id: _jobId, ...canonical } = task;
  if (hashCanonical(canonical) !== task.request_hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_TASK_REQUEST_HASH_MISMATCH" });
  }
});

export type WebsiteAgentTask = z.infer<typeof WebsiteAgentTaskSchema>;
export type ProductionProductId = z.infer<typeof ProductionProductIdSchema>;
export type ProductionActionId = z.infer<typeof ProductionActionIdSchema>;
type ProductionMaterial = z.infer<typeof ProductionMaterialSchema>;
export type ProductionHash = `sha256:${string}`;

export type LocalProductionMaterial = ProductionMaterial & Readonly<{ local_path: string }>;

export interface WebsiteAgentResult {
  readonly schema_version: "website-agent-result.v1";
  readonly job_id: string;
  readonly source_task_id: string;
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
  readonly plugin_id: string;
  readonly plugin_version: number;
  readonly result_contract_id: typeof RESULT_CONTRACT_ID;
  readonly result_contract_version: typeof RESULT_CONTRACT_VERSION;
  readonly result_payload_ref: string;
  readonly result_payload_hash: ProductionHash;
  readonly result_payload_bytes: number;
  readonly result_payload_media_type: string;
  readonly result_object_receipt: Readonly<{
    object_ref: string;
    sha256: ProductionHash;
    bytes: number;
    media_type: string;
    receipt_hash: ProductionHash;
  }>;
  readonly evidence_refs: readonly string[];
  readonly execution_receipt_hash: ProductionHash;
  readonly continuation_ref?: string;
}

export const WebsiteAgentResultSchema = z.object({
  schema_version: z.literal("website-agent-result.v1"),
  job_id: z.string().min(1).max(240),
  source_task_id: z.string().min(1).max(240),
  product_id: ProductionProductIdSchema,
  action_id: ProductionActionIdSchema,
  plugin_id: z.string().min(1).max(160),
  plugin_version: z.number().int().positive(),
  result_contract_id: z.literal(RESULT_CONTRACT_ID),
  result_contract_version: z.literal(RESULT_CONTRACT_VERSION),
  result_payload_ref: z.string().min(1).max(1_000),
  result_payload_hash: hashSchema,
  result_payload_bytes: z.number().int().nonnegative(),
  result_payload_media_type: z.string().min(1).max(160),
  result_object_receipt: z.object({
    object_ref: z.string().min(1).max(1_000),
    sha256: hashSchema,
    bytes: z.number().int().nonnegative(),
    media_type: z.string().min(1).max(160),
    receipt_hash: hashSchema,
  }).strict(),
  evidence_refs: z.array(z.string().min(1).max(1_000)),
  execution_receipt_hash: hashSchema,
  continuation_ref: z.string().min(1).max(1_000).optional(),
}).strict();

export interface DurablePluginIdentity {
  readonly catalog_hash: ProductionHash;
  readonly plugin_id: string;
  readonly plugin_version: number;
  readonly skill_hash: ProductionHash;
  readonly checkpoint_schema_version: number;
  readonly request_hash: ProductionHash;
}

export interface AgentPluginCapabilityManifest {
  readonly schema_version: "agent-plugin-capability-manifest.v1";
  readonly catalog_hash: ProductionHash;
  readonly plugins: readonly Readonly<{
    plugin_id: string;
    plugin_version: number;
    accepts: readonly Readonly<{
      product_id: ProductionProductId;
      action_id: ProductionActionId;
    }>[];
    task_contract_version: typeof TASK_CONTRACT_VERSION;
    result_contract_version: typeof RESULT_CONTRACT_VERSION;
  }>[];
}

export const AgentPluginCapabilityManifestSchema = z.object({
  schema_version: z.literal("agent-plugin-capability-manifest.v1"),
  catalog_hash: hashSchema,
  plugins: z.array(z.object({
    plugin_id: z.string().min(1).max(160),
    plugin_version: z.number().int().positive(),
    accepts: z.array(z.object({
      product_id: ProductionProductIdSchema,
      action_id: ProductionActionIdSchema,
    }).strict()).min(1),
    task_contract_version: z.literal(TASK_CONTRACT_VERSION),
    result_contract_version: z.literal(RESULT_CONTRACT_VERSION),
  }).strict()).length(12),
}).strict().superRefine((manifest, context) => {
  if (hashCanonical(manifest.plugins) !== manifest.catalog_hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_CAPABILITY_MANIFEST_HASH_MISMATCH" });
  }
  const pluginIds = new Set(manifest.plugins.map((plugin) => plugin.plugin_id));
  const routes = manifest.plugins.flatMap((plugin) => plugin.accepts
    .map((accept) => `${accept.product_id}\0${accept.action_id}`));
  if (pluginIds.size !== manifest.plugins.length || new Set(routes).size !== routes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_CAPABILITY_MANIFEST_IDENTITY_DUPLICATE" });
  }
  if (routes.length !== 39) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "AGENT_CAPABILITY_ROUTE_DENOMINATOR_INVALID" });
  }
});

export const sha256 = (value: string | Uint8Array): ProductionHash =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const hashCanonical = (value: unknown): ProductionHash => {
  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
    return typeof input === "string" ? input.normalize("NFC") : input;
  };
  return sha256(JSON.stringify(canonical(value)));
};

export const parseTerminalReceiptExpectation = (value: unknown): TerminalReceiptExpectation => {
  let candidate = value;
  if (typeof value === "string") {
    try { candidate = JSON.parse(value) as unknown; }
    catch (cause) {
      throw executionFailure("review_required", "V6_TERMINAL_RECEIPT_EXPECTATION_INVALID", { cause });
    }
  }
  const parsed = TerminalReceiptExpectationSourceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw executionFailure("review_required", "V6_TERMINAL_RECEIPT_EXPECTATION_INVALID", { cause: parsed.error });
  }
  return Object.freeze({
    job_id: parsed.data.job_id,
    terminal_status: parsed.data.terminal_status,
    payload_hash: parsed.data.payload_hash,
    failure: parsed.data.failure,
    worker_session_id: parsed.data.worker_session_id,
    worker_session_epoch: parsed.data.worker_session_epoch,
  });
};

export const parseTerminalReceipt = (
  value: unknown,
  expected: TerminalReceiptExpectation,
): TerminalReceipt => {
  const parsed = TerminalReceiptSchema.safeParse(value);
  if (!parsed.success) {
    throw executionFailure("review_required", "V6_TERMINAL_RECEIPT_INVALID", { cause: parsed.error });
  }
  const receipt = parsed.data;
  if (receipt.job_id !== expected.job_id
    || receipt.terminal_status !== expected.terminal_status
    || receipt.payload_hash !== expected.payload_hash
    || receipt.worker_session_id !== expected.worker_session_id
    || receipt.worker_session_epoch !== expected.worker_session_epoch
    || hashCanonical(receipt.failure) !== hashCanonical(expected.failure)) {
    throw executionFailure("review_required", "V6_TERMINAL_RECEIPT_MISMATCH");
  }
  return Object.freeze(receipt);
};
