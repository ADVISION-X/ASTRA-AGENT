import { Node, type SourceFile } from "ts-morph";

import { domSurface } from "./dom-inspector-constants.js";
import type { DomFindingCollector } from "./dom-inspector-support.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";

const plannerNames = new Set(["nextAction", "actionPlan"]);
const retiredOwnerRoots = [
  "src/capabilities/text-input/",
  "src/capabilities/mouse-click/",
  "src/capabilities/open/",
  "src/capabilities/screenshot/",
  "src/capabilities/upload/",
] as const;

const findPlannerToken = (sourceFile: SourceFile): string | undefined => {
  const plannerNode = sourceFile.getDescendants().find((node) => {
    if (Node.isIdentifier(node)) return plannerNames.has(node.getText());
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return plannerNames.has(node.getLiteralValue());
    }
    return false;
  });
  return plannerNode?.getText();
};

const inspectImports = (sourceFile: SourceFile, collector: DomFindingCollector): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) continue;
    const targetPath = getRepoSourcePath(target);
    if (
      targetPath.startsWith(domSurface.root)
      && !repoPath.startsWith(domSurface.root)
      && targetPath !== domSurface.publicFacade
    ) {
      collector.push({
        checkId: "dom/public-facade-only",
        lawId: "APEX-DOM-002-V1",
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports private DOM automation file ${targetPath}.`,
      });
    }
    if (
      repoPath.startsWith(domSurface.root)
      && (targetPath.startsWith("src/plugins/") || targetPath.startsWith("src/capabilities/ai-input-gateway/"))
    ) {
      collector.push({
        checkId: "dom/business-neutrality",
        lawId: "APEX-DOM-001-V1",
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports business or AI owner code ${targetPath}.`,
      });
    }
  }
};

export const inspectDomBoundaries = (context: InspectorContext, collector: DomFindingCollector): Set<string> => {
  const inspectedFiles = new Set<string>();
  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);
    inspectImports(sourceFile, collector);
    if (repoPath.startsWith(domSurface.root)) {
      const plannerToken = findPlannerToken(sourceFile);
      if (plannerToken) {
        collector.push({
          checkId: "dom/planner-ban",
          lawId: "APEX-DOM-001-V1",
          filePath: repoPath,
          evidence: plannerToken,
          message: `${repoPath} contains planner token ${plannerToken}.`,
        });
      }
    }
    for (const retiredRoot of retiredOwnerRoots) {
      if (!repoPath.startsWith(retiredRoot)) continue;
      collector.push({
        checkId: "dom/retired-action-owner",
        lawId: "APEX-DOM-012-V1",
        filePath: repoPath,
        evidence: retiredRoot,
        message: `${repoPath} resurrects a retired standalone DOM action owner.`,
      });
    }
  }
  return inspectedFiles;
};
