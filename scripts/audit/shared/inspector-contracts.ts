import type { Project } from "ts-morph";
import { z } from "zod";

import { auditPlanEntrySchema } from "./generated-contracts.js";
import { lawIdSchema } from "./law-contracts.js";

const inspectorFindingSchema = z
  .object({
    checkId: z.string().min(1),
    lawId: lawIdSchema,
    clauseId: z.string().min(1),
    message: z.string().min(1),
    line: z.number().int().positive().optional(),
    severity: z.literal("fatal"),
    hint: z.string().min(1).optional(),
    filePath: z.string().min(1).optional(),
    evidence: z.string().min(1).optional(),
  })
  .strict();

export const executedCheckSchema = z
  .object({
    lawId: lawIdSchema,
    clauseId: z.string().min(1),
    checkId: z.string().min(1),
  })
  .strict();

export const inspectorOutputSchema = z
  .object({
    capabilityDomain: z.string().min(1),
    reportedLawIds: z.array(lawIdSchema),
    executedChecks: z.array(executedCheckSchema),
    findings: z.array(inspectorFindingSchema),
    inspectedFiles: z.array(z.string().min(1)),
    reportJson: z.unknown().optional(),
    reportMarkdown: z.string().min(1).optional(),
  })
  .strict();

export type InspectorFinding = z.infer<typeof inspectorFindingSchema>;
export type ExecutedCheck = z.infer<typeof executedCheckSchema>;
export type InspectorOutput = z.infer<typeof inspectorOutputSchema>;
type AuditPlanEntry = z.infer<typeof auditPlanEntrySchema>;
export type CompletedReport = {
  status: "PASS" | "FAIL";
  findingCount: number;
  reportPath: string;
};

export type InspectorContext = {
  project: Project;
  planEntry: AuditPlanEntry;
  generatedPlan: readonly AuditPlanEntry[];
  completedReports: Readonly<Record<string, CompletedReport>>;
};

export const executedChecksForPlan = (context: InspectorContext): ExecutedCheck[] =>
  context.planEntry.bindings.flatMap((binding) =>
    binding.checkIds.map((checkId) => ({
      lawId: binding.lawId,
      clauseId: binding.clauseId,
      checkId,
    })));
