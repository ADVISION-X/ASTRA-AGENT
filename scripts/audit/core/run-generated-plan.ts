import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { InspectorContext, InspectorOutput } from "../shared/inspector-contracts.js";
import {
  createInspectorCheckSession,
  sessionInspectorOutputSchema,
  type InspectorCheckSessionController,
  type ParsedSessionInspectorOutput,
} from "../shared/inspector-check-session.js";
import { createFinding, selectLawId } from "../shared/finding-utils.js";
import type { AuditPlanEntry } from "../shared/generated-contracts.js";
import type { CompletedReport } from "../shared/inspector-contracts.js";
import { createAuditProject } from "../shared/project.js";
import { generatedDir, resolveFromRepo, toRepoPath } from "../shared/paths.js";
import { loadGeneratedAuditPlan } from "./load-audit-plan.js";
import { writeClauseCoverageArtifact } from "../build/write-generated-artifacts.js";
import type { LawSource } from "../shared/law-contracts.js";
import type { StaticClauseCoverageEntry } from "../shared/generated-contracts.js";
import { evidenceModeIncludesRealChrome } from "../shared/law-contracts.js";

type DomainExecutionReport = CompletedReport & {
  capabilityDomain: string;
  executionGroup: AuditPlanEntry["executionGroup"];
};

type AuditOwnerOutput = InspectorOutput | ParsedSessionInspectorOutput;

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
  const expectedChecks = planEntry.bindings
    .filter((binding) => !evidenceModeIncludesRealChrome(binding.evidenceMode))
    .flatMap((binding) =>
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
  const expectedBindingKeys = new Set(planEntry.bindings.map((binding) => `${binding.lawId}::${binding.clauseId}`));
  const invalidFinding = output.findings.find((finding) =>
    !expectedBindingKeys.has(`${finding.lawId}::${finding.clauseId}`));
  if (invalidFinding) {
    errors.push(`Inspector diagnostic ${invalidFinding.lawId}/${invalidFinding.clauseId}/${invalidFinding.checkId} is outside its manifest law/clause authority.`);
  }
  return errors[0] ?? null;
};

const findReceiptIdentityError = (
  planEntry: AuditPlanEntry,
  output: ParsedSessionInspectorOutput,
  expectedRunId: string,
): string | null => {
  const expectedCheckIds = new Set(planEntry.bindings.flatMap((binding) => binding.checkIds));
  const checkRunIds = output.checkRuns.map((receipt) => receipt.checkRunId);
  if (new Set(checkRunIds).size !== checkRunIds.length) {
    return "Inspector reported duplicate physical check-run receipt identities.";
  }
  const checkIds = output.checkRuns.map((receipt) => receipt.checkId);
  if (new Set(checkIds).size !== checkIds.length) {
    return "Inspector reported duplicate physical check executions.";
  }
  const missingCheckId = [...expectedCheckIds].find((checkId) => !checkIds.includes(checkId));
  if (missingCheckId) return `Inspector omitted physical check ${missingCheckId}.`;
  const extraCheckId = checkIds.find((checkId) => !expectedCheckIds.has(checkId));
  if (extraCheckId) return `Inspector executed undeclared physical check ${extraCheckId}.`;
  const invalidRunId = output.checkRuns.find((receipt) => receipt.runId !== expectedRunId);
  return invalidRunId ? "Inspector reported a physical check receipt outside the current generated-plan run." : null;
};

const findReceiptResultError = (planEntry: AuditPlanEntry, output: ParsedSessionInspectorOutput): string | null => {
  if (output.checkRuns.length !== 1) {
    return `${planEntry.capabilityDomain} must report exactly one owner assertion-set receipt.`;
  }
  for (const receipt of output.checkRuns) {
    if (receipt.capabilityDomain !== planEntry.capabilityDomain) {
      return `Physical check ${receipt.checkId} reported the wrong capabilityDomain.`;
    }
    const findingCount = output.findings.length;
    if (receipt.findingCount !== findingCount) {
      return `Physical check ${receipt.checkId} finding count does not match its signed receipt.`;
    }
    if (receipt.status !== (findingCount === 0 ? "PASS" : "FAIL")) {
      return `Physical check ${receipt.checkId} status does not match its findings.`;
    }
  }
  return null;
};

const findSessionOutputError = (
  planEntry: AuditPlanEntry,
  output: ParsedSessionInspectorOutput,
  expectedRunId: string,
): string | null => {
  const baseError = findInspectorOutputError(planEntry, output);
  if (baseError) return baseError;
  const identityError = findReceiptIdentityError(planEntry, output, expectedRunId);
  if (identityError) return identityError;
  const resultError = findReceiptResultError(planEntry, output);
  if (resultError) return resultError;
  const receiptByCheckId = new Map(output.checkRuns.map((receipt) => [receipt.checkId, receipt]));
  const mismatchedMapping = output.executedChecks.find((mapping) =>
    receiptByCheckId.get(mapping.checkId)?.checkRunId !== mapping.checkRunId);
  return mismatchedMapping
    ? `Executed-check mapping ${mismatchedMapping.checkId} does not reference its physical check receipt.`
    : null;
};

const validateSessionInspectorOutput = (
  planEntry: AuditPlanEntry,
  controller: InspectorCheckSessionController,
  expectedRunId: string,
  rawOutput: unknown,
): AuditOwnerOutput => {
  if (!controller.isAuthenticOutput(rawOutput)) {
    return buildFailureOutput(planEntry, "Inspector output was not signed by the current runner check session.");
  }
  const parsed = sessionInspectorOutputSchema.safeParse(rawOutput);
  if (!parsed.success) return buildFailureOutput(planEntry, parsed.error.message);
  const validationError = findSessionOutputError(planEntry, parsed.data, expectedRunId);
  return validationError ? buildFailureOutput(planEntry, validationError) : parsed.data;
};

const writeDomainReport = (
  planEntry: AuditPlanEntry,
  output: AuditOwnerOutput,
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
    ...( "checkRuns" in output ? { checkRuns: output.checkRuns } : {}),
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
  runId: string,
): Promise<AuditOwnerOutput> => {
  try {
    const inspectDomain = await loadInspector(planEntry);
    const controller = createInspectorCheckSession(planEntry, runId);
    const rawOutput = await inspectDomain({
        project,
        planEntry,
        generatedPlan,
        completedReports,
        checks: controller.checks,
      });
    return validateSessionInspectorOutput(planEntry, controller, runId, rawOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown inspector execution failure.";
    return buildFailureOutput(planEntry, message);
  }
};

const buildDomainExecutionReport = (
  planEntry: AuditPlanEntry,
  output: AuditOwnerOutput,
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

const runGeneratedPlanInternal = async (): Promise<{
  domainReports: DomainExecutionReport[];
  executedChecks: InspectorOutput["executedChecks"];
  hasFailures: boolean;
}> => {
  const project = createAuditProject();
  const runId = `audit-run:${randomUUID()}`;
  const generatedPlan = sortPlanEntries(loadGeneratedAuditPlan());
  const completedReports: Record<string, CompletedReport> = {};
  const domainReports: DomainExecutionReport[] = [];
  const executedChecks: InspectorOutput["executedChecks"] = [];

  for (const planEntry of generatedPlan) {
    const output = await executePlanEntry(project, planEntry, generatedPlan, completedReports, runId);
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

export const runGeneratedPlan = async (): Promise<{
  domainReports: DomainExecutionReport[];
  hasFailures: boolean;
}> => {
  const result = await runGeneratedPlanInternal();
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
