import { Node, SyntaxKind, type CallExpression, type ImportSpecifier, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

const REQUIRED_INSPECTOR_CALLS = [
  {
    localName: "validateGeneratedArtifacts",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts",
    importPath: "./validate-generated-artifacts.js",
    importName: "validateGeneratedArtifacts",
  },
  {
    localName: "validateRequiredPhaseDomains",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts",
    importPath: "./validate-required-phase-domains.js",
    importName: "validateRequiredPhaseDomains",
  },
  {
    localName: "validateStaticClauseCoverage",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts",
    importPath: "./validate-static-clause-coverage.js",
    importName: "validateStaticClauseCoverage",
  },
  {
    localName: "validateNoSimulatedProductionPaths",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts",
    importPath: "./validate-no-simulated-production-paths.js",
    importName: "validateNoSimulatedProductionPaths",
  },
  {
    localName: "validateNegativeProofWiring",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts",
    importPath: "./validate-negative-proof-wiring.js",
    importName: "validateNegativeProofWiring",
  },
  {
    localName: "inspectCodePurity",
    targetFile: "scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts",
    importPath: "../../code-purity/components/inspect-code-purity.js",
    importName: "inspectCodePurity",
  },
] as const;

const getImportedSpecifier = (
  sourceFile: SourceFile,
  importPath: string,
  importName: string,
): ImportSpecifier | undefined => {
  const importDeclaration = sourceFile.getImportDeclarations().find((declaration) => declaration.getModuleSpecifierValue() === importPath);
  return importDeclaration?.getNamedImports().find((specifier) => specifier.getName() === importName);
};

const getImportedLocalName = (importSpecifier: ImportSpecifier): string =>
  importSpecifier.getAliasNode()?.getText() ?? importSpecifier.getName();

const resolvesToExpectedImport = (importSpecifier: ImportSpecifier, importName: string): boolean => {
  const symbol = importSpecifier.getNameNode().getSymbol();
  const aliasedSymbol = symbol?.getAliasedSymbol() ?? symbol;
  return Boolean(aliasedSymbol?.getName() === importName && aliasedSymbol.getDeclarations().length > 0);
};

const returnsPromiseLike = (callExpression: CallExpression): boolean => {
  const returnType = callExpression.getReturnType();
  const symbol = returnType.getSymbol() ?? returnType.getAliasSymbol();
  return symbol?.getName() === "Promise";
};

const getRequiredLawId = (importName: string) =>
  importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1";

const createMissingInspectorImportFinding = (
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
): Finding =>
  createFinding({
    lawId: getRequiredLawId(requiredCall.importName),
    file: relativePath,
    line: 1,
    severity: "error",
    message: `Audit-system inspector must import ${requiredCall.importName} from ${requiredCall.importPath}.`,
  });

const collectImportValidationFindings = (
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
  importSpecifier: ImportSpecifier | undefined,
): Finding[] => {
  if (!importSpecifier) {
    return [createMissingInspectorImportFinding(relativePath, requiredCall)];
  }

  if (resolvesToExpectedImport(importSpecifier, requiredCall.importName)) {
    return [];
  }

  return [
    createFinding({
      lawId: getRequiredLawId(requiredCall.importName),
      file: relativePath,
      line: getNodeLine(importSpecifier),
      severity: "error",
      message: `Audit-system inspector import for ${requiredCall.importName} must resolve to its canonical symbol.`,
    }),
  ];
};

const getMatchingExecutionCalls = (
  sourceFile: SourceFile,
  importedLocalName: string,
): CallExpression[] =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === importedLocalName;
  });

const collectExecutionFindings = (
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
  matchingCalls: CallExpression[],
): Finding[] => {
  if (matchingCalls.length > 0) {
    return [];
  }

  return [
    createFinding({
      lawId: getRequiredLawId(requiredCall.importName),
      file: relativePath,
      line: 1,
      severity: "error",
      message: `Audit-system inspector must execute ${requiredCall.importName} inside its governed owner chain.`,
    }),
  ];
};

