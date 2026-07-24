import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { InspectorContext, InspectorOutput } from "../shared/inspector-contracts.js";
import { createFinding, selectLawId } from "../shared/finding-utils.js";
import type { AuditPlanEntry } from "../shared/generated-contracts.js";
import { inspectorOutputSchema, type CompletedReport } from "../shared/inspector-contracts.js";
import { createAuditProject } from "../shared/project.js";
import { generatedDir, resolveFromRepo, toRepoPath } from "../shared/paths.js";
import { loadGeneratedAuditPlan } from "./load-audit-plan.js";
import { writeClauseCoverageArtifact } from "../build/write-generated-artifacts.js";
import type { LawSource } from "../shared/law-contracts.js";
import type { StaticClauseCoverageEntry } from "../shared/generated-contracts.js";

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
  executedChecks: [],
  findings: [
    createFinding({
      checkId: "runner/inspector-error",
      lawId: selectLawId(planEntry.lawIds, planEntry.lawIds[0] ?? ""),
      message,
    }),
  ],
  inspectedFiles: [planEntry.ownerInspectorPath],
});

const executedCheckKey = (input: { lawId: string; clauseId: string; checkId: string }): string =>
  `${input.lawId}::${input.clauseId}::${input.checkId}`;

const findInspectorOutputError = (planEntry: AuditPlanEntry, output: InspectorOutput): string | null => {
  const errors: string[] = [];
  const allowedLawIds = new Set(planEntry.lawIds);
  if (output.capabilityDomain !== planEntry.capabilityDomain) {
    errors.push(`Inspector reported capabilityDomain ${output.capabilityDomain}.`);
  }
  if (output.reportedLawIds.some((lawId) => !allowedLawIds.has(lawId))) {
    errors.push(`Inspector over-reported lawIds outside ${planEntry.capabilityDomain}.`);
  }
  if (output.findings.some((finding) => !allowedLawIds.has(finding.lawId))) {
    errors.push("Inspector emitted finding outside generated plan lawIds.");
  }
  const expectedChecks = planEntry.bindings.flatMap((binding) =>
    binding.checkIds.map((checkId) => ({ lawId: binding.lawId, clauseId: binding.clauseId, checkId })));
  const expectedKeys = new Set(expectedChecks.map(executedCheckKey));
  const executedKeys = output.executedChecks.map(executedCheckKey);
  const uniqueExecutedKeys = new Set(executedKeys);
  if (uniqueExecutedKeys.size !== executedKeys.length) {
    errors.push("Inspector reported duplicate executed check receipts.");
  }
  const missingCheck = expectedChecks.find((check) => !uniqueExecutedKeys.has(executedCheckKey(check)));
  if (missingCheck) {
    errors.push(`Inspector omitted executed check ${missingCheck.lawId}/${missingCheck.clauseId}/${missingCheck.checkId}.`);
  }
  const extraCheck = output.executedChecks.find((check) => !expectedKeys.has(executedCheckKey(check)));
  if (extraCheck) {
    errors.push(`Inspector reported undeclared executed check ${extraCheck.lawId}/${extraCheck.clauseId}/${extraCheck.checkId}.`);
  }
  const invalidFinding = output.findings.find((finding) => !expectedKeys.has(executedCheckKey(finding)));
  if (invalidFinding) {
    errors.push(`Inspector finding ${invalidFinding.lawId}/${invalidFinding.clauseId}/${invalidFinding.checkId} is not declared by its manifest.`);
  }
  return errors[0] ?? null;
};

export const validateInspectorOutput = (planEntry: AuditPlanEntry, rawOutput: unknown): InspectorOutput => {
  const parsed = inspectorOutputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return buildFailureOutput(planEntry, parsed.error.message);
  }
  const output = parsed.data;
  const validationError = findInspectorOutputError(planEntry, output);
  return validationError ? buildFailureOutput(planEntry, validationError) : output;
};

const writeDomainReport = (
  planEntry: AuditPlanEntry,
  output: InspectorOutput,
  status: DomainExecutionReport["status"],
): string => {
  mkdirSync(generatedDir, { recursive: true });
  const reportAbsolutePath = resolve(generatedDir, `${planEntry.capabilityDomain}-report.generated.json`);
  const reportMarkdownPath = resolve(generatedDir, `${planEntry.capabilityDomain}-report.generated.md`);
  const baseReportJson = {
    generatedAt: new Date().toISOString(),
    capabilityDomain: planEntry.capabilityDomain,
    executionGroup: planEntry.executionGroup,
    lawIds: planEntry.lawIds,
    status,
    findings: output.findings,
    executedChecks: output.executedChecks,
    inspectedFiles: output.inspectedFiles,
  };
  const mergedReportJson = typeof output.reportJson === "object" && output.reportJson !== null && !Array.isArray(output.reportJson)
    ? {
        ...output.reportJson,
        ...baseReportJson,
      }
    : baseReportJson;
  writeFileSync(
    reportAbsolutePath,
    `${JSON.stringify(mergedReportJson, null, 2)}\n`,
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
  executedChecks: InspectorOutput["executedChecks"];
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
  const executedChecks: InspectorOutput["executedChecks"] = [];

  for (const planEntry of generatedPlan) {
    const output = await executePlanEntry(project, planEntry, fullGeneratedPlan, completedReports);
    const report = buildDomainExecutionReport(planEntry, output);
    executedChecks.push(...output.executedChecks);
    completedReports[planEntry.capabilityDomain] = {
      status: report.status,
      findingCount: report.findingCount,
      reportPath: report.reportPath,
    };
    domainReports.push(report);
  }

  return {
    domainReports,
    executedChecks,
    hasFailures: domainReports.some((report) => report.status === "FAIL"),
  };
};

export const runGeneratedPlanFiltered = async (options: RunGeneratedPlanOptions): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => {
  const result = await runGeneratedPlanInternal(options);
  return {
    domainReports: result.domainReports,
    hasFailures: result.hasFailures,
  };
};

export const runGeneratedPlan = async (): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => {
  const result = await runGeneratedPlanInternal({});
  const registry = JSON.parse(
    readFileSync(resolveFromRepo("scripts/audit/generated/law-registry.generated.json"), "utf8"),
  ) as { laws: LawSource[] };
  const staticCoverageArtifact = JSON.parse(
    readFileSync(resolveFromRepo("scripts/audit/generated/static-clause-coverage.generated.json"), "utf8"),
  ) as { coverage: StaticClauseCoverageEntry[] };
  writeClauseCoverageArtifact({
    laws: registry.laws,
    staticCoverage: staticCoverageArtifact.coverage,
    executedChecks: result.executedChecks,
  });
  return {
    domainReports: result.domainReports,
    hasFailures: result.hasFailures,
  };
};
