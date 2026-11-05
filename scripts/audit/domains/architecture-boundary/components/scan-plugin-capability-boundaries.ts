import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { isPaperFactoryStepImport, isTopLevelPluginFile } from "../../../shared/no-regex.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";
import {
  collectResolvedModuleTargets,
  type SourceModuleTarget,
} from "../../../shared/source-module-targets.js";
import {
  isJobPluginPath,
  isPrivateCapabilityPath,
  isPublicCapabilityFacadePath,
  resolveOwnerRoot,
  type ArchitectureSourceFile,
} from "./architecture-boundary-shared.js";

const describeEdgeVerb = (edgeKind: SourceModuleTarget["edgeKind"]): string =>
  edgeKind === "re-export" ? "re-exports" : "imports";

const runtimeBrowserCompositionTargets = new Set([
  "src/lib/browser/infrastructure/browser-infrastructure-supervisor.ts",
  "src/lib/browser/profile/browser-profile-config.ts",
  "src/lib/browser/profile/browser-profile-enrollment.ts",
  "src/lib/browser/profile/dedicated-profile-policy.ts",
  "src/lib/browser/profile/managed-policy-readback.ts",
  "src/lib/browser/release/extension-directory-hash-v1.ts",
  "src/lib/browser/release/unpacked-extension-release-identity.ts",
]);

const pushBoundaryFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    lawId: string;
    repoPath: string;
    targetPath?: string;
    message: string;
  },
): void => {
  findings.push(
    createFinding({ evidenceMode: "static.ast",
      checkId: input.checkId,
      lawId: input.lawId,
      filePath: input.repoPath,
      evidence: input.targetPath,
      message: input.message,
    }),
  );
};

const inspectCapabilityPluginImports = (
  findings: InspectorFinding[],
  capabilityLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    const targetPath = target.targetPath;
    if (!targetPath.startsWith("src/plugins/")) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/capability-imports-plugin",
      lawId: capabilityLawId,
      repoPath,
      targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} plugin-owned code ${targetPath}.`,
    });
  }
};

const inspectCapabilityCrossOwnerImports = (
  findings: InspectorFinding[],
  capabilityLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  const sourceCapabilityRoot = resolveOwnerRoot(repoPath, 2);
  if (!sourceCapabilityRoot) {
    return;
  }

  for (const target of collectResolvedModuleTargets(sourceFile)) {
    const targetPath = target.targetPath;
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    const targetCapabilityRoot = resolveOwnerRoot(targetPath, 2);
    if (!targetCapabilityRoot || targetCapabilityRoot === sourceCapabilityRoot) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/capability-cross-owner-import",
      lawId: capabilityLawId,
      repoPath,
      targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} unrelated capability owner code ${targetPath}.`,
    });
  }
};

export const inspectCapabilityImports = (
  findings: InspectorFinding[],
  capabilityLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!repoPath.startsWith("src/capabilities/")) {
    return;
  }
  inspectCapabilityPluginImports(findings, capabilityLawId, repoPath, sourceFile);
  inspectCapabilityCrossOwnerImports(findings, capabilityLawId, repoPath, sourceFile);
};

export const inspectRuntimePluginImports = (
  findings: InspectorFinding[],
  runtimeLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!repoPath.startsWith("src/lib/local-runtime/production/")) return;
  const runtimeCatalogDataExports = new Set(["productPluginCatalogSnapshot", "productionCatalogHash"]);
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    if (target.targetPath !== "src/mediator/product-plugin-catalog.ts") continue;
    const dataOnlyImport = target.edgeKind === "import"
      && !target.namespaceImport
      && target.namedBindings.length > 0
      && target.namedBindings.every((name) => runtimeCatalogDataExports.has(name));
    if (dataOnlyImport) continue;
    pushBoundaryFinding(findings, {
      checkId: "architecture/runtime-imports-plugin-object",
      lawId: runtimeLawId,
      repoPath,
      targetPath: `src/mediator/product-plugin-catalog.ts:${target.edgeKind}:${target.namedBindings.join(",") || "all"}`,
      message: `${repoPath} uses the Product Catalog through a non-data-only import edge.`,
    });
  }
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    if (!target.targetPath.startsWith("src/plugins/")) continue;
    pushBoundaryFinding(findings, {
      checkId: "architecture/runtime-imports-plugin",
      lawId: runtimeLawId,
      repoPath,
      targetPath: target.targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} Product Plugin code ${target.targetPath}.`,
    });
  }
};

export const inspectRuntimeBrowserPrivateImports = (
  findings: InspectorFinding[],
  runtimeLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!repoPath.startsWith("src/lib/local-runtime/")) return;
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    if (!target.targetPath.startsWith("src/lib/browser/")
      || target.targetPath === "src/lib/browser/browser-authority-api.ts") continue;
    const compositionAllowed = repoPath === "src/lib/local-runtime/workbench-browser-authority-support.ts"
      && runtimeBrowserCompositionTargets.has(target.targetPath);
    if (compositionAllowed) continue;
    pushBoundaryFinding(findings, {
      checkId: "architecture/runtime-imports-browser-private",
      lawId: runtimeLawId,
      repoPath,
      targetPath: target.targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} Browser-private code ${target.targetPath} instead of the Browser public facade.`,
    });
  }
};