const collectReferenceFindings = (
  sourceFile: SourceFile,
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
  importSpecifier: ImportSpecifier,
): Finding[] => {
  const aliasNode = importSpecifier.getAliasNode();
  const nameNode = importSpecifier.getNameNode();
  const referenceAnchor = Node.isIdentifier(aliasNode)
    ? aliasNode
    : Node.isIdentifier(nameNode)
      ? nameNode
      : null;
  const referenceNodes = referenceAnchor?.findReferencesAsNodes() ?? [];
  const externalReferences = referenceNodes.filter((referenceNode: Node) => {
    return referenceNode.getSourceFile() === sourceFile && referenceNode !== importSpecifier.getNameNode() && referenceNode !== importSpecifier.getAliasNode();
  });
  if (externalReferences.length > 0) {
    return [];
  }

  return [
    createFinding({
      lawId: getRequiredLawId(requiredCall.importName),
      file: relativePath,
      line: getNodeLine(importSpecifier),
      severity: "error",
      message: `Audit-system inspector import for ${requiredCall.importName} is not referenced by the owner chain.`,
    }),
  ];
};

const collectPromiseReturnFindings = (
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
  matchingCalls: CallExpression[],
): Finding[] => {
  if (matchingCalls.every((callExpression) => returnsPromiseLike(callExpression))) {
    return [];
  }

  return [
    createFinding({
      lawId: getRequiredLawId(requiredCall.importName),
      file: relativePath,
      line: matchingCalls[0] ? getNodeLine(matchingCalls[0]) : 1,
      severity: "error",
      message: `Audit-system inspector must await promise-returning enforcement checks for ${requiredCall.importName}.`,
    }),
  ];
};

const resolveRequiredCallImport = (
  sourceFile: SourceFile,
  relativePath: string,
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number],
): { importSpecifier: ImportSpecifier; importedLocalName: string } | { findings: Finding[] } => {
  const importSpecifier = getImportedSpecifier(sourceFile, requiredCall.importPath, requiredCall.importName);
  const importFindings = collectImportValidationFindings(relativePath, requiredCall, importSpecifier);
  if (importFindings.length > 0 || !importSpecifier) {
    return { findings: importFindings };
  }

  return {
    importSpecifier,
    importedLocalName: getImportedLocalName(importSpecifier),
  };
};

const collectResolvedCallFindings = (input: {
  sourceFile: SourceFile;
  relativePath: string;
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number];
  resolvedImport: { importSpecifier: ImportSpecifier; importedLocalName: string };
}) => {
  const matchingCalls = getMatchingExecutionCalls(input.sourceFile, input.resolvedImport.importedLocalName);
  const executionFindings = collectExecutionFindings(input.relativePath, input.requiredCall, matchingCalls);
  if (executionFindings.length > 0) {
    return executionFindings;
  }

  return [
    ...collectReferenceFindings(input.sourceFile, input.relativePath, input.requiredCall, input.resolvedImport.importSpecifier),
    ...collectPromiseReturnFindings(input.relativePath, input.requiredCall, matchingCalls),
  ];
};

const collectRequiredCallFindings = (input: {
  sourceFile: SourceFile;
  relativePath: string;
  requiredCall: (typeof REQUIRED_INSPECTOR_CALLS)[number];
}) => {
  const resolvedImport = resolveRequiredCallImport(input.sourceFile, input.relativePath, input.requiredCall);
  if ("findings" in resolvedImport) {
    return resolvedImport.findings;
  }

  return collectResolvedCallFindings({
    sourceFile: input.sourceFile,
    relativePath: input.relativePath,
    requiredCall: input.requiredCall,
    resolvedImport,
  });
};

const createOwnedLawExecutionPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "owned-law-execution",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? "Audit-system inspector executes its owned generated-artifact, phase-domain, production-path, and code-purity checks."
      : "Audit-system inspector is missing one or more required owned-law execution checks.",
  );

export const validateOwnedLawExecution = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const project = getAuditProject();

  for (const requiredCall of REQUIRED_INSPECTOR_CALLS) {
    const sourceFile = getSourceFileOrThrow(project, requiredCall.targetFile);
    const relativePath = toRelativeSourcePath(sourceFile);
    findings.push(...collectRequiredCallFindings({ sourceFile, relativePath, requiredCall }));
  }

  return {
    findings,
    phases: [createOwnedLawExecutionPhase(findings)],
  };
};
