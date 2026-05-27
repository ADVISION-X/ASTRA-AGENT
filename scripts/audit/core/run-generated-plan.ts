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

type RunGeneratedPlanOptions = {
  capabilityDomains?: readonly string[];
  excludeCapabilityDomains?: readonly string[];
  executionGroups?: readonly AuditPlanEntry["executionGroup"][];
  initialCompletedReports?: Record<string, CompletedReport>;
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
  const reportMarkdownPath = resolve(generatedDir, `${planEntry.capabilityDomain}-report.generated.md`);
  writeFileSync(
    reportAbsolutePath,
    `${JSON.stringify(
      output.reportJson ?? {
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
  if (output.reportMarkdown) {
    writeFileSync(reportMarkdownPath, `${output.reportMarkdown.trimEnd()}\n`);
  }
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

const executePlanEntry = async (
  project: InspectorContext["project"],
  planEntry: AuditPlanEntry,
  generatedPlan: readonly AuditPlanEntry[],
  completedReports: Record<string, CompletedReport>,
): Promise<InspectorOutput> => {
  try {
    const inspectDomain = await loadInspector(planEntry);
    return validateInspectorOutput(
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
    return buildFailureOutput(planEntry, message);
  }
};

const buildDomainExecutionReport = (
  planEntry: AuditPlanEntry,
  output: InspectorOutput,
): DomainExecutionReport => {
  const status = output.findings.length > 0 ? "FAIL" : "PASS";
  return {
    capabilityDomain: planEntry.capabilityDomain,
    executionGroup: planEntry.executionGroup,
    status,
    findingCount: output.findings.length,
    reportPath: writeDomainReport(planEntry, output, status),
  };
};

const runGeneratedPlanInternal = async (options: RunGeneratedPlanOptions): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => {
  const project = createAuditProject();
  const fullGeneratedPlan = sortPlanEntries(loadGeneratedAuditPlan());
  const allowedGroups = options.executionGroups ? new Set(options.executionGroups) : null;
  const allowedDomains = options.capabilityDomains ? new Set(options.capabilityDomains) : null;
  const excludedDomains = options.excludeCapabilityDomains ? new Set(options.excludeCapabilityDomains) : null;
  const generatedPlan = fullGeneratedPlan.filter((entry) => {
    if (allowedGroups && !allowedGroups.has(entry.executionGroup)) {
      return false;
    }
    if (allowedDomains && !allowedDomains.has(entry.capabilityDomain)) {
      return false;
    }
    if (excludedDomains && excludedDomains.has(entry.capabilityDomain)) {
      return false;
    }
    return true;
  });
  const completedReports: Record<string, CompletedReport> = {
    ...(options.initialCompletedReports ?? {}),
  };
  const domainReports: DomainExecutionReport[] = [];

  for (const planEntry of generatedPlan) {
    const output = await executePlanEntry(project, planEntry, fullGeneratedPlan, completedReports);
    const report = buildDomainExecutionReport(planEntry, output);
    completedReports[planEntry.capabilityDomain] = {
      status: report.status,
      findingCount: report.findingCount,
      reportPath: report.reportPath,
    };
    domainReports.push(report);
  }

  return {
    domainReports,
    hasFailures: domainReports.some((report) => report.status === "FAIL"),
  };
};

export const runGeneratedPlanFiltered = async (options: RunGeneratedPlanOptions): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => runGeneratedPlanInternal(options);