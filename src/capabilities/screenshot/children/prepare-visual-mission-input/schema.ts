import { z } from "zod";

import { PrepareVisualMissionInputInputSchema, ScreenshotSourceProofSchema } from "../../schema.js";

export { PrepareVisualMissionInputInputSchema };

export const PrepareVisualMissionInputPlanSchema = z.object({
  kind: z.literal("image-processing"),
  operation: z.literal("prepare-visual-mission-input"),
  sourceFilePath: z.string().min(1),
  sourceProof: ScreenshotSourceProofSchema,
  rowCount: z.number().int().positive(),
  columnCount: z.number().int().positive(),
}).strict();