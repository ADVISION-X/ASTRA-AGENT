import type { ImportDeclaration, Node as MorphNode, Symbol as MorphSymbol } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import {
  buildCapabilityRoot,
  classifyRepoPath,
  isCapabilityFacade,
  isCapabilityNonFacade,
  isCapabilityPrivateImplementationSection,
  isExternalCapabilityConsumer,
} from "../../shared/repo-path-classifier.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";
import {
  resolveCapabilityFacadePolicy,
} from "./components/capability-source-of-truth.js";
import {
  buildCapabilityGovernanceReportJson,
  pushCapabilitySourceOfTruthFindings,
} from "./components/capability-governance-report.js";
import { pushFacadePurityFindings } from "./components/capability-facade-purity.js";

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
  const pathInfo = classifyRepoPath(repoPath);
  if (pathInfo.kind === "capability") {
    capabilityRoots.add(buildCapabilityRoot(pathInfo.owner));
  }
};

const resolveCapabilityRoot = (repoPath: string): string | undefined => {
  const pathInfo = classifyRepoPath(repoPath);
  return pathInfo.kind === "capability" ? buildCapabilityRoot(pathInfo.owner) : undefined;
};

const pushCapabilityPluginImportFindings = (
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

const pushCapabilityCrossOwnerImportFindings = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const sourceCapabilityRoot = resolveCapabilityRoot(repoPath);
  if (!sourceCapabilityRoot) {
    return;
  }

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetPathInfo = classifyRepoPath(targetPath);
    if (targetPathInfo.kind !== "capability") {
      continue;
    }
    const targetCapabilityRoot = buildCapabilityRoot(targetPathInfo.owner);
    if (targetCapabilityRoot === sourceCapabilityRoot) {
      continue;
    }
    pushFinding({
      checkId: "capability-group/cross-owner-import",
      lawId: facadeLawId,
      filePath: repoPath,
      evidence: targetPath,
      message: `${repoPath} imports unrelated capability owner code ${targetPath}.`,
    });
  }
};

const hasExportStarFacade = (sourceFile: Parameters<typeof getRepoSourcePath>[0]): boolean =>
  Boolean(
    sourceFile
      .getExportDeclarations()
      .find((declaration) => declaration.getModuleSpecifierValue() !== undefined && declaration.getNamedExports().length === 0),
  );

const pushFacadeSymbolEscapeImportFindings = (
  importDeclaration: ImportDeclaration,
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
  if (!targetSourceFile) {
    return;
  }
  const targetPath = getRepoSourcePath(targetSourceFile);
  const targetPathInfo = classifyRepoPath(targetPath);
  if (!isCapabilityFacade(targetPathInfo)) {
    return;
  }

  const policy = resolveCapabilityFacadePolicy(buildCapabilityRoot(targetPathInfo.owner));
  const exportSymbols = targetSourceFile.getExportSymbols();

  for (const namedImport of importDeclaration.getNamedImports()) {
    const importedName = namedImport.getNameNode().getText();
    if (policy.mode === "public-child-functions" && (policy.allowedPublicChildFunctionExports?.has(importedName) ?? false)) {
      continue;
    }
    const declarationPath = exportSymbols
      .filter((exportSymbol: MorphSymbol) => exportSymbol.getName() === importedName)
      .flatMap((exportSymbol: MorphSymbol) => exportSymbol.getDeclarations())
      .map((declaration: MorphNode) => getRepoSourcePath(declaration.getSourceFile()))
      .find((candidatePath: string) => {
        const candidateInfo = classifyRepoPath(candidatePath);
        return candidateInfo.kind === "capability"
          && candidateInfo.owner === targetPathInfo.owner
          && isCapabilityPrivateImplementationSection(candidateInfo);
      });
    if (!declarationPath) {
      continue;
    }
    pushFinding({
      checkId: "capability-group/external-facade-private-symbol",
      lawId: facadeLawId,
      filePath: repoPath,
      evidence: `${targetPath}:${importedName}:${declarationPath}`,
      message: `${repoPath} imports facade symbol ${importedName} from ${targetPath}, but the symbol is declared in private capability implementation ${declarationPath}.`,
    });
  }
};

