import { z } from "zod";

import { PostActionVerificationAbilityResultSchema } from "../capabilities/post-action-verification/schema.js";

import {
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetSchema,
  VisualTargetTypeSchema,
  type VisualBoundingBox,
  type VisualClickPoint,
  type VisualTarget,
  type VisualTargetType,
} from "../capabilities/visual-target/index.js";

export const VisualActionVerificationResultSchema = PostActionVerificationAbilityResultSchema;

export const VisualActionRequestSchema = z.object({
  actionType: z.string().min(1),
  actionPurpose: z.string().min(1),
  targetType: VisualTargetTypeSchema,
  target: VisualTargetSchema,
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
});

export const VisualActionResultSchema = z.object({
  actionLogId: z.string().min(1),
  result: z.enum(["success", "failed", "skipped", "review_required"]),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionVerificationResultSchema.nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
});

export const VisualTargetCatalogSchema = z.object({
  targetType: VisualTargetTypeSchema,
  purpose: z.string().min(1),
  allowedActions: z.array(z.string().min(1)).min(1),
  requiredConfidence: z.number().min(0).max(1),
  requiredEvidence: z.string().min(1),
  failureBehavior: z.string().min(1),
});

type VisualActionRequest = z.infer<typeof VisualActionRequestSchema>;
type VisualActionResult = z.infer<typeof VisualActionResultSchema>;
type VisualActionVerificationResult = z.infer<typeof VisualActionVerificationResultSchema>;
type VisualTargetCatalog = z.infer<typeof VisualTargetCatalogSchema>;

export {
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetSchema,
  VisualTargetTypeSchema,
};

export type { VisualTargetType, VisualBoundingBox, VisualClickPoint, VisualTarget };


export type { VisualActionRequest, VisualActionResult, VisualActionVerificationResult, VisualTargetCatalog };
