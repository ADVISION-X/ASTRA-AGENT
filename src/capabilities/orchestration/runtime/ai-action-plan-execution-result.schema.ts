/**
 * AI Action Plan Execution Result — types for the orchestration execution loop.
 *
 * Moved from muscle-memory/executor. Execution belongs to Orchestration, not the registry.
 */

import { z } from "zod";

import { PayloadRefBundleSchema, TransitionStatusSchema } from "../schema.js";

const AiActionPlanExecutionActionResultSchema = z.object({
  resolvedActionId: z.string().min(1),
  sourceActionCode: z.string().min(1),
  syntheticStepId: z.string().min(1),
  targetAbilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  gridCell: z.string().min(1).nullable().default(null),
  targetName: z.string().min(1).nullable().default(null),
  summary: z.string().min(1).nullable().default(null),
  actionInputRef: z.string().min(1).nullable().default(null),
  status: TransitionStatusSchema,
  outputRef: z.string().min(1).nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
}).strict();

const AiActionPlanExecutionResultSchema = z.object({
  status: TransitionStatusSchema,
  failureReason: z.string().min(1).nullable().default(null),
  payloadRefs: PayloadRefBundleSchema,
  actionResults: z.array(AiActionPlanExecutionActionResultSchema).default([]),
}).strict();

type AiActionPlanExecutionActionResult = z.infer<typeof AiActionPlanExecutionActionResultSchema>;
type AiActionPlanExecutionResult = z.infer<typeof AiActionPlanExecutionResultSchema>;

/** Backward-compatible alias used by step-dispatch-muscle-memory-branch-fields */
type MuscleMemoryExecutionResult = AiActionPlanExecutionResult;
type MuscleMemoryExecutionActionResult = AiActionPlanExecutionActionResult;

export {
  AiActionPlanExecutionActionResultSchema,
  AiActionPlanExecutionResultSchema,
};

export type {
  AiActionPlanExecutionActionResult,
  AiActionPlanExecutionResult,
  MuscleMemoryExecutionResult,
  MuscleMemoryExecutionActionResult,
};
