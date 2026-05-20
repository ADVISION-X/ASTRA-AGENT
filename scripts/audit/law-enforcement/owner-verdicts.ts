import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";

import type { InspectorContext, InspectorResult, OwnerManifest } from "../core/schema.js";
import { pathFromRepoRoot } from "../core/paths.js";
import { runCodePurityInspector } from "../domains/code-purity/inspector.js";
import { runRuntimeLoggingInspector } from "../domains/runtime-logging/inspector.js";

export type DomainInspectorVerdict = {
  readonly capabilityDomain: string;
  readonly inspectorId: string;
  readonly status: "PASS" | "FAIL";
  readonly evidence: string;
  readonly findingLawIds: readonly string[];
  readonly failureReason?: string;
};

type BinaryClauseLike = {
  readonly clauseId: string;
  readonly status: "PASS" | "FAIL";
  readonly evidence: string;
  readonly failureReason?: string;
};

type BinaryLawLike = {
  readonly lawId: string;
  readonly status: "PASS" | "FAIL";
  readonly clauseResults: readonly BinaryClauseLike[];
};

type BinaryInspectorLike = {
  readonly status: "PASS" | "FAIL";
  readonly lawResults: readonly BinaryLawLike[];
  readonly summary: {
    readonly passedLaws: number;
    readonly totalLaws: number;
    readonly passedClauses: number;
    readonly totalClauses: number;
  };
};

const DOM_AUTOMATION_RESULT_PATH = pathFromRepoRoot("scripts/audit/generated/dom-automation-binary-result.generated.json");

const isLegacyInspectorResult = (value: unknown): value is InspectorResult =>
  typeof value === "object"
  && value !== null
  && "passed" in value
  && "findings" in value
  && Array.isArray((value as { findings?: unknown }).findings);

const isBinaryInspectorResult = (value: unknown): value is BinaryInspectorLike =>
  typeof value === "object"
  && value !== null
  && "status" in value
  && "lawResults" in value
  && Array.isArray((value as { lawResults?: unknown }).lawResults);

const toCodePurityVerdict = (manifest: OwnerManifest): DomainInspectorVerdict => {
  const result = runCodePurityInspector();
  const firstFinding = result.findings[0];
  return {
    capabilityDomain: manifest.capabilityDomain,
    inspectorId: manifest.inspectorId,
    status: result.pass ? "PASS" : "FAIL",
    evidence: result.pass
      ? "code-purity inspector passed with zero hard findings"
      : `code-purity hardFails=${result.hardFails}`,
    findingLawIds: result.pass ? [] : manifest.allowedLawIds,
    ...(firstFinding ? { failureReason: `${firstFinding.rule}: ${firstFinding.message}` } : {}),
  };
};

const toDomAutomationVerdict = (manifest: OwnerManifest): DomainInspectorVerdict => {
  if (!existsSync(DOM_AUTOMATION_RESULT_PATH)) {
    return {
      capabilityDomain: manifest.capabilityDomain,
      inspectorId: manifest.inspectorId,
      status: "FAIL",
      evidence: "dom-automation binary result is missing",
      findingLawIds: manifest.allowedLawIds,
      failureReason: "missing dom-automation-binary-result.generated.json",
    };
  }

  const result = JSON.parse(readFileSync(DOM_AUTOMATION_RESULT_PATH, "utf8")) as BinaryInspectorLike;
  return toBinaryVerdict(manifest, result);
};

const toRuntimeLoggingVerdict = (manifest: OwnerManifest): DomainInspectorVerdict => {
  const result = runRuntimeLoggingInspector();
  const firstFailure = result.checks.find((check) => check.status === "FAIL");
  return {
    capabilityDomain: manifest.capabilityDomain,
    inspectorId: manifest.inspectorId,
    status: result.pass ? "PASS" : "FAIL",
    evidence: result.pass
      ? `runtime-logging checks passed=${result.checks.length}`
      : `runtime-logging hardFails=${result.hardFails}`,
    findingLawIds: result.pass ? [] : manifest.allowedLawIds,
    ...(firstFailure ? { failureReason: `${firstFailure.checkId}: ${firstFailure.detail}` } : {}),
  };
};

