import { Node } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const domRoot = "src/capabilities/dom-automation/";
const domPublicFacade = "src/capabilities/dom-automation/index.ts";
const plannerNames = new Set(["nextAction", "actionPlan"]);

const findPlannerToken = (sourceFile: Parameters<typeof getRepoSourcePath>[0]): string | undefined => {
  const plannerNode = sourceFile.getDescendants().find((node) => {
    if (Node.isIdentifier(node)) {
      return plannerNames.has(node.getText());
    }
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return plannerNames.has(node.getLiteralValue());
    }
    return false;
  });
  return plannerNode?.getText();
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-DOM-001-V1");
  const findings = [];
  const inspectedFiles = new Set<string>();

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith(domRoot)) {
        continue;
      }

      if (!repoPath.startsWith(domRoot) && targetPath !== domPublicFacade) {
        findings.push(
          createFinding({
            checkId: "dom/public-facade-only",
            lawId,
            filePath: repoPath,
            evidence: targetPath,
            message: `${repoPath} imports private DOM automation file ${targetPath}.`,
          }),
        );
      }
    }

    if (!repoPath.startsWith(domRoot)) {
      continue;
    }

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const target = importDeclaration.getModuleSpecifierSourceFile();
      if (!target) {
        continue;
      }
      const targetPath = getRepoSourcePath(target);
      if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/ai-input-gateway/")) {
        continue;
      }
      findings.push(
        createFinding({
          checkId: "dom/business-neutrality",
          lawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports business or AI owner code ${targetPath}.`,
        }),
      );
    }

    const plannerToken = findPlannerToken(sourceFile);
    if (plannerToken) {
      findings.push(
        createFinding({
          checkId: "dom/planner-ban",
          lawId,
          filePath: repoPath,
          message: `${repoPath} contains planner token ${plannerToken}.`,
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