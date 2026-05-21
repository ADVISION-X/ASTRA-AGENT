import { readdirSync } from "node:fs";

import { Node } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const allowedSrcRoots = new Set(["app", "mediator", "plugins", "capabilities", "lib", "types"]);
const allowedScriptRoots = new Set(["acceptance", "audit", "startup"]);
const plannerNames = new Set(["nextAction", "actionPlan"]);

const collectUnexpectedRoots = (rootPath: string, allowedRoots: ReadonlySet<string>): string[] =>
  readdirSync(resolveFromRepo(rootPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !allowedRoots.has(entry.name))
    .map((entry) => `${rootPath}/${entry.name}`)
    .sort();

const findPlannerToken = (sourceFileTextOwner: Parameters<typeof getRepoSourcePath>[0]): string | undefined => {
  const plannerNode = sourceFileTextOwner.getDescendants().find((node) => {
    if (Node.isIdentifier(node)) {
      return plannerNames.has(node.getText());
    }
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return plannerNames.has(node.getLiteralValue());
    }
    if (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) {
      return plannerNames.has(node.getName());
    }
    return false;
  });
  return plannerNode?.getText();
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const rootLawId = selectLawId(context.planEntry.lawIds, "APEX-ARCH-006-V1");
  const capabilityLawId = selectLawId(context.planEntry.lawIds, "APEX-ARCH-004-V1");
  const sharedLawId = selectLawId(context.planEntry.lawIds, "APEX-ARCH-007-V1");
  const plannerLawId = selectLawId(context.planEntry.lawIds, "APEX-ARCH-009-V1");
  const findings = [];
  const inspectedFiles = new Set<string>();

  for (const unexpectedRoot of collectUnexpectedRoots("src", allowedSrcRoots)) {
    findings.push(
      createFinding({
        checkId: "architecture/allowed-src-root",
        lawId: rootLawId,
        filePath: unexpectedRoot,
        message: `${unexpectedRoot} is outside the approved src root allowlist.`,
      }),
    );
  }
  for (const unexpectedRoot of collectUnexpectedRoots("scripts", allowedScriptRoots)) {
    findings.push(
      createFinding({
        checkId: "architecture/allowed-script-root",
        lawId: rootLawId,
        filePath: unexpectedRoot,
        message: `${unexpectedRoot} is outside the approved scripts root allowlist.`,
      }),
    );
  }

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);

    if (repoPath.startsWith("src/capabilities/")) {
      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const target = importDeclaration.getModuleSpecifierSourceFile();
        if (!target) {
          continue;
        }
        const targetPath = getRepoSourcePath(target);
        if (!targetPath.startsWith("src/plugins/")) {
          continue;
        }
        findings.push(
          createFinding({
            checkId: "architecture/capability-imports-plugin",
            lawId: capabilityLawId,
            filePath: repoPath,
            evidence: targetPath,
            message: `${repoPath} imports plugin-owned code ${targetPath}.`,
          }),
        );
      }
    }

    if (repoPath.startsWith("src/lib/") && !repoPath.startsWith("src/lib/local-runtime/")) {
      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const target = importDeclaration.getModuleSpecifierSourceFile();
        if (!target) {
          continue;
        }
        const targetPath = getRepoSourcePath(target);
        if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/")) {
          continue;
        }
        findings.push(
          createFinding({
            checkId: "architecture/shared-owner-boundary",
            lawId: sharedLawId,
            filePath: repoPath,
            evidence: targetPath,
            message: `${repoPath} imports owner code ${targetPath} from shared infrastructure.`,
          }),
        );
      }
    }

    if (
      repoPath.startsWith("src/plugins/") ||
      repoPath.startsWith("src/capabilities/ai-input-gateway/") ||
      repoPath.startsWith("src/mediator/")
    ) {
      const plannerToken = findPlannerToken(sourceFile);
      if (plannerToken) {
        findings.push(
          createFinding({
            checkId: "architecture/ai-planner-ban",
            lawId: plannerLawId,
            filePath: repoPath,
            message: `${repoPath} contains planner token ${plannerToken}.`,
          }),
        );
      }
    }
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};