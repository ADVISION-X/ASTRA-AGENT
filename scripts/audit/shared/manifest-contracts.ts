import { z } from "zod";

import { lawIdSchema } from "./law-contracts.js";

export const executionGroupSchema = z.enum(["foundation", "domain", "meta"]);

export const blueprintRefSchema = z
  .object({
    filePath: z.string().min(1),
    requiredAnchors: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const sourceEvidenceSchema = z
  .object({
    filePath: z.string().min(1),
    symbolName: z.string().min(1),
  })
  .strict();

export const clauseBindingBaseSchema = z
  .object({
    lawId: lawIdSchema,
    clauseId: z.string().min(1).refine((value) => value !== "primary", "Clause binding cannot use primary."),
    checkIds: z.array(z.string().min(1)).min(1),
    sourceEvidence: z.array(sourceEvidenceSchema).min(1),
  })
  .strict();

export const clauseBindingSchema = clauseBindingBaseSchema.superRefine((binding, context) => {
    const checkIds = new Set<string>();
    for (const [index, checkId] of binding.checkIds.entries()) {
      if (checkIds.has(checkId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate checkId ${checkId}.`,
          path: ["checkIds", index],
        });
      }
      checkIds.add(checkId);
    }
});

export const auditManifestSchema = z
  .object({
    capabilityDomain: z.string().min(1),
    ownerInspectorPath: z.string().min(1),
    executionGroup: executionGroupSchema,
    coverage: z
      .object({
        mode: z.literal("explicit"),
        bindings: z.array(clauseBindingSchema).min(1),
      })
      .strict(),
    blueprintRefs: z.array(blueprintRefSchema).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();

const manifestSourceSchema = auditManifestSchema.extend({
  manifestPath: z.string().min(1),
});

export type ManifestSource = z.infer<typeof manifestSourceSchema>;
