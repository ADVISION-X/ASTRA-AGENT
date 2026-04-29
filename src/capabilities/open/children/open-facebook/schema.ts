import { z } from "zod";

import { OpenRequestSchema, OpenResultSchema } from "../../schema.js";

export const OpenFacebookRequestSchema = OpenRequestSchema.extend({
  childCapabilityId: z.literal("open-facebook"),
  platformId: z.literal("facebook-web"),
  targetKind: z.literal("platform-feed"),
}).strict();

export const OpenFacebookResultSchema = OpenResultSchema.extend({
  childCapabilityId: z.literal("open-facebook"),
  platformId: z.literal("facebook-web"),
  targetKind: z.literal("platform-feed"),
}).strict();