import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { InspectorContext, InspectorOutput } from "../shared/inspector-contracts.js";
import { createFinding, selectLawId } from "../shared/finding-utils.js";
import type { AuditPlanEntry } from "../shared/generated-contracts.js";
import { inspectorOutputSchema, type CompletedReport } from "../shared/inspector-contracts.js";
import { createAuditProject } from "../shared/project.js";
import { generatedDir, resolveFromRepo, toRepoPath } from "../shared/paths.js";
import { loadGeneratedAuditPlan } from "./load-audit-plan.js";

type DomainExecutionReport = CompletedReport & {
  capabilityDomain: string;
  executionGroup: AuditPlanEntry["executionGroup"];
};

const executionOrder = {
  foundation: 0,
  domain: 1,
  meta: 2,
} as const;

const sortPlanEntries = (entries: readonly AuditPlanEntry[]): AuditPlanEntry[] =>
  [...entries].sort((left, right) => {
    const groupDelta = executionOrder[left.executionGroup] - executionOrder[right.executionGroup];
    return groupDelta === 0 ? left.capabilityDomain.localeCompare(right.capabilityDomain) : groupDelta;
  });

const buildFailureOutput = (planEntry: AuditPlanEntry, message: string): InspectorOutput => ({
  capabilityDomain: planEntry.capabilityDomain,
  reportedLawIds: [selectLawId(planEntry.lawIds, planEntry.lawIds[0] ?? "")],
  findings: [
    createFinding({
      checkId: "runner/inspector-error",
      lawId: selectLawId(planEntry.lawIds, planEntry.lawIds[0] ?? ""),
      message,
    }),
  ],
  inspectedFiles: [planEntry.ownerInspectorPath],
});

const validateInspectorOutput = (planEntry: AuditPlanEntry, rawOutput: unknown): InspectorOutput => {
  const parsed = inspectorOutputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return buildFailureOutput(planEntry, parsed.error.message);
  }
  const output = parsed.data;
  const allowedLawIds = new Set(planEntry.lawIds);
  if (output.capabilityDomain !== planEntry.capabilityDomain) {
    return buildFailureOutput(planEntry, `Inspector reported capabilityDomain ${output.capabilityDomain}.`);
  }
  if (output.reportedLawIds.some((lawId) => !allowedLawIds.has(lawId))) {
    return buildFailureOutput(planEntry, `Inspector over-reported lawIds outside ${planEntry.capabilityDomain}.`);
  }
  if (output.findings.some((finding) => !allowedLawIds.has(finding.lawId))) {
    return buildFailureOutput(planEntry, `Inspector emitted finding outside generated plan lawIds.`);
  }
  return output;
};

const writeDomainReport = (
  planEntry: AuditPlanEntry,
  output: InspectorOutput,
  status: DomainExecutionReport["status"],
): string => {
  mkdirSync(generatedDir, { recursive: true });
  const reportAbsolutePath = resolve(generatedDir, `${planEntry.capabilityDomain}-report.generated.json`);
  writeFileSync(
    reportAbsolutePath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        capabilityDomain: planEntry.capabilityDomain,
        executionGroup: planEntry.executionGroup,
        lawIds: planEntry.lawIds,
        status,
        findings: output.findings,
        inspectedFiles: output.inspectedFiles,
      },
      null,
      2,
    )}\n`,
  );
  return toRepoPath(reportAbsolutePath);
};

const loadInspector = async (planEntry: AuditPlanEntry): Promise<(context: InspectorContext) => Promise<unknown>> => {
  const moduleUrl = pathToFileURL(resolveFromRepo(planEntry.ownerInspectorPath)).href;
  const moduleExports = (await import(moduleUrl)) as { inspectDomain?: (context: InspectorContext) => Promise<unknown> };
  if (typeof moduleExports.inspectDomain !== "function") {
    throw new Error(`Inspector ${planEntry.ownerInspectorPath} does not export inspectDomain.`);
  }
  return moduleExports.inspectDomain;
};

export const runGeneratedPlan = async (): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => {
  const project = createAuditProject();
  const generatedPlan = sortPlanEntries(loadGeneratedAuditPlan());
  const completedReports: Record<string, CompletedReport> = {};
  const domainReports: DomainExecutionReport[] = [];

  for (const planEntry of generatedPlan) {
    let output: InspectorOutput;
    try {
      const inspectDomain = await loadInspector(planEntry);
      output = validateInspectorOutput(
        planEntry,
        await inspectDomain({
          project,
          planEntry,
          generatedPlan,
          completedReports,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown inspector execution failure.";
      output = buildFailureOutput(planEntry, message);
    }

    const status = output.findings.length > 0 ? "FAIL" : "PASS";
    const reportPath = writeDomainReport(planEntry, output, status);
    const report: DomainExecutionReport = {
      capabilityDomain: planEntry.capabilityDomain,
      executionGroup: planEntry.executionGroup,
      status,
      findingCount: output.findings.length,
      reportPath,
    };
    completedReports[planEntry.capabilityDomain] = {
      status,
      findingCount: output.findings.length,
      reportPath,
    };
    domainReports.push(report);
  }

  return {
    domainReports,
    hasFailures: domainReports.some((report) => report.status === "FAIL"),
  };
};