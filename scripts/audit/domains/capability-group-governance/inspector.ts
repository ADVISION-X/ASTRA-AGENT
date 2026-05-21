import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const approvedCapabilityRoots = new Set([
  "src/capabilities/ai-input-gateway",
  "src/capabilities/dom-automation",
  "src/capabilities/forensics-persistence",
  "src/capabilities/video-download",
]);

const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;

type CapabilityGroupFindingInput = Parameters<typeof createFinding>[0];

const createDedupedFindingPusher = (findings: ReturnType<typeof createFinding>[]) => {
  const findingKeys = new Set<string>();
  return (input: CapabilityGroupFindingInput): void => {
    const key = `${input.checkId}:${input.filePath ?? ""}:${input.message}`;
    if (findingKeys.has(key)) {
      return;
    }
    findingKeys.add(key);
    findings.push(createFinding(input));
  };
};

const registerCapabilityRoot = (capabilityRoots: Set<string>, repoPath: string): void => {
  const segments = repoPath.split("/");
  const capabilityRoot = segments.length >= 3 ? `${segments[0]}/${segments[1]}/${segments[2]}` : undefined;
  if (capabilityRoot) {
    capabilityRoots.add(capabilityRoot);
  }
};

const pushCapabilityImportFindings = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
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
};

const hasExportStarFacade = (sourceFile: Parameters<typeof getRepoSourcePath>[0]): boolean =>
  Boolean(
    sourceFile
      .getExportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() !== undefined && declaration.getNamedExports().length === 0),
  );

const inspectCapabilityFile = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  capabilityRoots: Set<string>,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  if (!repoPath.startsWith("src/capabilities/")) {
    return;
  }
  registerCapabilityRoot(capabilityRoots, repoPath);
  pushCapabilityImportFindings(sourceFile, repoPath, facadeLawId, pushFinding);
  if (!/^src\/capabilities\/[^/]+\/index\.ts$/u.test(repoPath)) {
    return;
  }
  if (!hasExportStarFacade(sourceFile)) {
    return;
  }
  pushFinding({
    checkId: "capability-group/export-star",
    lawId: facadeLawId,
    filePath: repoPath,
    message: `${repoPath} uses export * instead of explicit facade exports.`,
  });
};

const inspectPluginFile = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  if (!repoPath.startsWith("src/plugins/")) {
    return;
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
};

const pushUnapprovedCapabilityRoots = (
  capabilityRoots: ReadonlySet<string>,
  approvedRoots: ReadonlySet<string>,
  admissionLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  for (const capabilityRoot of capabilityRoots) {
    if (approvedRoots.has(capabilityRoot)) {
      continue;
    }
    pushFinding({
      checkId: "capability-group/unapproved-root",
      lawId: admissionLawId,
      filePath: capabilityRoot,
      message: `${capabilityRoot} is not an approved active ability-group root.`,
    });
  }
};

const inspectSourceFile = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  inspectedFiles: Set<string>,
  capabilityRoots: Set<string>,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  inspectedFiles.add(repoPath);
  inspectCapabilityFile(sourceFile, repoPath, capabilityRoots, facadeLawId, pushFinding);
  inspectPluginFile(sourceFile, repoPath, facadeLawId, pushFinding);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const admissionLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-001-V1");
  const facadeLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-003-V1");
  const findings: ReturnType<typeof createFinding>[] = [];
  const capabilityRoots = new Set<string>();
  const inspectedFiles = new Set<string>();
  const pushFinding = createDedupedFindingPusher(findings);

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    inspectSourceFile(sourceFile, inspectedFiles, capabilityRoots, facadeLawId, pushFinding);
  }

  pushUnapprovedCapabilityRoots(capabilityRoots, approvedCapabilityRoots, admissionLawId, pushFinding);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};