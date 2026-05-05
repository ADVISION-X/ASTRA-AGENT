import { z, type RefinementCtx } from "zod";

import {
  CommanderBoundaryDecisionSchema,
  CommanderChildKindSchema,
  CommanderCommandDecisionSchema,
  CommanderConsoleStatusSchema,
  CommanderDataQualityFlagSchema,
  CommanderDispatchChildCapabilityIdSchema,
  CommanderEvidenceRefSchema,
  CommanderHardStopDecisionSchema,
  CommanderIdempotencyDecisionSchema,
  CommanderOperatorRefSchema,
  CommanderPolicyDecisionSchema,
  CommanderReadDecisionSchema,
  CommanderReadModelSourceSchema,
  CommanderTargetRecordRefSchema,
  CommanderTimeoutDecisionSchema,
  CommanderTransportDecisionSchema,
  NonEmptyStringSchema,
} from "./commander-schema-foundation.js";

const RuntimeProofSchemaBase = z.object({
  proofId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema.nullable(),
  missionId: NonEmptyStringSchema.nullable(),
  traceId: NonEmptyStringSchema.nullable(),
  abilityGroupId: z.literal("commander-console"),
  childCapabilityId: CommanderDispatchChildCapabilityIdSchema,
  childKind: CommanderChildKindSchema,
  commandId: NonEmptyStringSchema.nullable(),
  readRequestId: NonEmptyStringSchema.nullable(),
  operatorRef: CommanderOperatorRefSchema,
  inputRef: NonEmptyStringSchema,
  outputRef: NonEmptyStringSchema.nullable(),
  commandEnvelopeRef: NonEmptyStringSchema.nullable(),
  resultEnvelopeRef: NonEmptyStringSchema.nullable(),
  readModelSource: CommanderReadModelSourceSchema.nullable(),
  targetRecordRef: CommanderTargetRecordRefSchema.nullable(),
  evidenceRefs: z.array(CommanderEvidenceRefSchema),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().min(0),
  status: CommanderConsoleStatusSchema,
  failureReason: NonEmptyStringSchema.nullable(),
  reviewRequiredReason: NonEmptyStringSchema.nullable(),
  boundaryDecision: CommanderBoundaryDecisionSchema,
  commandDecision: CommanderCommandDecisionSchema.nullable(),
  readDecision: CommanderReadDecisionSchema.nullable(),
  transportDecision: CommanderTransportDecisionSchema.nullable(),
  hardStopDecision: CommanderHardStopDecisionSchema.nullable(),
  timeoutDecision: CommanderTimeoutDecisionSchema,
  idempotencyDecision: CommanderIdempotencyDecisionSchema,
  policyDecision: CommanderPolicyDecisionSchema,
  dataQualityFlags: z.array(CommanderDataQualityFlagSchema),
}).strict();

const addProofIssue = (ctx: RefinementCtx, message: string) => {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
};

const validateProofFailureState = (
  value: z.infer<typeof RuntimeProofSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (value.status === "failed" && !value.failureReason) {
    addProofIssue(ctx, "failed proof requires failureReason");
  }
  if (value.status === "review_required" && !value.reviewRequiredReason) {
    addProofIssue(ctx, "review proof requires reviewRequiredReason");
  }
};

const validateProofKindState = (
  value: z.infer<typeof RuntimeProofSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (value.childKind === "command" && (!value.commandDecision || !value.transportDecision)) {
    addProofIssue(ctx, "command proof requires commandDecision and transportDecision");
  }
  if (value.childKind === "command" && !value.runId) {
    addProofIssue(ctx, "command proof requires runId");
  }
  if (value.childKind === "read" && !value.readDecision) {
    addProofIssue(ctx, "read proof requires readDecision");
  }
};

const validateProofTiming = (
  value: z.infer<typeof RuntimeProofSchemaBase>,
  ctx: RefinementCtx,
) => {
  if (value.startedAt > value.endedAt) {
    addProofIssue(ctx, "startedAt must be before or equal to endedAt");
  }
};

const RuntimeProofSchema = RuntimeProofSchemaBase.superRefine((value, ctx) => {
  validateProofFailureState(value, ctx);
  validateProofKindState(value, ctx);
  validateProofTiming(value, ctx);
});

export { RuntimeProofSchema };
