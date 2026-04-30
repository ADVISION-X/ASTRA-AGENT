import { z } from "zod";

export const MapAuthoringRequestSchema = z.object({
  missionId: z.string().min(1),
  objective: z.string().min(1),
  targetPlatform: z.string().min(1),
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict();

export type MapAuthoringRequest = z.output<typeof MapAuthoringRequestSchema>;