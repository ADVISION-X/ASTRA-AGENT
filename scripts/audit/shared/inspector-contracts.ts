import type { Project } from "ts-morph";
import { z } from "zod";

import { auditPlanEntrySchema } from "./generated-contracts.js";
import { lawIdSchema } from "./law-contracts.js";
import type { InspectorCheckSession, SessionInspectorOutput } from "./inspector-check-session.js";

export type { SessionInspectorOutput };

export const inspectorFindingSchema = z
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

export type InspectorFinding = z.infer<typeof inspectorFindingSchema>;
export type ExecutedCheck = z.infer<typeof executedCheckSchema>;
export type InspectorOutput = {
  capabilityDomain: string;
  reportedLawIds: string[];
  executedChecks: ExecutedCheck[];
  findings: InspectorFinding[];
  inspectedFiles: string[];
  reportJson?: unknown;
  reportMarkdown?: string | undefined;
};
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
  checks: InspectorCheckSession;
};
