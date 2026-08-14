import { z } from "zod";

import { clauseEvidenceModeSchema, lawIdSchema } from "./law-contracts.js";
import {
  blueprintRefSchema,
  clauseBindingBaseSchema,
  executionGroupSchema,
  primaryEvidenceSchema,
  sourceEvidenceSchema,
} from "./manifest-contracts.js";

const auditConflictSchema = z
  .object({
    kind: z.enum([
      "duplicate-law-id",
      "duplicate-manifest-domain",
      "missing-manifest",
      "missing-inspector-entry",
      "unknown-law-reference",
      "unknown-clause-reference",
      "wrong-clause-owner",
      "duplicate-clause-binding",
      "missing-clause-binding",
      "missing-source-evidence",
      "missing-source-symbol",
      "unreachable-source-evidence",
      "missing-blueprint-anchor",
      "missing-check-evidence",
      "missing-primary-evidence",
      "invalid-primary-evidence",
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
    bindings: z
      .array(
        clauseBindingBaseSchema.extend({
          evidenceMode: clauseEvidenceModeSchema,
        }),
      )
      .min(1),
    blueprintRefs: z.array(blueprintRefSchema),
  })
  .strict();

const staticClauseCoverageEntrySchema = z
  .object({
    lawId: lawIdSchema,
    clauseId: z.string().min(1),
    capabilityDomain: z.string().min(1),
    evidenceMode: z.enum(["static", "acceptance", "real-chrome"]),
    ownerInspectorPath: z.string().min(1),
    checkIds: z.array(z.string().min(1)).min(1),
    sourceEvidence: z.array(sourceEvidenceSchema).min(1),
    primaryEvidence: primaryEvidenceSchema.optional(),
    manifestPath: z.string().min(1),
  })
  .strict();

export type AuditConflict = z.infer<typeof auditConflictSchema>;
export type EnforcementMatrixRow = z.infer<typeof enforcementMatrixRowSchema>;
export type AuditPlanEntry = z.infer<typeof auditPlanEntrySchema>;
export type StaticClauseCoverageEntry = z.infer<typeof staticClauseCoverageEntrySchema>;
