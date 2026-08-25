import { Node, SyntaxKind, type ImportDeclaration, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation } from "../../shared/inspector-contracts.js";
import { staticLawCoverage } from "../../shared/static-inspector-result.js";
import {
  buildCapabilityRoot,
  classifyRepoPath,
  isCapabilityFacade,
  isCapabilityNonFacade,
  isCapabilityPrivateImplementationSection,
  isExternalCapabilityConsumer,
} from "../../shared/repo-path-classifier.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";
import { resolveCapabilityFacadePolicy } from "../capability-governance/components/capability-source-of-truth.js";

type Finding = ReturnType<typeof createFinding>;

const forbiddenProtocolKeys = new Set([
  "abilityGroupId",
  "childCapabilityId",
  "capabilityCallId",
  "artifactDisposition",
]);

const protocolContextKeys = new Set([
  "missionId",
  "runId",
  "roundId",
  "sessionId",
  "sourcePageUrl",
  "preferredQuality",
  "maxBytes",
  "timeoutMs",
  "downloadSubtitles",
]);

const createDedupedFindingPusher = (findings: Finding[]) => {
  const findingKeys = new Set<string>();
  return (finding: Parameters<typeof createFinding>[0]): void => {
    const key = `${finding.checkId}:${finding.filePath ?? ""}:${finding.message}`;
    if (findingKeys.has(key)) {
      return;
    }
    findingKeys.add(key);
    findings.push(createFinding(finding));
  };
};

const readObjectLiteralPropertyNames = (objectLiteral: ObjectLiteralExpression): Set<string> => {
  const names = new Set<string>();
  for (const property of objectLiteral.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      names.add(property.getName());
      continue;
    }
    if (Node.isShorthandPropertyAssignment(property)) {
      names.add(property.getName());
    }
  }
  return names;
};

const isExecuteCallArgument = (objectLiteral: ObjectLiteralExpression): boolean => {
  const parent = objectLiteral.getParent();
  if (!parent || !Node.isCallExpression(parent)) {
    return false;
  }
  const expression = parent.getExpression();
  return (Node.isIdentifier(expression)
      && expression.getSymbol()?.getEscapedName().toString() === "execute")
    || (Node.isPropertyAccessExpression(expression) && expression.getName() === "execute");
};

const resolvePrivateDeclarationPath = (input: {
  exportedName: string;
  targetCapabilityOwner: string;
  targetSourceFile: SourceFile;
}): string | undefined => {
  const symbolDeclarationPath = input.targetSourceFile
    .getExportSymbols()
    .filter((symbol) => symbol.getName() === input.exportedName)
    .flatMap((symbol) => symbol.getDeclarations())
    .map((declaration) => getRepoSourcePath(declaration.getSourceFile()))
    .find((candidatePath) => {
      const candidateInfo = classifyRepoPath(candidatePath);
      return candidateInfo.kind === "capability"
        && candidateInfo.owner === input.targetCapabilityOwner
        && isCapabilityPrivateImplementationSection(candidateInfo);
    });
  if (symbolDeclarationPath) {
    return symbolDeclarationPath;
  }

  for (const exportDeclaration of input.targetSourceFile.getExportDeclarations()) {
    const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const namedExports = exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText());
    if (!namedExports.includes(input.exportedName)) {
      continue;
    }
    const candidatePath = getRepoSourcePath(targetSourceFile);
    const candidateInfo = classifyRepoPath(candidatePath);
    if (
      candidateInfo.kind === "capability"
      && candidateInfo.owner === input.targetCapabilityOwner
      && isCapabilityPrivateImplementationSection(candidateInfo)
    ) {
      return candidatePath;
    }
  }

  return undefined;
};

const inspectFacadeExports = (input: {
  facadeLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  sourceFile: SourceFile;
}): void => {
  const repoPath = getRepoSourcePath(input.sourceFile);
  const pathInfo = classifyRepoPath(repoPath);
  if (!isCapabilityFacade(pathInfo)) {
    return;
  }

  const policy = resolveCapabilityFacadePolicy(buildCapabilityRoot(pathInfo.owner));
  const facadeContext = {
    facadeLawId: input.facadeLawId,
    owner: pathInfo.owner,
    policy,
    pushFinding: input.pushFinding,
    repoPath,
    sourceFile: input.sourceFile,
  };

  inspectFacadeReExportDeclarations(facadeContext);
  inspectFacadeExportSymbols(facadeContext);
};

