import { SyntaxKind } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine } from "../../core/ts-morph.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

const {
  INSPECTOR_ENTRY,
  NEGATIVE_PROOF_HARNESS_FILE,
  REQUIREMENT_ID_001,
  SKIP_NEGATIVE_PROOF_ENV,
} = kernelInspectionConstants;

const collectHarnessPresenceDetails = async (): Promise<string[]> => {
  return (await fileExists(pathFromRepoRoot(NEGATIVE_PROOF_HARNESS_FILE)))
    ? []
    : ["negative-proof-harness.ts is missing"];
};

const collectImportAndEnvDetails = (sourceFile: NonNullable<ReturnType<ReturnType<typeof getAuditProject>["getSourceFile"]>>) => {
  const details: string[] = [];
  const hasHarnessImport = sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "./negative-proof-harness.js"
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === "runNegativeProofHarness"));
  if (!hasHarnessImport) {
    details.push("runNegativeProofHarness import is missing");
  }

  const skipEnvDeclaration = sourceFile.getVariableDeclaration("SKIP_NEGATIVE_PROOF_ENV");
  const skipEnvLiteral = skipEnvDeclaration?.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? null;
  if (skipEnvLiteral !== SKIP_NEGATIVE_PROOF_ENV) {
    details.push(`skip env must remain ${SKIP_NEGATIVE_PROOF_ENV}`);
  }

  return { details, line: skipEnvDeclaration ? getNodeLine(skipEnvDeclaration) : 1 };
};

const collectUsageDetails = (sourceFile: NonNullable<ReturnType<ReturnType<typeof getAuditProject>["getSourceFile"]>>): string[] => {
  const details: string[] = [];
  const hasHarnessInvocation = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "runNegativeProofHarness");
  if (!hasHarnessInvocation) {
    details.push("runNegativeProofHarness() invocation is missing");
  }

  const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  if (!propertyAccesses.some((expression) => expression.getExpression().getText() === "negativeProof" && expression.getName() === "phase")) {
    details.push("negativeProof.phase is not reported");
  }
  if (!propertyAccesses.some((expression) => expression.getExpression().getText() === "negativeProof" && expression.getName() === "findings")) {
    details.push("negativeProof.findings are not merged into findings");
  }

  return details;
};

export async function runNegativeProofWiringChecks(
  project: ReturnType<typeof getAuditProject>,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const details = await collectHarnessPresenceDetails();

  const sourceFile = project.getSourceFile(pathFromRepoRoot(INSPECTOR_ENTRY));
  let line = 1;
  if (!sourceFile) {
    details.push("inspector source file is missing");
  } else {
    const importAndEnv = collectImportAndEnvDetails(sourceFile);
    details.push(...importAndEnv.details, ...collectUsageDetails(sourceFile));
    line = importAndEnv.line;
  }

  const findings = details.length === 0
    ? []
    : [createFinding({
        lawId: REQUIREMENT_ID_001,
        file: INSPECTOR_ENTRY,
        line,
        severity: "fatal",
        message: `Kernel inspector must invoke and report the negative-proof harness. Details: ${details.join("; ")}`,
      })];

  return {
    findings,
    phases: [
      createPhase(
        "negative-proof-wiring",
        findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
        findings.length === 0,
        findings.length === 0
          ? "Kernel inspector imports, invokes, and reports its negative-proof harness."
          : "Kernel inspector lost the required negative-proof harness wiring.",
      ),
    ],
  };
}