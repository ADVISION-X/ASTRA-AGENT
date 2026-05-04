import { z } from "zod";

import { RequestedPlatformIdSchema } from "../schema/platform-id.schema.js";

export const MapAuthoringRequestSchema = z.object({
  missionId: z.string().min(1),
  objective: z.string().min(1),
  targetPlatform: RequestedPlatformIdSchema,
  allowedAutomationScope: z.string().min(1).default("observe_and_prepare_draft_only"),
  mustAskBefore: z.union([z.array(z.string().min(1)), z.string()]).default([]).transform((value) =>
    Array.isArray(value)
      ? value
      : value.split(",").map((item) => item.trim()).filter((item) => item.length > 0),
  ),
  failureHandlingPreference: z.string().min(1).default("review_required"),
  evidencePreference: z.string().min(1).default("refs_and_hashes_only"),
  runLimit: z.union([
    z.object({ maxRounds: z.number().int().positive(), maxMinutes: z.number().int().positive() }).strict(),
    z.string(),
  ]).default({ maxRounds: 5, maxMinutes: 15 }).transform((value) => {
    if (typeof value !== "string") {
      return value;
    }
    return {
      maxRounds: Number(value.match(/maxRounds=(\d+)/u)?.[1] ?? 5),
      maxMinutes: Number(value.match(/maxMinutes=(\d+)/u)?.[1] ?? 15),
    };
  }),
  operatorNotes: z.string().default(""),
  outputLanguage: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
}).strict();

export type MapAuthoringRequest = z.output<typeof MapAuthoringRequestSchema>;
