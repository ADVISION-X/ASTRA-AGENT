import { existsSync, readFileSync, statSync } from "node:fs";

import { Node, SyntaxKind } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { pushStaleCodePurityTextReportFindings } from "./stale-code-purity-text-report.js";

const requiredArtifacts = [
  "scripts/audit/generated/law-registry.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.yaml",
  "scripts/audit/generated/audit-plan.generated.json",
  "scripts/audit/generated/audit-conflicts.generated.json",
  "scripts/audit/generated/static-clause-coverage.generated.json",
] as const;

const runnerFiles = ["scripts/audit/ci-full.ts", "scripts/audit/core/run-generated-plan.ts"] as const;
const staticCoveragePath = "scripts/audit/generated/static-clause-coverage.generated.json";
const packageJsonPath = "package.json";

type StaticCoverageSummary = { activeLawCount?: number; coveredLawCount?: number; coveragePercent?: number };

const fileHasContent = (repoPath: string): boolean => {
  const absolutePath = resolveFromRepo(repoPath);
  return existsSync(absolutePath) && statSync(absolutePath).size > 2;
};

const normalizeAnchor = (value: string): string => value.replace(/^#+\s*/u, "").replace(/\s+/gu, " ").trim();

const extractMarkdownHeadings = (text: string): ReadonlySet<string> =>
  new Set(
    [...text.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((match) => normalizeAnchor(match[0] ?? match[1] ?? "")),
  );

const pushRequiredArtifactFindings = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  artifactLawId: string,
): void => {
  for (const artifactPath of requiredArtifacts) {
    inspectedFiles.add(artifactPath);
    if (fileHasContent(artifactPath)) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "audit-system/generated-artifact",
        lawId: artifactLawId,
        filePath: artifactPath,
        message: `${artifactPath} is missing or empty.`,
      }),
    );
  }
};

const pushGeneratedPlanUniquenessFindings = (
  findings: ReturnType<typeof createFinding>[],
  manifestLawId: string,
  generatedPlan: readonly InspectorContext["generatedPlan"][number][],
): void => {
  const uniqueDomains = new Set<string>();
  const uniqueInspectors = new Set<string>();
  for (const entry of generatedPlan) {
    if (uniqueDomains.has(entry.capabilityDomain)) {
      findings.push(
        createFinding({
          checkId: "audit-system/duplicate-domain-plan",
          lawId: manifestLawId,
          filePath: entry.manifestPath,
          message: `Generated plan duplicates capabilityDomain ${entry.capabilityDomain}.`,
        }),
      );
    }
    uniqueDomains.add(entry.capabilityDomain);
    if (uniqueInspectors.has(entry.ownerInspectorPath)) {
      findings.push(
        createFinding({
          checkId: "audit-system/duplicate-inspector-plan",
          lawId: manifestLawId,
          filePath: entry.ownerInspectorPath,
          message: `Generated plan reuses owner inspector ${entry.ownerInspectorPath}.`,
        }),
      );
    }
    uniqueInspectors.add(entry.ownerInspectorPath);
  }
};

const pushBlueprintAnchorFindings = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  blueprintLawId: string,
  blueprintRefs: ReadonlyArray<NonNullable<InspectorContext["planEntry"]["blueprintRefs"]>[number]>,
): void => {
  for (const blueprintRef of blueprintRefs) {
    inspectedFiles.add(blueprintRef.filePath);
    const blueprintText = readFileSync(resolveFromRepo(blueprintRef.filePath), "utf8");
    const headings = extractMarkdownHeadings(blueprintText);
    for (const anchor of blueprintRef.requiredAnchors) {
      if (headings.has(normalizeAnchor(anchor))) {
        continue;
      }
      findings.push(
        createFinding({
          checkId: "audit-system/blueprint-anchor",
          lawId: blueprintLawId,
          filePath: blueprintRef.filePath,
          message: `${blueprintRef.filePath} is missing required anchor ${anchor}.`,
        }),
      );
    }
  }
};

const pushCodePurityPrerequisiteFinding = (
  findings: ReturnType<typeof createFinding>[],
  metaLawId: string,
  completedReports: InspectorContext["completedReports"],
): void => {
  const codePurityReport = completedReports["code-purity"];
  if (codePurityReport && fileHasContent(codePurityReport.reportPath)) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "audit-system/code-purity-report",
      lawId: metaLawId,
      filePath: codePurityReport?.reportPath,
      message: "CI-FULL did not produce a code-purity report before audit-system execution.",
    }),
  );
};

const readStaticCoverageSummary = (): StaticCoverageSummary => {
  const parsed = JSON.parse(readFileSync(resolveFromRepo(staticCoveragePath), "utf8")) as {
    summary?: StaticCoverageSummary;
  };
  const summary = parsed.summary;
  if (!summary) {
    throw new Error("missing summary");
  }
  return summary;
};

const pushStaticCoverageFindings = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  metaLawId: string,
): void => {
  inspectedFiles.add(staticCoveragePath);
  try {
    const summary = readStaticCoverageSummary();
    if (summary.coveragePercent !== 100 || summary.activeLawCount !== summary.coveredLawCount) {
      findings.push(
        createFinding({
          checkId: "audit-system/static-clause-coverage",
          lawId: metaLawId,
          filePath: staticCoveragePath,
          message: `${staticCoveragePath} must report 100% static clause coverage for active laws.`,
          evidence: JSON.stringify(summary),
        }),
      );
    }
  } catch (error) {
    findings.push(
      createFinding({
        checkId: "audit-system/static-clause-coverage",
        lawId: metaLawId,
        filePath: staticCoveragePath,
        message: `${staticCoveragePath} could not be parsed for coverage validation.`,
        evidence: error instanceof Error ? error.message : String(error),
      }),
    );
  }
};

