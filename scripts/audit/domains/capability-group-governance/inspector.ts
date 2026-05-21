import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const approvedCapabilityRoots = new Set([
  "src/capabilities/ai-input-gateway",
  "src/capabilities/dom-automation",
  "src/capabilities/forensics-persistence",
]);

const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const admissionLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-001-V1");
  const facadeLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-003-V1");
  const findings: ReturnType<typeof createFinding>[] = [];
  const findingKeys = new Set<string>();
  const capabilityRoots = new Set<string>();
  const inspectedFiles = new Set<string>();

  const pushFinding = (input: Parameters<typeof createFinding>[0]): void => {
    const key = `${input.checkId}:${input.filePath ?? ""}:${input.message}`;
    if (findingKeys.has(key)) {
      return;
    }
    findingKeys.add(key);
    findings.push(createFinding(input));
  };

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);

    if (repoPath.startsWith("src/capabilities/")) {
      const segments = repoPath.split("/");
      const capabilityRoot = segments.length >= 3 ? `${segments[0]}/${segments[1]}/${segments[2]}` : undefined;
      if (capabilityRoot) {
        capabilityRoots.add(capabilityRoot);
      }

      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
        if (!targetSourceFile) {
          continue;
        }
        const targetPath = getRepoSourcePath(targetSourceFile);
        if (!targetPath.startsWith("src/plugins/")) {
          continue;
        }
        pushFinding({
          checkId: "capability-group/capability-imports-plugin",
          lawId: facadeLawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports plugin-owned code ${targetPath}.`,
        });
      }

      if (/^src\/capabilities\/[^/]+\/index\.ts$/u.test(repoPath)) {
        const exportStar = sourceFile
          .getExportDeclarations()
          .find((declaration) => declaration.getModuleSpecifierValue() !== undefined && declaration.getNamedExports().length === 0);
        if (exportStar) {
          pushFinding({
            checkId: "capability-group/export-star",
            lawId: facadeLawId,
            filePath: repoPath,
            message: `${repoPath} uses export * instead of explicit facade exports.`,
          });
        }
      }
    }

    if (!repoPath.startsWith("src/plugins/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
      if (!targetSourceFile) {
        continue;
      }
      const targetPath = getRepoSourcePath(targetSourceFile);
      if (!privateCapabilityPathPattern.test(targetPath)) {
        continue;
      }
      pushFinding({
        checkId: "capability-group/plugin-private-import",
        lawId: facadeLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports private capability runtime ${targetPath}.`,
      });
    }
  }

  for (const capabilityRoot of capabilityRoots) {
    if (approvedCapabilityRoots.has(capabilityRoot)) {
      continue;
    }
    pushFinding({
      checkId: "capability-group/unapproved-root",
      lawId: admissionLawId,
      filePath: capabilityRoot,
      message: `${capabilityRoot} is not an approved active ability-group root.`,
    });
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};