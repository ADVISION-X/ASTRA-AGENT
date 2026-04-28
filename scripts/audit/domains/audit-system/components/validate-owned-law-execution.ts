import { Node, SyntaxKind } from "ts-morph";

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

const getImportedLocalName = (sourceFile: ReturnType<typeof getSourceFileOrThrow>, importPath: string, importName: string): string | undefined => {
  const importDeclaration = sourceFile.getImportDeclarations().find((declaration) => declaration.getModuleSpecifierValue() === importPath);
  const namedImport = importDeclaration?.getNamedImports().find((specifier) => specifier.getName() === importName);
  return namedImport?.getAliasNode()?.getText() ?? namedImport?.getName();
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
    const importedLocalName = getImportedLocalName(sourceFile, requiredCall.importPath, requiredCall.importName);
    if (!importedLocalName) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-003-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: 1,
          severity: "error",
          message: `Audit-system inspector must import ${requiredCall.importName} from ${requiredCall.importPath}.`,
        }),
      );
      continue;
    }

    const hasCall = promiseAllItems.some((element) => {
      if (!Node.isCallExpression(element)) {
        return false;
      }

      const expression = element.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === importedLocalName;
    });

    if (!hasCall) {
      findings.push(
        createFinding({
          lawId: requiredCall.importName === "inspectCodePurity" ? "GRASSEYE-CODE-PURITY-003-V1" : "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(promiseAllCall ?? sourceFile),
          severity: "error",
          message: `Audit-system inspector must execute ${requiredCall.importName} inside its Promise.all owner chain.`,
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