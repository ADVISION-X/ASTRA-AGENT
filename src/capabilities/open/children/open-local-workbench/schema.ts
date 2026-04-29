import { z } from "zod";

import { OpenRequestSchema, OpenResultSchema } from "../../schema.js";

export const OpenLocalWorkbenchRequestSchema = OpenRequestSchema.extend({
  childCapabilityId: z.literal("open-local-workbench"),
  platformId: z.literal("local-workbench"),
  targetKind: z.literal("local-workbench"),
}).strict();

export const OpenLocalWorkbenchResultSchema = OpenResultSchema.and(z.object({
  childCapabilityId: z.literal("open-local-workbench"),
  platformId: z.literal("local-workbench"),
  targetKind: z.literal("local-workbench"),
}).strict());