const inspectCapabilityFile = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  capabilityRoots: Set<string>,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const pathInfo = classifyRepoPath(repoPath);
  if (pathInfo.kind !== "capability") {
    return;
  }
  registerCapabilityRoot(capabilityRoots, repoPath);
  pushCapabilityPluginImportFindings(sourceFile, repoPath, facadeLawId, pushFinding);
  pushCapabilityCrossOwnerImportFindings(sourceFile, repoPath, facadeLawId, pushFinding);
  if (!isCapabilityFacade(pathInfo)) {
    return;
  }
  const capabilityRoot = resolveCapabilityRoot(repoPath);
  if (capabilityRoot) {
    pushFacadePurityFindings(sourceFile, repoPath, capabilityRoot, facadeLawId, pushFinding);
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

const inspectExternalConsumerFile = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const consumerInfo = classifyRepoPath(repoPath);
  if (!isExternalCapabilityConsumer(consumerInfo)) {
    return;
  }
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (targetInfo.kind !== "capability") {
      continue;
    }
    if (isCapabilityFacade(targetInfo)) {
      pushFacadeSymbolEscapeImportFindings(importDeclaration, repoPath, facadeLawId, pushFinding);
      continue;
    }
    pushFinding({
      checkId: isCapabilityPrivateImplementationSection(targetInfo)
        ? "capability-group/external-private-import"
        : "capability-group/external-non-facade-import",
      lawId: facadeLawId,
      filePath: repoPath,
      evidence: targetPath,
      message: isCapabilityPrivateImplementationSection(targetInfo)
        ? `${repoPath} imports private capability implementation ${targetPath}.`
        : `${repoPath} imports non-facade capability code ${targetPath}.`,
    });
  }
};

const collectCapabilityGovernanceScan = (input: {
  facadeLawId: string;
  project: InspectorContext["project"];
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
}) => {
  const capabilityRoots = new Set<string>();
  const capabilityFacades = new Set<string>();
  const inspectedFiles = new Set<string>();

  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (isCapabilityFacade(classifyRepoPath(repoPath))) {
      capabilityFacades.add(repoPath);
    }
    inspectSourceFile(sourceFile, inspectedFiles, capabilityRoots, input.facadeLawId, input.pushFinding);
  }

  return {
    capabilityRoots,
    capabilityFacades,
    inspectedFiles,
  };
};

const pushMissingCapabilityFacades = (input: {
  capabilityFacades: ReadonlySet<string>;
  capabilityRoots: ReadonlySet<string>;
  facadeLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
}): void => {
  for (const capabilityRoot of input.capabilityRoots) {
    if (input.capabilityFacades.has(`${capabilityRoot}/index.ts`)) {
      continue;
    }
    input.pushFinding({
      checkId: "capability-group/missing-public-facade",
      lawId: input.facadeLawId,
      filePath: capabilityRoot,
      message: `${capabilityRoot} is missing public facade ${capabilityRoot}/index.ts.`,
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
  inspectExternalConsumerFile(sourceFile, repoPath, facadeLawId, pushFinding);
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const admissionLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-001-V1");
  const facadeLawId = selectLawId(context.planEntry.lawIds, "APEX-CAPABILITY-GROUP-003-V1");
  const findings: ReturnType<typeof createFinding>[] = [];
  const pushFinding = createDedupedFindingPusher(findings);
  const scan = collectCapabilityGovernanceScan({
    facadeLawId,
    project: context.project,
    pushFinding,
  });

  const sourceOfTruth = pushCapabilitySourceOfTruthFindings({
    admissionLawId,
    actualCapabilityRoots: scan.capabilityRoots,
    pushFinding,
  });
  pushMissingCapabilityFacades({
    capabilityFacades: scan.capabilityFacades,
    capabilityRoots: scan.capabilityRoots,
    facadeLawId,
    pushFinding,
  });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...scan.inspectedFiles].sort(),
    reportJson: buildCapabilityGovernanceReportJson({
      capabilityDomain: context.planEntry.capabilityDomain,
      capabilityRoots: scan.capabilityRoots,
      findings,
      inspectedFiles: scan.inspectedFiles,
      lawIds: context.planEntry.lawIds,
      sourceOfTruth,
    }),
  };
};
