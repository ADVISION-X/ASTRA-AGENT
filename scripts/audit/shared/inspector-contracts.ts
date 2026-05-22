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
    filePath: z.string().min(1).optional(),
    evidence: z.string().min(1).optional(),
  })
  .strict();

export const inspectorOutputSchema = z
  .object({
    capabilityDomain: z.string().min(1),
    reportedLawIds: z.array(lawIdSchema),
    findings: z.array(inspectorFindingSchema),
    inspectedFiles: z.array(z.string().min(1)),
    reportJson: z.unknown().optional(),
    reportMarkdown: z.string().min(1).optional(),
  })
  .strict();

export type InspectorFinding = z.infer<typeof inspectorFindingSchema>;
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