import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { isTopLevelPluginFile } from "../../../shared/no-regex.js";
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
