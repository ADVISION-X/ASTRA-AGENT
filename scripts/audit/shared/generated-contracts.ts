import { z } from "zod";

import { lawIdSchema } from "./law-contracts.js";
import { blueprintRefSchema, executionGroupSchema } from "./manifest-contracts.js";

const auditConflictSchema = z
  .object({
    kind: z.enum([
      "duplicate-law-id",
      "duplicate-manifest-domain",
      "missing-manifest",
      "missing-inspector-entry",
      "unknown-law-reference",
      "uncovered-law",
      "law-parse-error",
      "manifest-parse-error",
    ]),
    message: z.string().min(1),
    filePath: z.string().min(1).optional(),
    capabilityDomain: z.string().min(1).optional(),
    lawId: lawIdSchema.optional(),
  })
  .strict();

const enforcementMatrixRowSchema = z
  .object({
    capabilityDomain: z.string().min(1),
    manifestPath: z.string().min(1),
    ownerInspectorPath: z.string().min(1),
    lawIds: z.array(lawIdSchema),
  })
  .strict();

export const auditPlanEntrySchema = z
  .object({
    capabilityDomain: z.string().min(1),
    manifestPath: z.string().min(1),
    ownerInspectorPath: z.string().min(1),
    executionGroup: executionGroupSchema,
    lawIds: z.array(lawIdSchema).min(1),
    clauseIds: z.array(z.string().min(1)).min(1),
    evidenceModes: z.array(z.string().min(1)).min(1),
    blueprintRefs: z.array(blueprintRefSchema),
  })
  .strict();

const staticClauseCoverageEntrySchema = z
  .object({
    lawId: lawIdSchema,
    capabilityDomain: z.string().min(1),
    clauses: z
      .array(
        z
          .object({
            clauseId: z.string().min(1),
            source: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type AuditConflict = z.infer<typeof auditConflictSchema>;
export type EnforcementMatrixRow = z.infer<typeof enforcementMatrixRowSchema>;
export type AuditPlanEntry = z.infer<typeof auditPlanEntrySchema>;
export type StaticClauseCoverageEntry = z.infer<typeof staticClauseCoverageEntrySchema>;