import { Node, SyntaxKind, type CallExpression, type ImportSpecifier, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

const REQUIRED_INSPECTOR_CALLS = [
  {
    localName: "validateGeneratedArtifacts",
    importPath: "./components/validate-generated-artifacts.js",
    importName: "validateGeneratedArtifacts",
  },
  {
    localName: "validateRequiredPhaseDomains",
    importPath: "./components/validate-required-phase-domains.js",
    importName: "validateRequiredPhaseDomains",
  },
  {
    localName: "validateNoSimulatedProductionPaths",
    importPath: "./components/validate-no-simulated-production-paths.js",
    importName: "validateNoSimulatedProductionPaths",
  },
  {
    localName: "inspectCodePurity",
    importPath: "../code-purity/components/inspect-code-purity.js",
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

export const validateOwnedLawExecution = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, "scripts/audit/domains/audit-system/inspector.ts");
  const relativePath = toRelativeSourcePath(sourceFile);
  const promiseAllCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "Promise"
      && expression.getName() === "all";
  });
  const promiseAllArgument = promiseAllCall?.getArguments()[0];
  const promiseAllItems = promiseAllArgument && Node.isArrayLiteralExpression(promiseAllArgument)
    ? promiseAllArgument.getElements()
    : [];

  for (const requiredCall of REQUIRED_INSPECTOR_CALLS) {
    const importSpecifier = getImportedSpecifier(sourceFile, requiredCall.importPath, requiredCall.importName);
    if (!importSpecifier) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: 1,
          severity: "error",
          message: `Audit-system inspector must import ${requiredCall.importName} from ${requiredCall.importPath}.`,
        }),
      );
      continue;
    }

    if (!resolvesToExpectedImport(importSpecifier, requiredCall.importName)) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(importSpecifier),
          severity: "error",
          message: `Audit-system inspector import for ${requiredCall.importName} must resolve to its canonical symbol.`,
        }),
      );
      continue;
    }

    const importedLocalName = getImportedLocalName(importSpecifier);
    const matchingCalls = promiseAllItems.filter((element): element is import("ts-morph").CallExpression => {
      if (!Node.isCallExpression(element)) {
        return false;
      }

      const expression = element.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === importedLocalName;
    });

    if (matchingCalls.length === 0) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(promiseAllCall ?? sourceFile),
          severity: "error",
          message: `Audit-system inspector must execute ${requiredCall.importName} inside its Promise.all owner chain.`,
        }),
      );
      continue;
    }

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
    if (externalReferences.length === 0) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(importSpecifier),
          severity: "error",
          message: `Audit-system inspector import for ${requiredCall.importName} is not referenced by the owner chain.`,
        }),
      );
    }

    const hasPromiseReturn = matchingCalls.every((callExpression) => {
      return returnsPromiseLike(callExpression);
    });
    if (!hasPromiseReturn) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-011-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(matchingCalls[0] ?? promiseAllCall ?? sourceFile),
          severity: "error",
          message: `Audit-system inspector must await promise-returning enforcement checks for ${requiredCall.importName}.`,
        }),
      );
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "owned-law-execution",
        findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
        findings.length === 0,
        findings.length === 0
          ? "Audit-system inspector executes its owned generated-artifact, phase-domain, production-path, and code-purity checks."
          : "Audit-system inspector is missing one or more required owned-law execution checks.",
      ),
    ],
  };
};