const pushCiFullEntryGateFindings = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  chainLawId: string,
  context: InspectorContext,
): void => {
  inspectedFiles.add(packageJsonPath);
  const ciFullSource = context.project.getSourceFile(resolveFromRepo("scripts/audit/ci-full.ts"));
  if (ciFullSource) {
    inspectedFiles.add("scripts/audit/ci-full.ts");
  }
  try {
    const parsed = JSON.parse(readFileSync(resolveFromRepo(packageJsonPath), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const ciFullScript = parsed.scripts?.["ci:full"];
    const hasCiFullRunner = ciFullScript === "node --import tsx scripts/audit/ci-full.ts";
    const hasInternalEntryGate = Boolean(
      ciFullSource?.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) =>
        literal.getLiteralValue() === "codex-entry-gate" || literal.getLiteralValue() === "codex:entry-gate"
      ),
    );
    if (!hasCiFullRunner || !hasInternalEntryGate) {
      findings.push(
        createFinding({
          checkId: "audit-system/ci-full-entry-gate",
          lawId: chainLawId,
          filePath: packageJsonPath,
          message: "package.json must route ci:full through the ci-full runner, and ci-full must execute codex-entry-gate as its first fail-fast phase.",
          evidence: ciFullScript,
        }),
      );
    }
  } catch (error) {
    findings.push(
      createFinding({
        checkId: "audit-system/ci-full-entry-gate",
        lawId: chainLawId,
        filePath: packageJsonPath,
        message: "package.json could not be parsed for ci:full entry-gate validation.",
        evidence: error instanceof Error ? error.message : String(error),
      }),
    );
  }
};

const findHardcodedLawLiteral = (sourceFile: NonNullable<ReturnType<InspectorContext["project"]["getSourceFile"]>>) =>
  sourceFile
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .find((literal) => literal.getLiteralValue().startsWith("APEX-"));

const findHardcodedDomainArray = (
  sourceFile: NonNullable<ReturnType<InspectorContext["project"]["getSourceFile"]>>,
  knownDomains: ReadonlySet<string>,
) =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression).find((arrayLiteral) => {
    const elements = arrayLiteral.getElements();
    return elements.length > 1 && elements.every((element) => Node.isStringLiteral(element) && knownDomains.has(element.getLiteralValue()));
  });

const pushMissingRunnerSourceFinding = (
  findings: ReturnType<typeof createFinding>[],
  chainLawId: string,
  runnerFile: string,
): void => {
  findings.push(
    createFinding({
      checkId: "audit-system/runner-source",
      lawId: chainLawId,
      filePath: runnerFile,
      message: `${runnerFile} is missing from the ts-morph project.`,
    }),
  );
};

const pushRunnerPolicyFindings = (
  findings: ReturnType<typeof createFinding>[],
  runnerLawId: string,
  runnerFile: string,
  sourceFile: NonNullable<ReturnType<InspectorContext["project"]["getSourceFile"]>>,
  knownDomains: ReadonlySet<string>,
): void => {
  const hardcodedLawLiteral = findHardcodedLawLiteral(sourceFile);
  if (hardcodedLawLiteral) {
    findings.push(
      createFinding({
        checkId: "audit-system/runner-law-truth",
        lawId: runnerLawId,
        filePath: runnerFile,
        message: `${runnerFile} hard-codes law literal ${hardcodedLawLiteral.getLiteralValue()}.`,
      }),
    );
  }
  const hardcodedDomainArray = findHardcodedDomainArray(sourceFile, knownDomains);
  if (!hardcodedDomainArray) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "audit-system/runner-order-truth",
      lawId: runnerLawId,
      filePath: runnerFile,
      message: `${runnerFile} contains a hard-coded owner ordering array ${hardcodedDomainArray.getText()}.`,
    }),
  );
};

const pushRunnerTruthFindings = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  chainLawId: string,
  runnerLawId: string,
  context: InspectorContext,
): void => {
  const knownDomains = new Set(context.generatedPlan.map((entry) => entry.capabilityDomain));
  for (const runnerFile of runnerFiles) {
    inspectedFiles.add(runnerFile);
    const sourceFile = context.project.getSourceFile(resolveFromRepo(runnerFile));
    if (!sourceFile) {
      pushMissingRunnerSourceFinding(findings, chainLawId, runnerFile);
      continue;
    }
    pushRunnerPolicyFindings(findings, runnerLawId, runnerFile, sourceFile, knownDomains);
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const chainLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-001-V1");
  const manifestLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-003-V1");
  const artifactLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-004-V1");
  const runnerLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-005-V1");
  const blueprintLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-007-V1");
  const metaLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-008-V1");
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  pushRequiredArtifactFindings(findings, inspectedFiles, artifactLawId);
  pushGeneratedPlanUniquenessFindings(findings, manifestLawId, context.generatedPlan);
  pushBlueprintAnchorFindings(findings, inspectedFiles, blueprintLawId, context.planEntry.blueprintRefs ?? []);
  pushCodePurityPrerequisiteFinding(findings, metaLawId, context.completedReports);
  pushStaleCodePurityTextReportFindings(findings, inspectedFiles, chainLawId);
  pushStaticCoverageFindings(findings, inspectedFiles, metaLawId);
  pushCiFullEntryGateFindings(findings, inspectedFiles, chainLawId, context);
  pushRunnerTruthFindings(findings, inspectedFiles, chainLawId, runnerLawId, context);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
