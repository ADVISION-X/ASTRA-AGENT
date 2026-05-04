import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const INSPECTOR_FILE = "scripts/audit/domains/audit-system/inspector.ts";
const HARNESS_IMPORT = "./negative-proof-harness.js";
const HARNESS_NAME = "runNegativeProofHarness";
const SKIP_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF";

const createNegativeProofWiringPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "negative-proof-wiring",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? "Audit-system inspector imports, invokes, and reports its negative-proof harness."
      : "Audit-system inspector lost the required negative-proof harness wiring.",
  );

const collectHarnessImportDetails = (sourceFile: ReturnType<typeof getSourceFileOrThrow>): string[] => {
  const details: string[] = [];
  const harnessImport = sourceFile.getImportDeclarations().find((declaration) => declaration.getModuleSpecifierValue() === HARNESS_IMPORT);
  const hasHarnessImport = harnessImport?.getNamedImports().some((specifier) => specifier.getName() === HARNESS_NAME) ?? false;
  if (!hasHarnessImport) {
    details.push(`missing ${HARNESS_NAME} import from ${HARNESS_IMPORT}`);
  }
  if (harnessImport && !harnessImport.getModuleSpecifierSourceFile()) {
    details.push("negative-proof harness import does not resolve to a source file");
  }
  return details;
};

const collectSkipEnvDetails = (sourceFile: ReturnType<typeof getSourceFileOrThrow>): { details: string[]; line: number } => {
  const skipEnvDeclaration = sourceFile.getVariableDeclaration("SKIP_NEGATIVE_PROOF_ENV");
  const skipEnvLiteral = skipEnvDeclaration?.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? null;
  return {
    details: skipEnvLiteral === SKIP_ENV ? [] : [`skip env must remain ${SKIP_ENV}`],
    line: skipEnvDeclaration ? getNodeLine(skipEnvDeclaration) : 1,
  };
};

const hasPropertyAccess = (sourceFile: ReturnType<typeof getSourceFileOrThrow>, propertyName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
    return expression.getExpression().getText() === "negativeProof" && expression.getName() === propertyName;
  });
};

const collectHarnessUsageDetails = (sourceFile: ReturnType<typeof getSourceFileOrThrow>): string[] => {
  const details: string[] = [];
  const hasHarnessInvocation = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === HARNESS_NAME;
  });
  if (!hasHarnessInvocation) {
    details.push(`${HARNESS_NAME}() invocation is missing`);
  }
  if (!hasPropertyAccess(sourceFile, "phase")) {
    details.push("negativeProof.phase is not reported by the inspector");
  }
  if (!hasPropertyAccess(sourceFile, "findings")) {
    details.push("negativeProof.findings are not merged into the inspector findings");
  }
  return details;
};

const createNegativeProofFinding = (relativePath: string, line: number, details: string[]): Finding => {
  return createFinding({
    lawId: LAW_ID,
    file: relativePath,
    line,
    severity: "fatal",
    message: `Audit-system inspector must invoke and report the negative-proof harness. Details: ${details.join("; ")}`,
  });
};

export const validateNegativeProofWiring = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const sourceFile = getSourceFileOrThrow(getAuditProject(), INSPECTOR_FILE);
  const relativePath = toRelativeSourcePath(sourceFile);
  const skipEnv = collectSkipEnvDetails(sourceFile);
  const details = [
    ...collectHarnessImportDetails(sourceFile),
    ...skipEnv.details,
    ...collectHarnessUsageDetails(sourceFile),
  ];
  const findings = details.length > 0 ? [createNegativeProofFinding(relativePath, skipEnv.line, details)] : [];

  return {
    findings,
    phases: [createNegativeProofWiringPhase(findings)],
  };
};