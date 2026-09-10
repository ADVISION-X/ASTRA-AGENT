import type { ImportDeclaration, Node as MorphNode, Symbol as MorphSymbol } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import {
  buildCapabilityRoot,
  classifyRepoPath,
  isCapabilityFacade,
  isCapabilityPrivateImplementationSection,
} from "../../shared/repo-path-classifier.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, staticForbiddenClauses, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";
import { resolveCapabilityFacadePolicy } from "./components/capability-source-of-truth.js";
import { pushCapabilitySourceOfTruthFindings } from "./components/capability-governance-report.js";
import { pushFacadePurityFindings } from "./components/capability-facade-purity.js";
import { inspectCapabilityFacadeTypes } from "./components/capability-facade-types.js";
import { isOwnerlessGenericTarget } from "./components/capability-path-boundary.js";
type CapabilityGroupFindingInput = Omit<Parameters<typeof createFinding>[0], "evidenceMode"> & { evidenceMode?: string };

const createDedupedFindingPusher = (findings: ReturnType<typeof createFinding>[]) => {
  const findingKeys = new Set<string>();
  return (input: CapabilityGroupFindingInput): void => {
    const key = `${input.checkId}:${input.filePath ?? ""}:${input.message}`;
    if (findingKeys.has(key)) {
      return;
    }
    findingKeys.add(key);
    findings.push(createFinding({ ...input, evidenceMode: input.evidenceMode ?? "static.ast" }));
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
    if (targetPathInfo.kind === "other" && isOwnerlessGenericTarget(targetPath)) {
      pushFinding({
        checkId: "capability-group/ownerless-generic-import",
        lawId: facadeLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports capability logic from ownerless generic path ${targetPath}.`,
      });
      continue;
    }
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

const pushChildCompositionFindings = (
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  repoPath: string,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const sourceInfo = classifyRepoPath(repoPath);
  if (sourceInfo.kind !== "capability" || sourceInfo.section !== "children") return;
  const sourceChildId = repoPath.split("/")[4];
  if (!sourceChildId) return;
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) continue;
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (targetInfo.kind !== "capability" || targetInfo.owner !== sourceInfo.owner || targetInfo.section !== "children") continue;
    if (targetPath.split("/")[4] === sourceChildId) continue;
    pushFinding({
      checkId: "capability-group/child-composes-child",
      lawId: facadeLawId,
      filePath: repoPath,
      evidence: targetPath,
      message: `${repoPath} composes sibling child ability ${targetPath} instead of one atomic action.`,
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
    const importedName = namedImport.getName();
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
  pushChildCompositionFindings(sourceFile, repoPath, facadeLawId, pushFinding);
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
  consumedCapabilityRoots: Set<string>,
  consumedFacadeExports: Map<string, Set<string>>,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const consumerInfo = classifyRepoPath(repoPath);
  if (
    consumerInfo.kind !== "plugin"
    && consumerInfo.kind !== "local-runtime"
    && consumerInfo.kind !== "app"
    && consumerInfo.kind !== "mediator"
  ) {
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
      const capabilityRoot = buildCapabilityRoot(targetInfo.owner);
      consumedCapabilityRoots.add(capabilityRoot);
      const consumedExports = consumedFacadeExports.get(capabilityRoot) ?? new Set<string>();
      for (const namedImport of importDeclaration.getNamedImports()) {
        consumedExports.add(namedImport.getName());
      }
      consumedFacadeExports.set(capabilityRoot, consumedExports);
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
  const facadeExports = new Map<string, { facadePath: string; names: Set<string> }>();
  const consumedCapabilityRoots = new Set<string>();
  const consumedFacadeExports = new Map<string, Set<string>>();
  const inspectedFiles = new Set<string>();

  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (isCapabilityFacade(classifyRepoPath(repoPath))) {
      capabilityFacades.add(repoPath);
      const capabilityRoot = resolveCapabilityRoot(repoPath);
      if (capabilityRoot) {
        facadeExports.set(capabilityRoot, {
          facadePath: repoPath,
          names: new Set(sourceFile.getExportSymbols().map((symbol) => symbol.getName())),
        });
      }
    }
    inspectSourceFile(
      sourceFile,
      inspectedFiles,
      capabilityRoots,
      consumedCapabilityRoots,
      consumedFacadeExports,
      input.facadeLawId,
      input.pushFinding,
    );
  }

  return {
    capabilityRoots,
    capabilityFacades,
    facadeExports,
    inspectedFiles,
    consumedCapabilityRoots,
    consumedFacadeExports,
  };
};

const pushMissingCapabilityConsumers = (input: {
  capabilityRoots: ReadonlySet<string>;
  consumedCapabilityRoots: ReadonlySet<string>;
  facadeLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
}): void => {
  for (const capabilityRoot of input.capabilityRoots) {
    if (input.consumedCapabilityRoots.has(capabilityRoot)) continue;
    input.pushFinding({
      checkId: "capability-group/missing-production-consumer",
      lawId: input.facadeLawId,
      filePath: `${capabilityRoot}/index.ts`,
      message: `${capabilityRoot} has no active external production consumer through its public facade.`,
    });
  }
};

const pushMissingFacadeExportConsumers = (input: {
  facadeExports: ReadonlyMap<string, { facadePath: string; names: ReadonlySet<string> }>;
  consumedFacadeExports: ReadonlyMap<string, ReadonlySet<string>>;
  facadeLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
}): void => {
  for (const [capabilityRoot, facade] of input.facadeExports) {
    const consumedExports = input.consumedFacadeExports.get(capabilityRoot) ?? new Set<string>();
    for (const exportName of facade.names) {
      if (consumedExports.has(exportName)) continue;
      input.pushFinding({
        checkId: "capability-group/missing-production-export-consumer",
        lawId: input.facadeLawId,
        filePath: facade.facadePath,
        evidence: exportName,
        message: `${facade.facadePath} exports ${exportName} without an active production consumer.`,
      });
    }
  }
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
  consumedCapabilityRoots: Set<string>,
  consumedFacadeExports: Map<string, Set<string>>,
  facadeLawId: string,
  pushFinding: ReturnType<typeof createDedupedFindingPusher>,
): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  inspectedFiles.add(repoPath);
  inspectCapabilityFile(sourceFile, repoPath, capabilityRoots, facadeLawId, pushFinding);
  inspectExternalConsumerFile(
    sourceFile,
    repoPath,
    consumedCapabilityRoots,
    consumedFacadeExports,
    facadeLawId,
    pushFinding,
  );
};

export const inspectCapabilityGovernanceProject = (
  project: InspectorContext["project"],
  includeAuthority: boolean,
  lawId = "LAW-CAPABILITY-GOVERNANCE-001-V10",
  observeTypes: () => string = () => observeTypeCheckerRelations(project),
): { findings: ReturnType<typeof createFinding>[]; inspectedFiles: string[]; staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] } => {
  const findings: ReturnType<typeof createFinding>[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const pushFinding = createDedupedFindingPusher(findings);
  const scan = recordStaticCheck({ check: "collectCapabilityGovernanceScan", findings,
    implementation: collectCapabilityGovernanceScan, lawIds: [lawId], receipts: staticCheckReceipts, run: () => collectCapabilityGovernanceScan({
    facadeLawId: lawId,
    project,
    pushFinding,
  }) });

  if (includeAuthority) recordStaticCheck({ check: "pushCapabilitySourceOfTruthFindings", findings,
    implementation: pushCapabilitySourceOfTruthFindings, lawIds: [lawId], receipts: staticCheckReceipts, run: () => pushCapabilitySourceOfTruthFindings({
    admissionLawId: lawId,
    actualCapabilityRoots: scan.capabilityRoots,
    pushFinding,
  }) });
  recordStaticCheck({ check: "pushMissingCapabilityFacades", findings, implementation: pushMissingCapabilityFacades,
    lawIds: [lawId], receipts: staticCheckReceipts, run: () => pushMissingCapabilityFacades({
    capabilityFacades: scan.capabilityFacades,
    capabilityRoots: scan.capabilityRoots,
    facadeLawId: lawId,
    pushFinding,
  }) });
  recordStaticCheck({ check: "pushMissingCapabilityConsumers", findings, implementation: pushMissingCapabilityConsumers,
    lawIds: [lawId], receipts: staticCheckReceipts, run: () => pushMissingCapabilityConsumers({
    capabilityRoots: scan.capabilityRoots,
    consumedCapabilityRoots: scan.consumedCapabilityRoots,
    facadeLawId: lawId,
    pushFinding,
  }) });
  recordStaticCheck({ check: "pushMissingFacadeExportConsumers", findings, implementation: pushMissingFacadeExportConsumers,
    lawIds: [lawId], receipts: staticCheckReceipts, run: () => pushMissingFacadeExportConsumers({
    facadeExports: scan.facadeExports,
    consumedFacadeExports: scan.consumedFacadeExports,
    facadeLawId: lawId,
    pushFinding,
  }) });
  recordStaticCheck({ check: "inspectCapabilityFacadeTypes", findings, implementation: inspectCapabilityFacadeTypes,
    lawIds: [lawId], observe: observeTypes, receipts: staticCheckReceipts,
    run: () => inspectCapabilityFacadeTypes({ lawId, project, pushFinding }) });

  return { findings, inspectedFiles: [...scan.inspectedFiles].sort(), staticCheckReceipts };
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, context.selectedLawId);
  const authorityAvailable = context.targetPaths.includes(".github/instructions/agent-rules/基础法案.md")
    && context.targetPaths.includes(".github/instructions/agent-rules/功能法案.md");
  const evaluation = inspectCapabilityGovernanceProject(
    context.project, authorityAvailable, lawId, () => observeStaticMode(context, "static.types"),
  );

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: evaluation.findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts: evaluation.staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = selectLawId(evaluation.reportedLawIds, context.selectedLawId);
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const checks = (mode: string): string[] => mode === "static.dependency"
    ? ["pushMissingCapabilityConsumers", "pushMissingFacadeExportConsumers"]
    : mode === "static.filesystem" ? ["pushMissingCapabilityFacades"]
      : mode === "static.types" ? ["inspectCapabilityFacadeTypes"]
        : ["collectCapabilityGovernanceScan"];
  const clauses = (mode: string): string[] => mode === "static.ast" ? staticClauses(0, 1, 3, 5, 6, 11)
    : mode === "static.dependency" ? staticForbiddenClauses(2, 4)
      : mode === "static.types" ? staticForbiddenClauses(0) : staticForbiddenClauses(3);
  const refs = (mode: string, clauses: string[]) => ({
    passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks(mode)),
    refs: staticEvidenceRefs(context, lawId, mode, clauses, evaluation.staticCheckReceipts, checks(mode)),
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      ...(["static.ast", "static.dependency", "static.filesystem", "static.types"] as const).map((evidenceMode) =>
        ({ clauses: clauses(evidenceMode), evidenceMode, ...refs(evidenceMode, clauses(evidenceMode)) })),
    ], findings }], inspectedFiles: evaluation.inspectedFiles,
  });
};
