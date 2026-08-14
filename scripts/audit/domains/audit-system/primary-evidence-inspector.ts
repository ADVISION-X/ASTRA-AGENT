import { Node, SyntaxKind } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { discoverLawFiles } from "../../build/discover-law-files.js";
import { parseApexLaws } from "../../build/parse-apex-laws.js";
import { sourceEvidenceIsReachable } from "../../build/source-evidence-reachability.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { ManifestSource } from "../../shared/manifest-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const toManifestSource = (entry: InspectorContext["generatedPlan"][number]): ManifestSource => ({
  capabilityDomain: entry.capabilityDomain,
  ownerInspectorPath: entry.ownerInspectorPath,
  executionGroup: entry.executionGroup,
  coverage: {
    mode: "explicit",
    bindings: entry.bindings.map(({ evidenceMode: _evidenceMode, ...binding }) => binding),
  },
  blueprintRefs: entry.blueprintRefs,
  manifestPath: entry.manifestPath,
});

const ownerUsesProjectAst = (
  context: InspectorContext,
  ownerInspectorPath: string,
): boolean => {
  const sourceFile = context.project.getSourceFile(resolveFromRepo(ownerInspectorPath));
  if (!sourceFile) return false;
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
    access.getName() === "project"
    && Node.isIdentifier(access.getExpression())
    && (access.getExpression().getSymbol()?.getDeclarations().some((declaration) =>
      Node.isParameterDeclaration(declaration) && declaration.getName() === "context") ?? false));
};

export const inspectPrimaryEvidenceContract = (
  context: InspectorContext,
  lawId: string,
  inspectedFiles: Set<string>,
): ReturnType<typeof createFinding>[] => {
  const lawFiles = discoverLawFiles();
  lawFiles.forEach((filePath) => inspectedFiles.add(filePath));
  const parsed = parseApexLaws(lawFiles);
  const activeLaws = new Map(parsed.laws
    .filter((law) => law.status === "active")
    .map((law) => [law.lawId, law]));
  const findings: ReturnType<typeof createFinding>[] = [];

  for (const entry of context.generatedPlan) {
    inspectedFiles.add(entry.ownerInspectorPath);
    inspectedFiles.add(entry.manifestPath);
    const manifest = toManifestSource(entry);
    for (const binding of entry.bindings) {
      const activeLaw = activeLaws.get(binding.lawId);
      if (!activeLaw || activeLaw.evidenceMode !== "hybrid") continue;
      const primaryEvidence = binding.primaryEvidence;
      if (!primaryEvidence) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: entry.manifestPath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} has no declared primary evidence path.`,
        }));
        continue;
      }
      const sourceEvidence = binding.sourceEvidence[primaryEvidence.sourceEvidenceIndex];
      if (!sourceEvidence) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: entry.manifestPath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} points to missing sourceEvidence index ${primaryEvidence.sourceEvidenceIndex}.`,
        }));
        continue;
      }
      inspectedFiles.add(sourceEvidence.filePath);
      if (!sourceEvidenceIsReachable(
        context.project,
        manifest,
        sourceEvidence.filePath,
        sourceEvidence.symbolName,
      )) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: sourceEvidence.filePath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} primary evidence is not on the signed owner verdict path.`,
        }));
        continue;
      }
      if (primaryEvidence.engine === "ast" && !ownerUsesProjectAst(context, entry.ownerInspectorPath)) {
        findings.push(createFinding({
          checkId: "audit-system/primary-evidence",
          lawId,
          filePath: entry.ownerInspectorPath,
          message: `Hybrid clause ${binding.lawId}/${binding.clauseId} declares AST primary evidence but its owner does not consume context.project.`,
        }));
      }
    }
  }
  return findings;
};
