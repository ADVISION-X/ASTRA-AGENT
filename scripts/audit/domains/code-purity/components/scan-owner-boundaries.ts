import { selectLawId } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import {
  collectResolvedModuleTargets,
  type SourceModuleTarget,
} from "../../../shared/source-module-targets.js";
import {
  type GovernedFile,
} from "./code-purity-governed-files.js";
import {
  createInventoryFindingCollector,
  type InventoryFindingCollector,
} from "./code-purity-finding-collector.js";
import {
  normalizeCodePurityPath,
  resolveCodePurityOwner,
} from "./code-purity-owner-model.js";
import type { CodePurityInventoryItem } from "./code-purity-inventory.js";

const getPathSegments = (repoPath: string): string[] => repoPath.split("/").filter((segment) => segment.length > 0);

const isPrivateCapabilityPath = (repoPath: string): boolean => {
  const normalizedPath = normalizeCodePurityPath(repoPath);
  if (!normalizedPath.startsWith("src/capabilities/")) {
    return false;
  }
  const segments = getPathSegments(normalizedPath);
  return segments.length >= 5 && (segments[3] === "runtime" || segments[3] === "children");
};

const isPublicCapabilityFacadePath = (repoPath: string): boolean => {
  const normalizedPath = normalizeCodePurityPath(repoPath);
  if (!normalizedPath.startsWith("src/capabilities/")) {
    return false;
  }
  const segments = getPathSegments(normalizedPath);
  return segments.length === 4 && segments[3] === "index.ts";
};

const isCapabilityOwner = (owner: string): boolean => owner.startsWith("capability:");

const isPluginOwner = (owner: string): boolean => owner.startsWith("plugin:");

const describeEdgeVerb = (edgeKind: SourceModuleTarget["edgeKind"]): string =>
  edgeKind === "re-export"
    ? "re-exports"
    : edgeKind === "dynamic-import"
      ? "dynamically imports"
      : edgeKind === "side-effect-import"
        ? "side-effect imports"
        : "imports";

type OwnerBoundaryScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
};

const remediationForBoundary = (owner: string): string =>
  owner.startsWith("plugin:")
    ? "Route business flow through the public ability facade and keep private runtime children out of the plugin owner."
    : "Move the import back behind the lawful owner boundary or split the mixed-role file by owner.";

const pushBoundaryFinding = (
  collector: InventoryFindingCollector,
  input: {
    checkId: string;
    governedFile: GovernedFile;
    lawId: string;
    reason: string;
    message: string;
  },
): void => {
  collector.push(
    {
      checkId: input.checkId,
      evidenceMode: "static.dependency",
      filePath: input.governedFile.repoPath,
      lawId: input.lawId,
      owner: input.governedFile.owner,
      reason: input.reason,
      remediation: remediationForBoundary(input.governedFile.owner),
      role: input.governedFile.role,
      verificationCommand: "npm run quality:check -- READY",
    },
    input.message,
  );
};

const scanCapabilityBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTarget: SourceModuleTarget,
  directTargetOwner: string,
  abilityLawId: string,
): void => {
  const sourcePath = normalizeCodePurityPath(governedFile.repoPath);
  const targetPath = normalizeCodePurityPath(directTarget.targetPath);
  if (sourcePath.startsWith("src/capabilities/") && targetPath.startsWith("src/plugins/")) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/capability-imports-plugin",
      governedFile,
      lawId: abilityLawId,
      reason: `Capability owner ${describeEdgeVerb(directTarget.edgeKind)} plugin-owned code ${directTarget.targetPath}.`,
      message: `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} plugin-owned code ${directTarget.targetPath}.`,
    });
  }
  if (
    sourcePath.startsWith("src/capabilities/") &&
    isCapabilityOwner(directTargetOwner) &&
    directTargetOwner !== governedFile.owner
  ) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/capability-cross-owner-import",
      governedFile,
      lawId: abilityLawId,
      reason: `Capability owner ${describeEdgeVerb(directTarget.edgeKind)} unrelated capability owner ${directTarget.targetPath}.`,
      message: `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} unrelated capability owner code ${directTarget.targetPath}.`,
    });
  }
};

const scanPluginBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTarget: SourceModuleTarget,
  directTargetOwner: string,
  jobFlowLawId: string,
): void => {
  const sourcePath = normalizeCodePurityPath(governedFile.repoPath);
  const targetPath = normalizeCodePurityPath(directTarget.targetPath);
  if (
    sourcePath.startsWith("src/plugins/") &&
    targetPath.startsWith("src/capabilities/") &&
    !isPublicCapabilityFacadePath(targetPath)
  ) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/plugin-non-facade-capability-import",
      governedFile,
      lawId: jobFlowLawId,
      reason: isPrivateCapabilityPath(targetPath)
        ? `Plugin directly ${describeEdgeVerb(directTarget.edgeKind)} private capability runtime ${directTarget.targetPath}.`
        : `Plugin directly ${describeEdgeVerb(directTarget.edgeKind)} non-facade capability file ${directTarget.targetPath}.`,
      message: isPrivateCapabilityPath(targetPath)
        ? `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} private ability runtime or child file ${directTarget.targetPath}.`
        : `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} non-facade ability-group code ${directTarget.targetPath}.`,
    });
  }
  if (
    sourcePath.startsWith("src/plugins/") &&
    isPluginOwner(directTargetOwner) &&
    directTargetOwner !== governedFile.owner
  ) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/plugin-cross-owner-import",
      governedFile,
      lawId: jobFlowLawId,
      reason: `Plugin owner ${describeEdgeVerb(directTarget.edgeKind)} unrelated plugin owner ${directTarget.targetPath}.`,
      message: `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} unrelated plugin owner code ${directTarget.targetPath}.`,
    });
  }
};

const scanMediatorBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTarget: SourceModuleTarget,
  mediatorLawId: string,
): void => {
  const sourcePath = normalizeCodePurityPath(governedFile.repoPath);
  if (
    sourcePath.startsWith("src/mediator/") &&
    (directTarget.targetPath.startsWith("src/lib/browser/") || isPrivateCapabilityPath(directTarget.targetPath))
  ) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/mediator-runtime-import",
      governedFile,
      lawId: mediatorLawId,
      reason: `Mediator ${describeEdgeVerb(directTarget.edgeKind)} runtime implementation ${directTarget.targetPath}.`,
      message: `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} browser or private runtime code ${directTarget.targetPath}.`,
    });
  }
};

const scanChildAbilityBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTarget: SourceModuleTarget,
  directTargetOwner: string,
  childAbilityLawId: string,
): void => {
  const sourcePath = normalizeCodePurityPath(governedFile.repoPath);
  if (
    isPrivateCapabilityPath(sourcePath) &&
    isCapabilityOwner(directTargetOwner) &&
    directTargetOwner !== governedFile.owner
  ) {
    pushBoundaryFinding(collector, {
      checkId: "code-purity/child-ability-cross-owner-import",
      governedFile,
      lawId: childAbilityLawId,
      reason: `Child ability ${describeEdgeVerb(directTarget.edgeKind)} unrelated capability owner ${directTarget.targetPath}.`,
      message: `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} unrelated capability owner code ${directTarget.targetPath}.`,
    });
  }
};

const scanSharedBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTarget: SourceModuleTarget,
  sharedScopeLawId: string,
): void => {
  const sourcePath = normalizeCodePurityPath(governedFile.repoPath);
  const targetPath = normalizeCodePurityPath(directTarget.targetPath);
  if (
    sourcePath.startsWith("src/lib/") &&
    !sourcePath.startsWith("src/lib/local-runtime/") &&
    (targetPath.startsWith("src/plugins/") || targetPath.startsWith("src/capabilities/"))
  ) {
    pushBoundaryFinding(collector, {
      checkId: targetPath.startsWith("src/plugins/")
        ? "code-purity/shared-scope-plugin-import"
        : "code-purity/shared-scope-capability-import",
      governedFile,
      lawId: sharedScopeLawId,
      reason: targetPath.startsWith("src/plugins/")
        ? `Shared infrastructure ${describeEdgeVerb(directTarget.edgeKind)} plugin-owned code ${directTarget.targetPath}.`
        : `Shared infrastructure ${describeEdgeVerb(directTarget.edgeKind)} capability-owned code ${directTarget.targetPath}.`,
      message: targetPath.startsWith("src/plugins/")
        ? `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} plugin-owned business flow code ${directTarget.targetPath}.`
        : `${governedFile.repoPath} ${describeEdgeVerb(directTarget.edgeKind)} capability-owned code ${directTarget.targetPath}.`,
    });
  }
};

export const scanOwnerBoundaries = (governedFiles: readonly GovernedFile[], lawIds: readonly string[]): OwnerBoundaryScanResult => {
  const jobFlowLawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const mediatorLawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const abilityLawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const childAbilityLawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const sharedScopeLawId = selectLawId(lawIds, "LAW-CODE-PURITY-002-V1");
  const collector = createInventoryFindingCollector();

  for (const governedFile of governedFiles) {
    for (const directTarget of collectResolvedModuleTargets(governedFile.sourceFile)) {
      if (!normalizeCodePurityPath(directTarget.targetPath).startsWith("src/")) {
        continue;
      }
      const directTargetOwner = resolveCodePurityOwner(directTarget.targetPath);
      scanCapabilityBoundary(collector, governedFile, directTarget, directTargetOwner, abilityLawId);
      scanPluginBoundary(collector, governedFile, directTarget, directTargetOwner, jobFlowLawId);
      scanMediatorBoundary(collector, governedFile, directTarget, mediatorLawId);
      scanChildAbilityBoundary(collector, governedFile, directTarget, directTargetOwner, childAbilityLawId);
      scanSharedBoundary(collector, governedFile, directTarget, sharedScopeLawId);
    }
  }

  return { findings: collector.findings, inventoryItems: collector.inventoryItems };
};
