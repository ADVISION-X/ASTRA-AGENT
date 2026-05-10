import { z } from "zod";

import { PayloadRefBundleSchema, TransitionStatusSchema } from "../../capabilities/orchestration/schema.js";

const MuscleMemoryExecutionActionResultSchema = z.object({
  resolvedActionId: z.string().min(1),
  sourceActionCode: z.string().min(1),
  syntheticStepId: z.string().min(1),
  targetAbilityGroupId: z.string().min(1),
  childCapabilityId: z.string().min(1),
  actionInputRef: z.string().min(1).nullable().default(null),
  status: TransitionStatusSchema,
  outputRef: z.string().min(1).nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
}).strict();

const MuscleMemoryExecutionResultSchema = z.object({
  status: TransitionStatusSchema,
  failureReason: z.string().min(1).nullable().default(null),
  payloadRefs: PayloadRefBundleSchema,
  actionResults: z.array(MuscleMemoryExecutionActionResultSchema).default([]),
}).strict();

type MuscleMemoryExecutionActionResult = z.infer<typeof MuscleMemoryExecutionActionResultSchema>;
type MuscleMemoryExecutionResult = z.infer<typeof MuscleMemoryExecutionResultSchema>;

export {
  MuscleMemoryExecutionActionResultSchema,
  MuscleMemoryExecutionResultSchema,
};

export type {
  MuscleMemoryExecutionActionResult,
  MuscleMemoryExecutionResult,
};