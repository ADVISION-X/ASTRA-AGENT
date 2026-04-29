import { z } from "zod";

import { PrepareAiInputInputSchema, ScreenshotBoundingBoxSchema, ScreenshotSourceProofSchema } from "../../schema.js";

export { PrepareAiInputInputSchema };

export const PrepareAiInputPlanSchema = z.object({
  kind: z.literal("image-processing"),
  operation: z.literal("prepare-ai-input"),
  sourceFilePath: z.string().min(1),
  sourceProof: ScreenshotSourceProofSchema,
  region: ScreenshotBoundingBoxSchema.nullable().default(null),
  maxAiWidth: z.number().finite().positive(),
}).strict();
