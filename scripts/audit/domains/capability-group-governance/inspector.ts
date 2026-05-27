import type { ExportDeclaration } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";
import {
  resolveCapabilityFacadePolicy,
} from "./components/capability-source-of-truth.js";
import {
  buildCapabilityGovernanceReportJson,
  pushCapabilitySourceOfTruthFindings,
} from "./components/capability-governance-report.js";

const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;
const publicCapabilityFacadePathPattern = /^src\/capabilities\/[^/]+\/index\.ts$/u;

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

const resolveCapabilityRoot = (repoPath: string): string | undefined => {
  const segments = repoPath.split("/");
  return segments.length >= 3 ? `${segments[0]}/${segments[1]}/${segments[2]}` : undefined;
};

const isFactoryContractValueExportAllowed = (capabilityRoot: string, targetPath: string): boolean =>
  targetPath === `${capabilityRoot}/ability-group.ts`;

const isRuntimeValueExportDeclaration = (
  exportDeclaration: ExportDeclaration,
): boolean => {
  if (exportDeclaration.isTypeOnly()) {
    return false;
  }
  const namedExports = exportDeclaration.getNamedExports();
  if (namedExports.length === 0) {
    return true;
  }
  return namedExports.some((namedExport) => !namedExport.isTypeOnly());
};

const pushFacadePurityFindings = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  capabilityRoot: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const policy = resolveCapabilityFacadePolicy(capabilityRoot);
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifierValue = exportDeclaration.getModuleSpecifierValue();
    if (!moduleSpecifierValue) {
      continue;
    }
    const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const exportedNames = exportDeclaration.getNamedExports().map((namedExport) => namedExport.getName());
    const hasRuntimeValueExport = isRuntimeValueExportDeclaration(exportDeclaration);

    if (
      targetPath.startsWith(`${capabilityRoot}/runtime/`)
      || targetPath.startsWith(`${capabilityRoot}/children/`)
    ) {
      const domPublicChildExportAllowed = policy.mode === "public-child-functions"
        && hasRuntimeValueExport
        && exportedNames.length > 0
        && exportedNames.every((name) => policy.allowedPublicChildFunctionExports?.has(name) ?? false);
      if (domPublicChildExportAllowed) {
        continue;
      }
      pushFinding({
        checkId: "capability-group/facade-private-runtime-export",
        lawId: facadeLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} re-exports private capability implementation ${targetPath}.`,
      });
      continue;
    }

    if (targetPath === `${capabilityRoot}/registry.ts`) {
      pushFinding({
        checkId: "capability-group/facade-registry-export",
        lawId: facadeLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} re-exports private registry surface ${targetPath}.`,
      });
      continue;
    }

    if (
      hasRuntimeValueExport
      && policy.mode === "factory-contract"
      && !isFactoryContractValueExportAllowed(capabilityRoot, targetPath)
    ) {
      pushFinding({
        checkId: "capability-group/facade-noncontract-value-export",
        lawId: facadeLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} exports runtime value surface ${targetPath} instead of a factory-only public facade.`,
      });
    }
  }
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
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    const targetCapabilityRoot = resolveCapabilityRoot(targetPath);
    if (!targetCapabilityRoot || targetCapabilityRoot === sourceCapabilityRoot) {
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
  pushCapabilityPluginImportFindings(sourceFile, repoPath, facadeLawId, pushFinding);
  pushCapabilityCrossOwnerImportFindings(sourceFile, repoPath, facadeLawId, pushFinding);
  if (!/^src\/capabilities\/[^/]+\/index\.ts$/u.test(repoPath)) {
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
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    if (publicCapabilityFacadePathPattern.test(targetPath)) {
      continue;
    }
    pushFinding({
      checkId: privateCapabilityPathPattern.test(targetPath)
        ? "capability-group/plugin-private-import"
        : "capability-group/plugin-non-facade-import",
      lawId: facadeLawId,
      filePath: repoPath,
      evidence: targetPath,
      message: privateCapabilityPathPattern.test(targetPath)
        ? `${repoPath} imports private capability runtime ${targetPath}.`
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
    if (publicCapabilityFacadePathPattern.test(repoPath)) {
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
  inspectPluginFile(sourceFile, repoPath, facadeLawId, pushFinding);
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
