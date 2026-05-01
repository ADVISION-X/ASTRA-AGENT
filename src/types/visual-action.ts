import { z } from "zod";

import { PostActionVerificationAbilityResultSchema } from "../capabilities/post-action-verification/schema.js";

const finiteNumber = z.number().finite();

const VisualTargetTypeSchema = z.string().min(1);

const VisualBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: z.number().positive(),
  height: z.number().positive(),
}).strict();

const VisualClickPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

const VisualTargetSchema = z.object({
  targetType: VisualTargetTypeSchema,
  boundingBox: VisualBoundingBoxSchema,
  clickPoint: VisualClickPointSchema.nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
  visibleText: z.string().min(1).nullable().default(null),
}).strict();

const VisualActionVerificationResultSchema = PostActionVerificationAbilityResultSchema;

const VisualActionRequestSchema = z.object({
  actionType: z.string().min(1),
  actionPurpose: z.string().min(1),
  targetType: VisualTargetTypeSchema,
  target: VisualTargetSchema,
  roundId: z.string().min(1),
  videoVisitId: z.string().min(1).nullable().default(null),
  beforeEvidenceId: z.string().min(1).nullable().default(null),
});

const VisualActionResultSchema = z.object({
  actionLogId: z.string().min(1),
  result: z.enum(["success", "failed", "skipped", "review_required"]),
  afterEvidenceId: z.string().min(1).nullable().default(null),
  verificationResult: VisualActionVerificationResultSchema.nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
});

const VisualTargetCatalogSchema = z.object({
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

type VisualTargetType = z.infer<typeof VisualTargetTypeSchema>;
type VisualBoundingBox = z.infer<typeof VisualBoundingBoxSchema>;
type VisualClickPoint = z.infer<typeof VisualClickPointSchema>;
type VisualTarget = z.infer<typeof VisualTargetSchema>;

export {
  VisualActionRequestSchema,
  VisualActionResultSchema,
  VisualActionVerificationResultSchema,
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetCatalogSchema,
  VisualTargetSchema,
  VisualTargetTypeSchema,
};

export type { VisualTargetType, VisualBoundingBox, VisualClickPoint, VisualTarget };
export type { VisualActionRequest, VisualActionResult, VisualActionVerificationResult, VisualTargetCatalog };
