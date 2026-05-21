import { existsSync, readFileSync, statSync } from "node:fs";

import { Node, SyntaxKind } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const requiredArtifacts = [
  "scripts/audit/generated/law-registry.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.json",
  "scripts/audit/generated/enforcement-matrix.generated.yaml",
  "scripts/audit/generated/audit-plan.generated.json",
  "scripts/audit/generated/audit-conflicts.generated.json",
  "scripts/audit/generated/static-clause-coverage.generated.json",
] as const;

const runnerFiles = ["scripts/audit/ci-full.ts", "scripts/audit/core/run-generated-plan.ts"] as const;

const fileHasContent = (repoPath: string): boolean => {
  const absolutePath = resolveFromRepo(repoPath);
  return existsSync(absolutePath) && statSync(absolutePath).size > 2;
};

const normalizeAnchor = (value: string): string => value.replace(/^#+\s*/u, "").replace(/\s+/gu, " ").trim();

const extractMarkdownHeadings = (text: string): ReadonlySet<string> =>
  new Set(
    [...text.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((match) => normalizeAnchor(match[0] ?? match[1] ?? "")),
  );

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const chainLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-001-V1");
  const manifestLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-003-V1");
  const artifactLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-004-V1");
  const runnerLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-005-V1");
  const blueprintLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-007-V1");
  const metaLawId = selectLawId(context.planEntry.lawIds, "APEX-AUDIT-008-V1");
  const findings = [];
  const inspectedFiles = new Set<string>();

  for (const artifactPath of requiredArtifacts) {
    inspectedFiles.add(artifactPath);
    if (!fileHasContent(artifactPath)) {
      findings.push(
        createFinding({
          checkId: "audit-system/generated-artifact",
          lawId: artifactLawId,
          filePath: artifactPath,
          message: `${artifactPath} is missing or empty.`,
        }),
      );
    }
  }

  const uniqueDomains = new Set<string>();
  const uniqueInspectors = new Set<string>();
  for (const entry of context.generatedPlan) {
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

  for (const blueprintRef of context.planEntry.blueprintRefs) {
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

  const codePurityReport = context.completedReports["code-purity"];
  if (!codePurityReport || !fileHasContent(codePurityReport.reportPath)) {
    findings.push(
      createFinding({
        checkId: "audit-system/code-purity-report",
        lawId: metaLawId,
        filePath: codePurityReport?.reportPath,
        message: "CI-FULL did not produce a code-purity report before audit-system execution.",
      }),
    );
  }

  const knownDomains = new Set(context.generatedPlan.map((entry) => entry.capabilityDomain));
  for (const runnerFile of runnerFiles) {
    inspectedFiles.add(runnerFile);
    const sourceFile = context.project.getSourceFile(resolveFromRepo(runnerFile));
    if (!sourceFile) {
      findings.push(
        createFinding({
          checkId: "audit-system/runner-source",
          lawId: chainLawId,
          filePath: runnerFile,
          message: `${runnerFile} is missing from the ts-morph project.`,
        }),
      );
      continue;
    }

    const hardcodedLawLiteral = sourceFile
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .find((literal) => literal.getLiteralValue().startsWith("APEX-"));
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

    const hardcodedDomainArray = sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression).find((arrayLiteral) => {
      const elements = arrayLiteral.getElements();
      return (
        elements.length > 1 &&
        elements.every((element) => Node.isStringLiteral(element) && knownDomains.has(element.getLiteralValue()))
      );
    });
    if (hardcodedDomainArray) {
      findings.push(
        createFinding({
          checkId: "audit-system/runner-order-truth",
          lawId: runnerLawId,
          filePath: runnerFile,
          message: `${runnerFile} contains a hard-coded owner ordering array ${hardcodedDomainArray.getText()}.`,
        }),
      );
    }
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};