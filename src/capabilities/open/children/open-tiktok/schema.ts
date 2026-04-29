import { z } from "zod";

import { OpenRequestSchema, OpenResultSchema } from "../../schema.js";

export const OpenTikTokRequestSchema = OpenRequestSchema.extend({
  childCapabilityId: z.literal("open-tiktok"),
  platformId: z.literal("tiktok-web"),
  targetKind: z.literal("platform-feed"),
}).strict();

export const OpenTikTokResultSchema = OpenResultSchema.and(z.object({
  childCapabilityId: z.literal("open-tiktok"),
  platformId: z.literal("tiktok-web"),
  targetKind: z.literal("platform-feed"),
}).strict());