const inspectCrossJobImports = (
  findings: InspectorFinding[],
  jobFlowLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  const sourcePluginRoot = resolveOwnerRoot(repoPath, 2);
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    const targetPath = target.targetPath;
    if (!targetPath.startsWith("src/plugins/")) {
      continue;
    }
    const targetPluginRoot = resolveOwnerRoot(targetPath, 2);
    if (!targetPluginRoot || targetPluginRoot === sourcePluginRoot) {
      continue;
    }
    if (isPaperFactoryStepImport(repoPath, target)) continue;
    pushBoundaryFinding(findings, {
      checkId: "architecture/flow-cross-job-import",
      lawId: jobFlowLawId,
      repoPath,
      targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} unrelated job flow code ${targetPath}.`,
    });
  }
};

const inspectNonFacadeCapabilityImports = (
  findings: InspectorFinding[],
  jobFlowLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    const targetPath = target.targetPath;
    if (!targetPath.startsWith("src/capabilities/") || isPublicCapabilityFacadePath(targetPath)) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/flow-non-facade-capability-import",
      lawId: jobFlowLawId,
      repoPath,
      targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} non-facade capability code ${targetPath}.`,
    });
  }
};

const inspectRuntimePrivateImports = (
  findings: InspectorFinding[],
  jobFlowLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  const scopedSources = new Map(sourceFile.getProject().getSourceFiles()
    .map((source) => [getRepoSourcePath(source), source]));
  const visited = new Set<string>([repoPath]);
  const pending = [sourceFile];
  const targets: SourceModuleTarget[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    for (const target of collectResolvedModuleTargets(current)) {
      targets.push(target);
      const path = target.targetPath;
      const shared = path.startsWith("src/lib/") || path.startsWith("src/types/")
        || path.startsWith("src/mediator/");
      if (!shared || visited.has(path) || path.startsWith("src/lib/local-runtime/production/")
        || path === "src/lib/browser/browser-authority-api.ts"
        || path === "src/mediator/product-plugin-catalog.ts") continue;
      visited.add(path);
      const next = scopedSources.get(path);
      if (!next) throw new Error(`ARCHITECTURE_SHARED_IMPORT_OUTSIDE_SOURCE_SCOPE:${path}`);
      pending.push(next);
    }
  }
  for (const target of targets) {
    if (target.targetPath === "src/mediator/product-plugin-catalog.ts") {
      pushBoundaryFinding(findings, {
        checkId: "architecture/product-imports-catalog",
        lawId: jobFlowLawId,
        repoPath,
        targetPath: target.targetPath,
        message: `${repoPath} imports the cross-Product Catalog instead of its Product-facing contract.`,
      });
      continue;
    }
    if (!target.targetPath.startsWith("src/lib/local-runtime/production/")) continue;
    pushBoundaryFinding(findings, {
      checkId: "architecture/product-imports-runtime-private",
      lawId: jobFlowLawId,
      repoPath,
      targetPath: target.targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} Runtime-private production code ${target.targetPath}.`,
    });
  }
};

export const inspectPluginBoundaries = (
  findings: InspectorFinding[],
  jobFlowLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!isJobPluginPath(repoPath)) {
    if (isTopLevelPluginFile(repoPath)) {
      pushBoundaryFinding(findings, {
        checkId: "architecture/plugin-root-file",
        lawId: jobFlowLawId,
        repoPath,
        message: `${repoPath} is a top-level plugin file outside src/plugins/<job-id>/.`,
      });
    }
    return;
  }
  inspectCrossJobImports(findings, jobFlowLawId, repoPath, sourceFile);
  inspectNonFacadeCapabilityImports(findings, jobFlowLawId, repoPath, sourceFile);
  inspectRuntimePrivateImports(findings, jobFlowLawId, repoPath, sourceFile);
};

export const inspectChildAbilityImports = (
  findings: InspectorFinding[],
  childAbilityLawId: string,
  repoPath: string,
  sourceFile: ArchitectureSourceFile,
): void => {
  if (!isPrivateCapabilityPath(repoPath)) {
    return;
  }
  const sourceCapabilityRoot = resolveOwnerRoot(repoPath, 2);
  for (const target of collectResolvedModuleTargets(sourceFile)) {
    const targetPath = target.targetPath;
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    const targetCapabilityRoot = resolveOwnerRoot(targetPath, 2);
    if (!targetCapabilityRoot || targetCapabilityRoot === sourceCapabilityRoot) {
      continue;
    }
    pushBoundaryFinding(findings, {
      checkId: "architecture/child-ability-cross-owner-import",
      lawId: childAbilityLawId,
      repoPath,
      targetPath,
      message: `${repoPath} ${describeEdgeVerb(target.edgeKind)} unrelated capability owner code ${targetPath}.`,
    });
  }
};
