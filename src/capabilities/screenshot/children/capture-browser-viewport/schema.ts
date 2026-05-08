import { z } from "zod";

import { CaptureBrowserViewportInputSchema } from "../../schema.js";

export { CaptureBrowserViewportInputSchema };

export const CaptureBrowserViewportPlanSchema = z.object({
  kind: z.literal("capture"),
  operation: z.literal("browser-viewport"),
  regionLabel: z.string().min(1),
  contentLines: z.array(z.string().min(1)).default([]),
  sampleDelayMs: z.number().int().nonnegative().nullable(),
}).strict();