const inspectFacadeReExportDeclarations = (input: {
  facadeLawId: string;
  owner: string;
  policy: ReturnType<typeof resolveCapabilityFacadePolicy>;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  repoPath: string;
  sourceFile: SourceFile;
}): void => {
  for (const exportDeclaration of input.sourceFile.getExportDeclarations()) {
    const targetSourceFile = exportDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (
      targetInfo.kind !== "capability"
      || targetInfo.owner !== input.owner
      || !isCapabilityPrivateImplementationSection(targetInfo)
    ) {
      continue;
    }
    const exportedNames = exportDeclaration.getNamedExports().map((namedExport) => namedExport.getNameNode().getText());
    const domPublicChildExportAllowed = input.policy.mode === "public-child-functions"
      && exportedNames.length > 0
      && exportedNames.every((name) => input.policy.allowedPublicChildFunctionExports?.has(name) ?? false);
    if (domPublicChildExportAllowed) {
      continue;
    }
    input.pushFinding({
      checkId: "constitutional-boundary/facade-private-symbol-export",
      lawId: input.facadeLawId,
      filePath: input.repoPath,
      evidence: targetPath,
      message: `${input.repoPath} re-exports private capability implementation ${targetPath}.`,
    });
  }
};

const inspectFacadeExportSymbols = (input: {
  facadeLawId: string;
  owner: string;
  policy: ReturnType<typeof resolveCapabilityFacadePolicy>;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  repoPath: string;
  sourceFile: SourceFile;
}): void => {
  for (const exportSymbol of input.sourceFile.getExportSymbols()) {
    if (
      input.policy.mode === "public-child-functions"
      && (input.policy.allowedPublicChildFunctionExports?.has(exportSymbol.getName()) ?? false)
    ) {
      continue;
    }
    const declarationPath = exportSymbol.getDeclarations()
      .map((declaration) => getRepoSourcePath(declaration.getSourceFile()))
      .find((candidatePath) => {
        const candidateInfo = classifyRepoPath(candidatePath);
        return candidateInfo.kind === "capability"
          && candidateInfo.owner === input.owner
          && isCapabilityPrivateImplementationSection(candidateInfo);
      });
    if (!declarationPath) {
      continue;
    }
    input.pushFinding({
      checkId: "constitutional-boundary/facade-private-symbol-export",
      lawId: input.facadeLawId,
      filePath: input.repoPath,
      evidence: declarationPath,
      message: `${input.repoPath} exports symbol ${exportSymbol.getName()} declared in private capability implementation ${declarationPath}.`,
    });
  }
};

const pushExternalNonFacadeCapabilityImportFinding = (input: {
  boundaryLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  repoPath: string;
  targetInfo: ReturnType<typeof classifyRepoPath>;
  targetPath: string;
}): boolean => {
  if (!isCapabilityNonFacade(input.targetInfo)) {
    return false;
  }
  input.pushFinding({
    checkId: isCapabilityPrivateImplementationSection(input.targetInfo)
      ? "constitutional-boundary/external-private-import"
      : "constitutional-boundary/external-non-facade-import",
    lawId: input.boundaryLawId,
    filePath: input.repoPath,
    evidence: input.targetPath,
    message: isCapabilityPrivateImplementationSection(input.targetInfo)
      ? `${input.repoPath} imports private capability implementation ${input.targetPath}.`
      : `${input.repoPath} imports non-facade capability code ${input.targetPath}.`,
  });
  return true;
};

const inspectFacadeNamedImports = (input: {
  facadeLawId: string;
  importDeclaration: ImportDeclaration;
  policy: ReturnType<typeof resolveCapabilityFacadePolicy>;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  repoPath: string;
  targetOwner: string;
  targetPath: string;
  targetSourceFile: SourceFile;
}): void => {
  for (const namedImport of input.importDeclaration.getNamedImports()) {
    const importedName = namedImport.getNameNode().getText();
    const declarationPath = resolvePrivateDeclarationPath({
      exportedName: importedName,
      targetCapabilityOwner: input.targetOwner,
      targetSourceFile: input.targetSourceFile,
    });

    if (!declarationPath) {
      continue;
    }
    if (
      input.policy.mode === "public-child-functions"
      && (input.policy.allowedPublicChildFunctionExports?.has(importedName) ?? false)
    ) {
      continue;
    }
    input.pushFinding({
      checkId: "constitutional-boundary/facade-private-symbol-import",
      lawId: input.facadeLawId,
      filePath: input.repoPath,
      evidence: `${input.targetPath}:${importedName}:${declarationPath}`,
      message: `${input.repoPath} imports facade symbol ${importedName} from ${input.targetPath}, but the symbol is declared in private capability implementation ${declarationPath}.`,
    });
  }
};

