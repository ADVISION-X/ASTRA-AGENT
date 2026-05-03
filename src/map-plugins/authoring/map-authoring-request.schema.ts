import { z } from "zod";

import { RequestedPlatformIdSchema } from "../schema/platform-id.schema.js";

export const MapAuthoringRequestSchema = z.object({
  missionId: z.string().min(1),
  objective: z.string().min(1),
  targetPlatform: RequestedPlatformIdSchema,
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict();

export type MapAuthoringRequest = z.output<typeof MapAuthoringRequestSchema>;