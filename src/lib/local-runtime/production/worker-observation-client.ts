import { z } from "zod";

import type { ProductionWorkerSession } from "./worker-session.js";

const claimReason = z.enum([
  "NO_UNFINISHED_V6_DEMAND", "RETRY_NOT_BEFORE_PENDING", "ACTIVE_LEASE_PRESENT",
  "CURRENT_NEXT_ACTION_NOT_CLAIM", "CONTROL_INTENT_NOT_CLAIMABLE",
  "PERMANENT_AUTHORIZATION_REVOKED", "DEVICE_ASSIGNMENT_MISMATCH", "CAPABILITY_MISMATCH",
  "MATERIAL_BINDING_UNRESOLVED", "CONCURRENT_SELECTION_IN_PROGRESS",
]);
const nextAction = z.enum([
  "CLAIM_AVAILABLE", "WAIT_RETRY_NOT_BEFORE", "LEASE_ACTIVE_UNTIL",
  "RECONCILE_ACCEPTED_ATTEMPT", "CONSUME_STAGED_RESULT", "RESOLVE_CONTROL_INTENT",
  "WAIT_MATCHING_DEVICE", "WAIT_MATCHING_CAPABILITY", "REPAIR_MATERIAL_BINDING",
  "STOPPED_AUTHORIZATION_REVOKED", "NONE_COMPLETED",
]);
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const WorkerObservationV6Schema = z.object({
  schema_version: z.literal("xuanxue-ai-worker-observation.v6"),
  observed_at: z.string().datetime(),
  claim_exclusion_counts: z.array(z.object({
    reason_code: claimReason,
    count: z.number().int().positive(),
  }).strict()).superRefine((entries, context) => {
    const indices = entries.map((entry) => claimReason.options.indexOf(entry.reason_code));
    if (new Set(indices).size !== indices.length
      || indices.some((value, index) => index > 0 && indices[index - 1]! >= value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_CLAIM_REASON_ORDER_INVALID" });
    }
  }),
  nearest_retry_not_before: z.string().datetime().nullable(),
  scope_total: z.number().int().nonnegative(),
  scope_truncated: z.boolean(),
  jobs: z.array(z.object({
    job_id: z.string().min(1), product_id: z.string().min(1), action_id: z.string().min(1),
    status: z.enum(["failed", "completed"]), current_reason_code: z.string().nullable(),
    accepted_attempt_count: z.number().int().nonnegative(), attempt_id: z.string().nullable(),
    next_action_code: nextAction, next_action_at: z.string().datetime().nullable(),
    authority_ref: z.string().min(1), business_admission_receipt_hash: hash.nullable(),
  }).strict().superRefine((job, context) => {
    const completed = job.status === "completed" && job.next_action_code === "NONE_COMPLETED"
      && job.current_reason_code === null && job.business_admission_receipt_hash !== null;
    const failed = job.status === "failed" && job.next_action_code !== "NONE_COMPLETED";
    if (!completed && !failed) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_OBSERVED_JOB_STATE_INVALID" });
    }
    if (["WAIT_RETRY_NOT_BEFORE", "LEASE_ACTIVE_UNTIL"].includes(job.next_action_code)
      && job.next_action_at === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "V6_OBSERVED_JOB_TTL_INVALID" });
    }
  })).max(25),
}).strict();

export type WorkerObservationV6 = z.infer<typeof WorkerObservationV6Schema>;

export const readWorkerObservationV6 = async (
  session: ProductionWorkerSession,
  jobId?: string,
): Promise<WorkerObservationV6> => {
  void session.workerSessionId;
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
  return WorkerObservationV6Schema.parse(await session.request(
    `/internal/ai-production/v6/worker-observation${query}`,
    { method: "GET" },
  ));
};
