import { z } from "zod";

import { OptimizeLosslessInputSchema, ScreenshotSourceProofSchema } from "../../schema.js";

export { OptimizeLosslessInputSchema };

export const OptimizeLosslessPlanSchema = z.object({
  kind: z.literal("image-processing"),
  operation: z.literal("optimize-lossless"),
  sourceFilePath: z.string().min(1),
  sourceProof: ScreenshotSourceProofSchema,
}).strict();
