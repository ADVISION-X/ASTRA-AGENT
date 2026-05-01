import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getPageStateSources, getSource } from "./audit-project.js";
import { ROOT } from "./constants.js";
import { hasDateOutsideClock, hasForbiddenCapabilityImport, hasForbiddenEscape } from "./source-boundaries.js";
import { Node, SyntaxKind, type Project } from "ts-morph";

const toRepoPath = (absolutePath: string): string =>
  absolutePath.split("/Users/nexgen/Documents/GrassEye -AI-AGENT/").pop() ?? absolutePath;

const inspectSourceFile = (repoPath: string, sourceFile: ReturnType<typeof getPageStateSources>[number]): Finding[] => {
  const findings: Finding[] = [];

  if (hasForbiddenEscape(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State root must not use escape hatches or dynamic import patterns." }));
  }
  if (hasDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State runtime must not use Date outside the clock boundary." }));
  }
  if (hasForbiddenCapabilityImport(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State must not import forbidden capability implementations." }));
  }

  return findings;
};

const inspectRuntimeSources = (project: Project): Finding[] =>
  getPageStateSources(project).flatMap((sourceFile) => inspectSourceFile(toRepoPath(sourceFile.getFilePath()), sourceFile));

const inspectIndexSource = (project: Project): Finding[] => {
  const indexSource = getSource(project, `${ROOT}/index.ts`);
  return indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: `${ROOT}/index.ts`, line: 1, severity: "fatal", message: "Page State index must not use export-star barrels." })]
    : [];
};

function schemaUsesValidationGuard(project: Project, schemaName: string, guardName: string): boolean {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const initializer = schemaSource.getVariableDeclaration(schemaName)?.getInitializer();
  if (!initializer) {
    return false;
  }

  const callExpressions = [
    ...(Node.isCallExpression(initializer) ? [initializer] : []),
    ...initializer.getDescendantsOfKind(SyntaxKind.CallExpression),
  ];

  return callExpressions.some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "superRefine"
      && callExpression.getArguments().some((argument) => Node.isIdentifier(argument) && argument.getText() === guardName);
  });
}

function validationSourceContainsGuard(project: Project, message: string): boolean {
  const validationSource = getSource(project, `${ROOT}/page-state-schema-validation.ts`);
  return validationSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === message);
}

const inspectSchemaSource = (project: Project): Finding[] => {
  const hasGovernedNullOutput = schemaUsesValidationGuard(project, "PageStateAbilityResultSchema", "validatePageStateAbilityResult")
    && validationSourceContainsGuard(project, "failed or review_required result must null output");
  const hasGovernedNullOutputRef = schemaUsesValidationGuard(project, "PageStateRuntimeProofSchema", "validatePageStateRuntimeProof")
    && validationSourceContainsGuard(project, "failed or review_required proof must null outputRef");

  return hasGovernedNullOutput && hasGovernedNullOutputRef
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must forbid non-null output or outputRef on non-success results." })];
};

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...inspectRuntimeSources(project),
    ...inspectIndexSource(project),
    ...inspectSchemaSource(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-forbidden-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State forbidden shapes are absent." : "Page State still contains forbidden shapes or escape hatches."),
  };
}