import { z } from "zod";

import { EvidenceRefSchema } from "../../types/evidence.js";
import { VisualMissionActionPlanOutputSchema, VisualMissionActionPlanRequestInputSchema } from "../../types/visual-mission-action-plan.js";
import {
  AiAbilityGroupIdSchema,
  AiChildCapabilityIdSchema,
  AiExecutionStatusSchema,
  AiModelRoleSchema,
  AiOutputAuthoritySchema,
  AiProviderKindSchema,
  AiSchemaValidationStatusSchema,
  AiBaseInputSchema,
} from "./schema-foundation.schema.js";
import { AiRuntimeProofSchema } from "./schema-runtime.schema.js";
import { validateAiResultSuccessInvariants } from "./schema-runtime-success-invariants.js";

const nullableString = z.string().min(1).nullable().default(null);
const nonNegativeNumber = z.number().finite().nonnegative();

const AiVisualMissionActionPlanInputSchema = AiBaseInputSchema.extend({
  taskType: z.literal("visual_mission_action_plan"),
  inputModality: z.literal("image_collection"),
  inputRefs: z.array(EvidenceRefSchema).min(2).max(50),
  input: VisualMissionActionPlanRequestInputSchema,
}).strict();

const AiVisualMissionActionPlanBaseResultSchema = z.object({
  status: AiExecutionStatusSchema,
  abilityGroupId: AiAbilityGroupIdSchema,
  childCapabilityId: AiChildCapabilityIdSchema,
  taskType: z.literal("visual_mission_action_plan"),
  modelProvider: AiProviderKindSchema,
  modelName: z.string().min(1),
  modelRole: AiModelRoleSchema,
  runtime: z.string().min(1),
  implementationStatus: z.string().min(1),
  outputAuthority: AiOutputAuthoritySchema,
  rawOutputRef: nullableString,
  schemaValidationStatus: AiSchemaValidationStatusSchema,
  confidence: z.number().min(0).max(1).nullable(),
  failureReason: nullableString,
  reviewRequiredReason: nullableString,
  durationMs: nonNegativeNumber,
  costEstimate: nonNegativeNumber.nullable(),
  evidenceRefs: z.array(EvidenceRefSchema),
  debugLogRef: nullableString,
  runtimeProof: AiRuntimeProofSchema,
  promptVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  createdAt: z.string().datetime(),
}).strict();

const AiVisualMissionActionPlanSuccessResultSchema = AiVisualMissionActionPlanBaseResultSchema.extend({
  status: z.literal("success"),
  outputAuthority: z.literal("authoritative"),
  output: VisualMissionActionPlanOutputSchema,
  failureReason: z.null().default(null),
  reviewRequiredReason: z.null().default(null),
}).strict();

const AiVisualMissionActionPlanFailedResultSchema = AiVisualMissionActionPlanBaseResultSchema.extend({
  status: z.literal("failed"),
  outputAuthority: z.literal("non_authoritative"),
  output: z.null(),
  failureReason: z.string().min(1),
  reviewRequiredReason: z.null().default(null),
}).strict();

const AiVisualMissionActionPlanReviewRequiredResultSchema = AiVisualMissionActionPlanBaseResultSchema.extend({
  status: z.literal("review_required"),
  outputAuthority: z.literal("non_authoritative"),
  output: z.null(),
  failureReason: z.null().default(null),
  reviewRequiredReason: z.string().min(1),
}).strict();

const AiVisualMissionActionPlanResultSchema = z.union([
  AiVisualMissionActionPlanSuccessResultSchema,
  AiVisualMissionActionPlanFailedResultSchema,
  AiVisualMissionActionPlanReviewRequiredResultSchema,
]).superRefine((value, context) => {
  if (value.status !== value.runtimeProof.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must match result.status", path: ["runtimeProof", "status"] });
  }
  if (value.status === "success" && value.confidence === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires confidence", path: ["confidence"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "non-success visual mission results must not expose output", path: ["output"] });
  }
  validateAiResultSuccessInvariants(value, context);
});

export {
  AiVisualMissionActionPlanInputSchema,
  AiVisualMissionActionPlanResultSchema,
  VisualMissionActionPlanOutputSchema as AiVisualMissionActionPlanOutputSchema,
};