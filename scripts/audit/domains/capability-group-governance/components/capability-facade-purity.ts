import type { ExportDeclaration, SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import {
  buildCapabilityRoot,
  classifyRepoPath,
  isCapabilityPrivateImplementationSection,
} from "../../../shared/repo-path-classifier.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

import { resolveCapabilityFacadePolicy } from "./capability-source-of-truth.js";

type CapabilityGroupFindingInput = Parameters<typeof createFinding>[0];
type CapabilityFacadePolicy = ReturnType<typeof resolveCapabilityFacadePolicy>;
type PushFinding = (input: CapabilityGroupFindingInput) => void;

const isFactoryContractValueExportAllowed = (capabilityRoot: string, targetPath: string): boolean =>
  targetPath === `${capabilityRoot}/ability-group.ts`
    || targetPath === `${capabilityRoot}/schema.ts`;

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

const isAllowedDomPublicChildExport = (input: {
  exportedNames: readonly string[];
  hasRuntimeValueExport: boolean;
  policy: CapabilityFacadePolicy;
}): boolean => input.policy.mode === "public-child-functions"
  && input.hasRuntimeValueExport
  && input.exportedNames.length > 0
  && input.exportedNames.every((name) => input.policy.allowedPublicChildFunctionExports?.has(name) ?? false);

const pushPrivateCapabilityReExportFinding = (input: {
  capabilityOwner: string;
  exportedNames: readonly string[];
  facadeLawId: string;
  hasRuntimeValueExport: boolean;
  policy: CapabilityFacadePolicy;
  pushFinding: PushFinding;
  repoPath: string;
  targetPath: string;
  targetPathInfo: ReturnType<typeof classifyRepoPath>;
}): boolean => {
  if (
    input.targetPathInfo.kind !== "capability"
    || input.targetPathInfo.owner !== input.capabilityOwner
    || !isCapabilityPrivateImplementationSection(input.targetPathInfo)
  ) {
    return false;
  }
  if (isAllowedDomPublicChildExport({
    exportedNames: input.exportedNames,
    hasRuntimeValueExport: input.hasRuntimeValueExport,
    policy: input.policy,
  })) {
    return true;
  }
  input.pushFinding({
    checkId: "capability-group/facade-private-runtime-export",
    lawId: input.facadeLawId,
    filePath: input.repoPath,
    evidence: input.targetPath,
    message: `${input.repoPath} re-exports private capability implementation ${input.targetPath}.`,
  });
  return true;
};

const pushRegistryReExportFinding = (input: {
  capabilityOwner: string;
  facadeLawId: string;
  pushFinding: PushFinding;
  repoPath: string;
  targetPath: string;
  targetPathInfo: ReturnType<typeof classifyRepoPath>;
}): boolean => {
  if (
    input.targetPathInfo.kind !== "capability"
    || input.targetPathInfo.owner !== input.capabilityOwner
    || input.targetPathInfo.section !== "registry"
  ) {
    return false;
  }
  input.pushFinding({
    checkId: "capability-group/facade-registry-export",
    lawId: input.facadeLawId,
    filePath: input.repoPath,
    evidence: input.targetPath,
    message: `${input.repoPath} re-exports private registry surface ${input.targetPath}.`,
  });
  return true;
};

const pushNonContractValueExportFinding = (input: {
  capabilityRoot: string;
  facadeLawId: string;
  hasRuntimeValueExport: boolean;
  policy: CapabilityFacadePolicy;
  pushFinding: PushFinding;
  repoPath: string;
  targetPath: string;
}): void => {
  if (
    !input.hasRuntimeValueExport
    || input.policy.mode !== "factory-contract"
    || isFactoryContractValueExportAllowed(input.capabilityRoot, input.targetPath)
  ) {
    return;
  }
  input.pushFinding({
    checkId: "capability-group/facade-noncontract-value-export",
    lawId: input.facadeLawId,
    filePath: input.repoPath,
    evidence: input.targetPath,
    message: `${input.repoPath} exports runtime value surface ${input.targetPath} instead of a factory-only public facade.`,
  });
};

type FacadePurityContext = {
  capabilityOwner: string;
  capabilityRoot: string;
  facadeLawId: string;
  policy: CapabilityFacadePolicy;
  pushFinding: PushFinding;
  repoPath: string;
  sourceFile: SourceFile;
};

const pushFacadeExportDeclarationFindings = (input: FacadePurityContext): void => {
  for (const exportDeclaration of input.sourceFile.getExportDeclarations()) {
    const moduleSpecifierValue = exportDeclaration.getModuleSpecifierValue();
    if (!moduleSpecifierValue) {
      continue;
    }
    const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetPathInfo = classifyRepoPath(targetPath);
    const exportedNames = exportDeclaration.getNamedExports().map((namedExport) => namedExport.getName());
    const hasRuntimeValueExport = isRuntimeValueExportDeclaration(exportDeclaration);

    if (pushPrivateCapabilityReExportFinding({
      capabilityOwner: input.capabilityOwner,
      exportedNames,
      facadeLawId: input.facadeLawId,
      hasRuntimeValueExport,
      policy: input.policy,
      pushFinding: input.pushFinding,
      repoPath: input.repoPath,
      targetPath,
      targetPathInfo,
    })) {
      continue;
    }

    if (pushRegistryReExportFinding({
      capabilityOwner: input.capabilityOwner,
      facadeLawId: input.facadeLawId,
      pushFinding: input.pushFinding,
      repoPath: input.repoPath,
      targetPath,
      targetPathInfo,
    })) {
      continue;
    }

    pushNonContractValueExportFinding({
      capabilityRoot: input.capabilityRoot,
      facadeLawId: input.facadeLawId,
      hasRuntimeValueExport,
      policy: input.policy,
      pushFinding: input.pushFinding,
      repoPath: input.repoPath,
      targetPath,
    });
  }
};

const pushFacadePrivateSymbolEscapeFindings = (input: FacadePurityContext): void => {
  for (const exportSymbol of input.sourceFile.getExportSymbols()) {
    const declarationPath = exportSymbol.getDeclarations()
      .map((declaration) => getRepoSourcePath(declaration.getSourceFile()))
      .find((candidatePath) => {
        const candidateInfo = classifyRepoPath(candidatePath);
        return candidateInfo.kind === "capability"
          && candidateInfo.owner === input.capabilityOwner
          && isCapabilityPrivateImplementationSection(candidateInfo);
      });
    if (!declarationPath) {
      continue;
    }
    if (
      input.policy.mode === "public-child-functions"
      && (input.policy.allowedPublicChildFunctionExports?.has(exportSymbol.getName()) ?? false)
    ) {
      continue;
    }
    input.pushFinding({
      checkId: "capability-group/facade-private-symbol-escape",
      lawId: input.facadeLawId,
      filePath: input.repoPath,
      evidence: declarationPath,
      message: `${input.repoPath} exports symbol ${exportSymbol.getName()} declared in private capability implementation ${declarationPath}.`,
    });
  }
};

export const pushFacadePurityFindings = (
  sourceFile: SourceFile,
  repoPath: string,
  capabilityRoot: string,
  facadeLawId: string,
  pushFinding: PushFinding,
): void => {
  const policy = resolveCapabilityFacadePolicy(capabilityRoot);
  const capabilityRootInfo = classifyRepoPath(`${capabilityRoot}/index.ts`);
  if (capabilityRootInfo.kind !== "capability") {
    return;
  }
  const context: FacadePurityContext = {
    capabilityOwner: capabilityRootInfo.owner,
    capabilityRoot,
    facadeLawId,
    policy,
    pushFinding,
    repoPath,
    sourceFile,
  };

  pushFacadeExportDeclarationFindings(context);
  pushFacadePrivateSymbolEscapeFindings(context);
};