const resolveInspector = async (
  manifest: OwnerManifest,
): Promise<(context: InspectorContext) => Promise<unknown>> => {
  const entryModule = await import(pathToFileURL(pathFromRepoRoot(manifest.entry)).href) as Record<string, unknown>;
  const exportName = manifest.exportName ?? Object.keys(entryModule).find((key) => key.startsWith("run"));
  const inspector = exportName ? entryModule[exportName] : undefined;
  if (typeof inspector !== "function") {
    throw new Error(`inspector export not found: ${manifest.entry}`);
  }
  return inspector as (context: InspectorContext) => Promise<unknown>;
};

const toLegacyVerdict = (manifest: OwnerManifest, result: InspectorResult): DomainInspectorVerdict => {
  const firstFinding = result.findings[0];
  return {
    capabilityDomain: manifest.capabilityDomain,
    inspectorId: manifest.inspectorId,
    status: result.passed ? "PASS" : "FAIL",
    evidence: result.passed
      ? `owner inspector passed: ${result.summary}`
      : `owner inspector failed: ${result.summary}`,
    findingLawIds: result.findings.map((finding) => finding.lawId),
    ...(firstFinding ? { failureReason: `${firstFinding.file}:${firstFinding.line} ${firstFinding.message}` } : {}),
  };
};

const toBinaryVerdict = (manifest: OwnerManifest, result: BinaryInspectorLike): DomainInspectorVerdict => {
  const failedLaw = result.lawResults.find((lawResult) => lawResult.status === "FAIL");
  const failedClause = failedLaw?.clauseResults.find((clause) => clause.status === "FAIL");
  return {
    capabilityDomain: manifest.capabilityDomain,
    inspectorId: manifest.inspectorId,
    status: result.status,
    evidence: result.status === "PASS"
      ? `owner inspector passed: laws=${result.summary.passedLaws}/${result.summary.totalLaws} clauses=${result.summary.passedClauses}/${result.summary.totalClauses}`
      : `owner inspector failed: laws=${result.summary.passedLaws}/${result.summary.totalLaws} clauses=${result.summary.passedClauses}/${result.summary.totalClauses}`,
    findingLawIds: result.lawResults.filter((lawResult) => lawResult.status === "FAIL").map((lawResult) => lawResult.lawId),
    ...(failedLaw && failedClause
      ? { failureReason: `${failedLaw.lawId}:${failedClause.clauseId} ${failedClause.failureReason ?? failedClause.evidence}` }
      : {}),
  };
};

const toInspectorExecutionFailureVerdict = (
  manifest: OwnerManifest,
  error: unknown,
): DomainInspectorVerdict => ({
  capabilityDomain: manifest.capabilityDomain,
  inspectorId: manifest.inspectorId,
  status: "FAIL",
  evidence: `owner inspector execution failed: ${manifest.entry}`,
  findingLawIds: manifest.allowedLawIds,
  failureReason: error instanceof Error ? error.message : String(error),
});

const runGenericOwnerInspector = async (
  manifest: OwnerManifest,
): Promise<DomainInspectorVerdict> => {
  const inspector = await resolveInspector(manifest);
  const result = await inspector({ repoRoot: process.cwd() });
  if (isLegacyInspectorResult(result)) {
    return toLegacyVerdict(manifest, result);
  }
  if (isBinaryInspectorResult(result)) {
    return toBinaryVerdict(manifest, result);
  }
  throw new Error(`unsupported owner inspector result shape: ${manifest.entry}`);
};

const loadOwnerInspectorVerdict = async (
  manifest: OwnerManifest,
): Promise<DomainInspectorVerdict> => {
  if (manifest.capabilityDomain === "code-purity") return toCodePurityVerdict(manifest);
  if (manifest.capabilityDomain === "dom-automation") return toDomAutomationVerdict(manifest);
  if (manifest.capabilityDomain === "runtime-logging") return toRuntimeLoggingVerdict(manifest);
  return runGenericOwnerInspector(manifest);
};

export const loadOwnerInspectorVerdicts = async (
  manifests: OwnerManifest[],
): Promise<Map<string, DomainInspectorVerdict>> => {
  const verdicts = new Map<string, DomainInspectorVerdict>();
  for (const manifest of manifests) {
    if (manifest.capabilityDomain === "audit-system") continue;
    process.stdout.write(`[CI-FULL][HEARTBEAT] owner=${manifest.capabilityDomain} status=running\n`);
    try {
      verdicts.set(manifest.capabilityDomain, await loadOwnerInspectorVerdict(manifest));
    } catch (error) {
      verdicts.set(manifest.capabilityDomain, toInspectorExecutionFailureVerdict(manifest, error));
    }
  }

  return verdicts;
};
