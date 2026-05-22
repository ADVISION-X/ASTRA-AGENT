import { z } from "zod";

const LAW_ID_PATTERN = /^(APEX|GRASSEYE)-[A-Z0-9-]+$/u;

export const lawIdSchema = z.string().regex(LAW_ID_PATTERN);

export const lawMetadataSchema = z
  .object({
    lawId: lawIdSchema,
    status: z.enum(["active", "retired", "draft"]),
    tier: z.string().min(1),
    capabilityDomain: z.string().min(1),
    enforcementMode: z.string().min(1),
    evidenceMode: z.string().min(1),
    summary: z.string().min(1),
  })
  .passthrough();

const lawSourceSchema = lawMetadataSchema.extend({
  filePath: z.string().min(1),
  blockIndex: z.number().int().nonnegative(),
});

export type LawSource = z.infer<typeof lawSourceSchema>;