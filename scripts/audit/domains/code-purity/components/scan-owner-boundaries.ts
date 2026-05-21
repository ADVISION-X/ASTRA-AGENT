import type { ImportDeclaration } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
import { toRepoPath } from "../../../shared/paths.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import {
  type GovernedFile,
} from "./code-purity-governed-files.js";
import {
  createInventoryFindingCollector,
  type InventoryFindingCollector,
} from "./code-purity-finding-collector.js";
import {
  resolveCodePurityOwner,
} from "./code-purity-owner-model.js";
import type { CodePurityInventoryItem } from "./code-purity-report-writer.js";

const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;

type OwnerBoundaryScanResult = {
  findings: InspectorFinding[];
  inventoryItems: CodePurityInventoryItem[];
};

const resolveDirectImportPath = (importDeclaration: ImportDeclaration): string | undefined => {
  const sourceFile = importDeclaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoPath(sourceFile.getFilePath()) : undefined;
};

const remediationForBoundary = (owner: string): string =>
  owner.startsWith("plugin:")
    ? "Route business flow through the public ability facade and keep private runtime children out of the plugin owner."
    : "Move the import back behind the lawful owner boundary or split the mixed-role file by owner.";

const pushBoundaryFinding = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  checkId: string,
  lawId: string,
  reason: string,
  message: string,
): void => {
  collector.push(
    {
      checkId,
      filePath: governedFile.repoPath,
      lawId,
      owner: governedFile.owner,
      reason,
      remediation: remediationForBoundary(governedFile.owner),
      role: governedFile.role,
      verificationCommand: "npm run ci:full",
    },
    message,
  );
};

const scanCapabilityBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTargetPath: string,
  abilityLawId: string,
): void => {
  if (governedFile.repoPath.startsWith("src/capabilities/") && directTargetPath.startsWith("src/plugins/")) {
    pushBoundaryFinding(
      collector,
      governedFile,
      "code-purity/capability-imports-plugin",
      abilityLawId,
      `Capability owner imports plugin-owned code ${directTargetPath}.`,
      `${governedFile.repoPath} imports plugin-owned code ${directTargetPath}.`,
    );
  }
};

const scanPluginBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTargetPath: string,
  jobFlowLawId: string,
): void => {
  if (governedFile.repoPath.startsWith("src/plugins/") && privateCapabilityPathPattern.test(directTargetPath)) {
    pushBoundaryFinding(
      collector,
      governedFile,
      "code-purity/plugin-private-capability-import",
      jobFlowLawId,
      `Plugin directly imports private capability runtime ${directTargetPath}.`,
      `${governedFile.repoPath} imports private ability runtime or child file ${directTargetPath}.`,
    );
  }
};

const scanMediatorBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTargetPath: string,
  mediatorLawId: string,
): void => {
  if (
    governedFile.repoPath.startsWith("src/mediator/") &&
    (directTargetPath.startsWith("src/lib/browser/") || privateCapabilityPathPattern.test(directTargetPath))
  ) {
    pushBoundaryFinding(
      collector,
      governedFile,
      "code-purity/mediator-runtime-import",
      mediatorLawId,
      `Mediator imports runtime implementation ${directTargetPath}.`,
      `${governedFile.repoPath} imports browser or private runtime code ${directTargetPath}.`,
    );
  }
};

const scanChildAbilityBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTargetPath: string,
  directTargetOwner: string,
  childAbilityLawId: string,
): void => {
  if (
    /^src\/capabilities\/[^/]+\/(runtime|children)\//u.test(governedFile.repoPath) &&
    /^capability:/u.test(directTargetOwner) &&
    directTargetOwner !== governedFile.owner
  ) {
    pushBoundaryFinding(
      collector,
      governedFile,
      "code-purity/child-ability-cross-owner-import",
      childAbilityLawId,
      `Child ability imports unrelated capability owner ${directTargetPath}.`,
      `${governedFile.repoPath} imports unrelated capability owner code ${directTargetPath}.`,
    );
  }
};

const scanSharedBoundary = (
  collector: InventoryFindingCollector,
  governedFile: GovernedFile,
  directTargetPath: string,
  sharedScopeLawId: string,
): void => {
  if (governedFile.repoPath.startsWith("src/lib/") && !governedFile.repoPath.startsWith("src/lib/local-runtime/") && directTargetPath.startsWith("src/plugins/")) {
    pushBoundaryFinding(
      collector,
      governedFile,
      "code-purity/shared-scope-plugin-import",
      sharedScopeLawId,
      `Shared infrastructure imports plugin-owned code ${directTargetPath}.`,
      `${governedFile.repoPath} imports plugin-owned business flow code ${directTargetPath}.`,
    );
  }
};

export const scanOwnerBoundaries = (governedFiles: readonly GovernedFile[], lawIds: readonly string[]): OwnerBoundaryScanResult => {
  const jobFlowLawId = selectLawId(lawIds, "APEX-CODE-PURITY-004-V1");
  const mediatorLawId = selectLawId(lawIds, "APEX-CODE-PURITY-005-V1");
  const abilityLawId = selectLawId(lawIds, "APEX-CODE-PURITY-006-V1");
  const childAbilityLawId = selectLawId(lawIds, "APEX-CODE-PURITY-007-V1");
  const sharedScopeLawId = selectLawId(lawIds, "APEX-CODE-PURITY-011-V1");
  const collector = createInventoryFindingCollector();

  for (const governedFile of governedFiles) {
    for (const importDeclaration of governedFile.sourceFile.getImportDeclarations()) {
      const directTargetPath = resolveDirectImportPath(importDeclaration);
      if (!directTargetPath || !directTargetPath.startsWith("src/")) {
        continue;
      }
      const directTargetOwner = resolveCodePurityOwner(directTargetPath);
      scanCapabilityBoundary(collector, governedFile, directTargetPath, abilityLawId);
      scanPluginBoundary(collector, governedFile, directTargetPath, jobFlowLawId);
      scanMediatorBoundary(collector, governedFile, directTargetPath, mediatorLawId);
      scanChildAbilityBoundary(collector, governedFile, directTargetPath, directTargetOwner, childAbilityLawId);
      scanSharedBoundary(collector, governedFile, directTargetPath, sharedScopeLawId);
    }
  }

  return { findings: collector.findings, inventoryItems: collector.inventoryItems };
};