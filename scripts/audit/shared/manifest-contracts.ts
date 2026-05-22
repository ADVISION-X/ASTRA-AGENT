import { z } from "zod";

import { lawIdSchema } from "./law-contracts.js";

export const executionGroupSchema = z.enum(["foundation", "domain", "meta"]);

export const blueprintRefSchema = z
  .object({
    filePath: z.string().min(1),
    requiredAnchors: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const auditManifestSchema = z
  .object({
    capabilityDomain: z.string().min(1),
    ownerInspectorPath: z.string().min(1),
    executionGroup: executionGroupSchema,
    coverage: z
      .object({
        mode: z.literal("domain-wide"),
        clauseIds: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    lawIdRefs: z.array(lawIdSchema).min(1).optional(),
    blueprintRefs: z.array(blueprintRefSchema).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();

const manifestSourceSchema = auditManifestSchema.extend({
  manifestPath: z.string().min(1),
});

export type ManifestSource = z.infer<typeof manifestSourceSchema>;