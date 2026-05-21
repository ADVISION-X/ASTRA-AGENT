import { z } from "zod";

export const lawMetadataSchema = z
  .object({
    lawId: z.string().regex(/^APEX-[A-Z0-9-]+$/u),
    status: z.enum(["active", "retired", "draft"]),
    tier: z.string().min(1),
    capabilityDomain: z.string().min(1),
    enforcementMode: z.string().min(1),
    evidenceMode: z.string().min(1),
    summary: z.string().min(1),
  })
  .passthrough();

export const lawSourceSchema = lawMetadataSchema.extend({
  filePath: z.string().min(1),
  blockIndex: z.number().int().nonnegative(),
});

export type LawMetadata = z.infer<typeof lawMetadataSchema>;
export type LawSource = z.infer<typeof lawSourceSchema>;