import { z } from "zod";

const isLawIdCharacter = (character: string): boolean =>
  (character >= "A" && character <= "Z") || (character >= "0" && character <= "9") || character === "-";

const hasLawIdPrefix = (value: string): boolean =>
  value.startsWith("APEX-") || value.startsWith("GRASSEYE-");

const isLawId = (value: string): boolean =>
  hasLawIdPrefix(value)
  && value.slice(value.indexOf("-") + 1).length > 0
  && [...value.slice(value.indexOf("-") + 1)].every(isLawIdCharacter);

export const lawIdSchema = z.string().refine(isLawId, "Law id must start with APEX- or GRASSEYE- and use uppercase letters, numbers, or dashes.");

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
