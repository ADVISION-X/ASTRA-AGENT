import { z } from "zod";

import { CaptureRegionInputSchema, ScreenshotBoundingBoxSchema, ScreenshotSourceProofSchema } from "../../schema.js";

export { CaptureRegionInputSchema };

export const CaptureRegionPlanSchema = z.object({
  kind: z.literal("image-processing"),
  operation: z.literal("capture-region"),
  sourceFilePath: z.string().min(1),
  sourceProof: ScreenshotSourceProofSchema,
  region: ScreenshotBoundingBoxSchema,
}).strict();
