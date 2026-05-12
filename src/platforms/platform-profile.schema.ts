import { z } from "zod";

const PlatformIdSchema = z.enum(["facebook-web", "tiktok-web"]);

const PlatformProfileSchema = z.object({
  platformId: PlatformIdSchema,
  displayName: z.string().min(1),
  entryUrl: z.string().url(),
  targetTitle: z.string().min(1),
  allowedHosts: z.array(z.string().min(1)).min(1),
  defaultRecoveryActionCode: z.string().min(1),
  supportedActionCodes: z.array(z.string().min(1)).min(1),
  nextVideoPreferredActionCode: z.string().min(1).optional(),
  likeActionHint: z.string().min(1).optional(),
  likeApprovedKey: z.string().min(1).optional(),
  commentsActionHint: z.string().min(1).optional(),
}).strict();

type PlatformId = z.infer<typeof PlatformIdSchema>;
type PlatformProfile = z.infer<typeof PlatformProfileSchema>;

export { PlatformIdSchema, PlatformProfileSchema };
export type { PlatformId, PlatformProfile };