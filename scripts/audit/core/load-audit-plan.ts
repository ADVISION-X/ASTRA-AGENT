import { readFileSync } from "node:fs";

import { z } from "zod";

import { auditPlanEntrySchema, type AuditPlanEntry } from "../shared/generated-contracts.js";
import { resolveFromRepo } from "../shared/paths.js";

const auditPlanFileSchema = z
  .object({
    generatedAt: z.string().min(1),
    entries: z.array(auditPlanEntrySchema),
  })
  .strict();

export const loadGeneratedAuditPlan = (): AuditPlanEntry[] => {
  const raw = JSON.parse(readFileSync(resolveFromRepo("scripts/audit/generated/audit-plan.generated.json"), "utf8"));
  return auditPlanFileSchema.parse(raw).entries;
};