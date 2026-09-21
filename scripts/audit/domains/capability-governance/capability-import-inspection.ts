import { buildCapabilityRoot, classifyRepoPath } from "../../shared/repo-path-classifier.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { isOwnerlessGenericTarget } from "./components/capability-path-boundary.js";
import { createDedupedFindingPusher } from "./mechanical-content-inspection.js";

type SourceFile = Parameters<typeof getRepoSourcePath>[0];
type PushFinding = ReturnType<typeof createDedupedFindingPusher>;

export const registerCapabilityRoot = (capabilityRoots: Set<string>, repoPath: string): void => {
  const pathInfo = classifyRepoPath(repoPath);
  if (pathInfo.kind === "capability") capabilityRoots.add(buildCapabilityRoot(pathInfo.owner));
};

export const pushCapabilityPluginImportFindings = (
  sourceFile: SourceFile, repoPath: string, facadeLawId: string, pushFinding: PushFinding,
): void => {
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) continue;
    const targetPath = getRepoSourcePath(targetSourceFile);
    if (!targetPath.startsWith("src/plugins/")) continue;
    pushFinding({ checkId: "capability-group/capability-imports-plugin", lawId: facadeLawId,
      filePath: repoPath, evidence: targetPath,
      message: `${repoPath} imports plugin-owned code ${targetPath}.` });
  }
};

export const pushCapabilityCrossOwnerImportFindings = (
  sourceFile: SourceFile, repoPath: string, facadeLawId: string, pushFinding: PushFinding,
): void => {
  const sourceInfo = classifyRepoPath(repoPath);
  if (sourceInfo.kind !== "capability") return;
  const sourceRoot = buildCapabilityRoot(sourceInfo.owner);
  for (const declaration of sourceFile.getImportDeclarations()) {
    const targetFile = declaration.getModuleSpecifierSourceFile();
    if (!targetFile) continue;
    const targetPath = getRepoSourcePath(targetFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (targetInfo.kind === "other" && isOwnerlessGenericTarget(targetPath)) {
      pushFinding({ checkId: "capability-group/ownerless-generic-import", lawId: facadeLawId,
        filePath: repoPath, evidence: targetPath,
        message: `${repoPath} imports capability logic from ownerless generic path ${targetPath}.` });
    } else if (targetInfo.kind === "capability"
      && buildCapabilityRoot(targetInfo.owner) !== sourceRoot) {
      pushFinding({ checkId: "capability-group/cross-owner-import", lawId: facadeLawId,
        filePath: repoPath, evidence: targetPath,
        message: `${repoPath} imports unrelated capability owner code ${targetPath}.` });
    }
  }
};

export const pushChildCompositionFindings = (
  sourceFile: SourceFile, repoPath: string, facadeLawId: string, pushFinding: PushFinding,
): void => {
  const sourceInfo = classifyRepoPath(repoPath);
  if (sourceInfo.kind !== "capability" || sourceInfo.section !== "children") return;
  const sourceChildId = repoPath.split("/")[4];
  if (!sourceChildId) return;
  for (const declaration of sourceFile.getImportDeclarations()) {
    const targetFile = declaration.getModuleSpecifierSourceFile();
    if (!targetFile) continue;
    const targetPath = getRepoSourcePath(targetFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (targetInfo.kind !== "capability" || targetInfo.owner !== sourceInfo.owner
      || targetInfo.section !== "children" || targetPath.split("/")[4] === sourceChildId) continue;
    pushFinding({ checkId: "capability-group/child-composes-child", lawId: facadeLawId,
      filePath: repoPath, evidence: targetPath,
      message: `${repoPath} composes sibling child ability ${targetPath} instead of one atomic action.` });
  }
};
