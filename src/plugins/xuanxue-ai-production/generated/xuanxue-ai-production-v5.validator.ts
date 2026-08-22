import { z } from "zod";

const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const XuanxueAiProductionV5ManifestSchema = z.object({
  schema_version: z.literal("xuanxue-ai-production-contract-manifest.v5"),
  protocol_version: z.literal("xuanxue-ai-production-v5"),
  max_browser_in_flight: z.literal(1),
  browser_workspace_ttl_ms: z.literal(28_800_000),
  required_structures: z.tuple([
    z.literal("CloudExecutionGrantV5"), z.literal("ExecutionFenceV5"),
    z.literal("DeadlineBudgetV5"), z.literal("SessionWorkspaceApprovalV5"),
    z.literal("BrowserCommandV5"), z.literal("MutationJournalV5"),
    z.literal("FirstTerminalCasV5"), z.literal("CancelRecoveryHandoverV5"),
  ]),
}).strict();

export const CloudExecutionGrantV5Schema = z.object({
  schema_version: z.literal("xuanxue-ai-cloud-execution-grant-v5"),
  job_id: z.string().min(1),
  attempt_id: z.string().min(1),
  required_device_id: z.string().min(1),
  lease_token: z.string().min(1),
  lease_version: z.number().int().positive(),
  lease_expires_at: z.string().datetime(),
  server_now: z.string().datetime(),
  contract_manifest_hash: hash,
  execution_fence: z.object({
    schema_version: z.literal("xuanxue-ai-execution-fence-v5"),
    attempt_id: z.string().min(1), required_device_id: z.string().min(1),
    lease_version: z.number().int().positive(), fence_hash: hash,
  }).strict(),
  deadline_budget: z.object({
    schema_version: z.literal("xuanxue-ai-deadline-budget-v5"),
    server_now: z.string().datetime(), lease_expires_at: z.string().datetime(),
    command_ttl_ms: z.number().int().min(1).max(3_600_000), safety_margin_ms: z.literal(10_000),
  }).strict(),
}).strict().superRefine((grant, context) => {
  if (grant.execution_fence.attempt_id !== grant.attempt_id
    || grant.execution_fence.required_device_id !== grant.required_device_id
    || grant.execution_fence.lease_version !== grant.lease_version
    || grant.deadline_budget.server_now !== grant.server_now
    || grant.deadline_budget.lease_expires_at !== grant.lease_expires_at) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "XUANXUE_AI_PRODUCTION_V5_GRANT_BINDING_INVALID" });
  }
});

export type CloudExecutionGrantV5 = z.infer<typeof CloudExecutionGrantV5Schema>;