const inspectExternalConsumerImports = (input: {
  boundaryLawId: string;
  facadeLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  sourceFile: SourceFile;
}): void => {
  const repoPath = getRepoSourcePath(input.sourceFile);
  const consumerInfo = classifyRepoPath(repoPath);
  if (!isExternalCapabilityConsumer(consumerInfo)) {
    return;
  }

  for (const importDeclaration of input.sourceFile.getImportDeclarations()) {
    const targetSourceFile = importDeclaration.getModuleSpecifierSourceFile();
    if (!targetSourceFile) {
      continue;
    }
    const targetPath = getRepoSourcePath(targetSourceFile);
    const targetInfo = classifyRepoPath(targetPath);
    if (targetInfo.kind !== "capability") {
      continue;
    }

    if (pushExternalNonFacadeCapabilityImportFinding({
      boundaryLawId: input.boundaryLawId,
      pushFinding: input.pushFinding,
      repoPath,
      targetInfo,
      targetPath,
    })) {
      continue;
    }

    if (!isCapabilityFacade(targetInfo)) {
      continue;
    }

    inspectFacadeNamedImports({
      facadeLawId: input.facadeLawId,
      importDeclaration,
      policy: resolveCapabilityFacadePolicy(buildCapabilityRoot(targetInfo.owner)),
      pushFinding: input.pushFinding,
      repoPath,
      targetOwner: targetInfo.owner,
      targetPath,
      targetSourceFile,
    });
  }
};

const inspectProtocolObjectLiterals = (input: {
  protocolLawId: string;
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
  sourceFile: SourceFile;
}): void => {
  const repoPath = getRepoSourcePath(input.sourceFile);
  const consumerInfo = classifyRepoPath(repoPath);
  if (!isExternalCapabilityConsumer(consumerInfo)) {
    return;
  }

  for (const objectLiteral of input.sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
    const propertyNames = readObjectLiteralPropertyNames(objectLiteral);
    const matchedForbiddenKeys = [...propertyNames].filter((name) => forbiddenProtocolKeys.has(name));
    if (matchedForbiddenKeys.length === 0) {
      continue;
    }
    const hasExecutionContext = [...propertyNames].some((name) => protocolContextKeys.has(name));
    if (!hasExecutionContext && !isExecuteCallArgument(objectLiteral)) {
      continue;
    }
    input.pushFinding({
      checkId: "constitutional-boundary/private-capability-protocol",
      lawId: input.protocolLawId,
      filePath: repoPath,
      evidence: matchedForbiddenKeys.join(", "),
      message: `${repoPath} constructs private capability protocol keys outside the owning capability: ${matchedForbiddenKeys.join(", ")}.`,
    });
  }
};

export const inspectConstitutionalBoundary = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const boundaryLawId = selectLawId(context.planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1");
  const facadeLawId = selectLawId(context.planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1");
  const protocolLawId = selectLawId(context.planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1");
  const findings: Finding[] = [];
  const inspectedFiles = new Set<string>();
  const pushFinding = createDedupedFindingPusher(findings);

  for (const sourceFile of listActiveSourceFiles(context.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    inspectedFiles.add(repoPath);
    inspectFacadeExports({
      facadeLawId,
      pushFinding,
      sourceFile,
    });
    inspectExternalConsumerImports({
      boundaryLawId,
      facadeLawId,
      pushFinding,
      sourceFile,
    });
    inspectProtocolObjectLiterals({
      protocolLawId,
      pushFinding,
      sourceFile,
    });
  }

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    coverage: [staticLawCoverage("LAW-ARCHITECTURE-BOUNDARY-001-V1", 7, [
      "static.filesystem", "static.ast", "static.types", "static.dependency",
    ], [0, 1, 2, 3, 4, 5, 6])],
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};
