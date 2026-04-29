import { z } from "zod";

import { CaptureDesktopScreenInputSchema } from "../../schema.js";

export { CaptureDesktopScreenInputSchema };

export const CaptureDesktopScreenPlanSchema = z.object({
  kind: z.literal("capture"),
  operation: z.literal("desktop-screen"),
  screenId: z.string().min(1),
}).strict();
