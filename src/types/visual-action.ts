import { z } from "zod";

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

const VisualTargetCatalogSchema = z.object({
  targetType: VisualTargetTypeSchema,
  purpose: z.string().min(1),
  allowedActions: z.array(z.string().min(1)).min(1),
  requiredConfidence: z.number().min(0).max(1),
  requiredEvidence: z.string().min(1),
  failureBehavior: z.string().min(1),
});

type VisualTargetCatalog = z.infer<typeof VisualTargetCatalogSchema>;

type VisualTargetType = z.infer<typeof VisualTargetTypeSchema>;
type VisualBoundingBox = z.infer<typeof VisualBoundingBoxSchema>;
type VisualClickPoint = z.infer<typeof VisualClickPointSchema>;
type VisualTarget = z.infer<typeof VisualTargetSchema>;

export {
  VisualBoundingBoxSchema,
  VisualClickPointSchema,
  VisualTargetCatalogSchema,
  VisualTargetSchema,
  VisualTargetTypeSchema,
};

export type { VisualTargetType, VisualBoundingBox, VisualClickPoint, VisualTarget };
export type { VisualTargetCatalog };
