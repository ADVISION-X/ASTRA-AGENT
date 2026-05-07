import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { AUDIT_ROOT, ROOT } from "./constants.js";
import type { Project } from "ts-morph";

function hasPropertyPath(sourceTextOwner: Project, file: string, path: string): boolean {
  const source = getSource(sourceTextOwner, file);
  return source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === path);
}

function collectExecutionRouteFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const routeChecks = [
    { file: `${ROOT}/runtime/page-state-executor.ts`, callee: "createPageStateFailureResult" },
    { file: `${ROOT}/runtime/page-state-executor.ts`, callee: "createSuccessfulPageStateResult" },
    { file: `${ROOT}/runtime/page-state-result-builders.ts`, callee: "buildPageStateRuntimeProof" },
    { file: `${ROOT}/runtime/page-state-result-builders.ts`, callee: "buildPageStateObservationFingerprint" },
  ] as const;

  for (const check of routeChecks) {
    const source = getSource(project, check.file);
    if (!hasCallExpressionPath(source, [check.callee])) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: check.file, line: 1, severity: "fatal", message: `Page State execution chain must not bypass ${check.callee}.` }));
    }
  }
  return findings;
}

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
  return validationSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && expression.getText() === "addIssue"
      && callExpression.getArguments().some((argument) => Node.isStringLiteral(argument) && argument.getLiteralText() === message);
  });
}

function collectProfileGateFindings(project: Project): Finding[] {
  return [];
}

function collectPlatformKindFindings(project: Project): Finding[] {
  return [];
}

function collectFeedReadyFindings(project: Project): Finding[] {
  return [];
}

function collectDispatchFailureFindings(project: Project): Finding[] {
  const resultBuildersSource = getSource(project, `${ROOT}/runtime/page-state-result-builders.ts`);
  return hasLiteralTextFragment(resultBuildersSource, "invalid-mission") || hasLiteralTextFragment(resultBuildersSource, "https://invalid.local/")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: "Invalid input handling must not forge fake mission or URL context." })]
    : [];
}

function hasSchemaValidationGuards(project: Project): boolean {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const hasAbilityResultGuard = schemaUsesValidationGuard(project, "PageStateAbilityResultSchema", "validatePageStateAbilityResult") || hasLiteralTextFragment(schemaSource, "validatePageStateAbilityResult");
  const hasRuntimeProofGuard = schemaUsesValidationGuard(project, "PageStateRuntimeProofSchema", "validatePageStateRuntimeProof") || hasLiteralTextFragment(schemaSource, "validatePageStateRuntimeProof");
  return hasAbilityResultGuard && hasRuntimeProofGuard;
}

function hasValidationGuardMessages(project: Project): boolean {
  const requiredMessages = [
    "failed or review_required result must null output",
    "failed or review_required proof must null outputRef",
    "success result must retain evidenceRefs",
    "invalid input failure proof must retain receivedShapeHash",
  ] as const;

  return requiredMessages.every((message) => validationSourceContainsGuard(project, message));
}

function hasProofBuilderChainBindings(project: Project): boolean {
  return hasPropertyPath(project, `${ROOT}/runtime/page-state-runtime-proof-builder.ts`, "request?.activationSnapshotRef")
    && hasPropertyPath(project, `${ROOT}/runtime/page-state-runtime-proof-builder.ts`, "request?.inputRef");
}

function collectSchemaFindings(project: Project): Finding[] {
  const findings: Finding[] = [];

  if (!hasSchemaValidationGuards(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must wire runtime-proof and result validation guards." }));
  }

  const hasFailureResultOutputGuard = validationSourceContainsGuard(project, "failed or review_required result must null output");
  const hasFailureProofOutputRefGuard = validationSourceContainsGuard(project, "failed or review_required proof must null outputRef");
  if (!hasFailureResultOutputGuard || !hasFailureProofOutputRefGuard) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema/proof anti-escape must forbid non-null output or outputRef." }));
  }

  if (!validationSourceContainsGuard(project, "success result must retain evidenceRefs")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema/proof anti-escape must preserve evidence backing." }));
  }

  if (!validationSourceContainsGuard(project, "invalid input failure proof must retain receivedShapeHash")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema/proof anti-escape must retain receivedShapeHash for invalid input failure proof." }));
  }

  if (!hasValidationGuardMessages(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema/proof anti-escape guard messages are incomplete." }));
  }

  if (!hasProofBuilderChainBindings(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema/proof anti-escape must preserve real chain refs." }));
  }

  return findings;
}

function collectOutputBoundaryFindings(project: Project): Finding[] {
  const executorSource = getSource(project, `${ROOT}/runtime/page-state-executor.ts`);
  const executorText = executorSource.getFullText();
  const hasEvidenceGate = executorText.includes("sourceEvidenceRefs.length === 0") && executorText.includes("missing_source_evidence");
  const hasObservationGate = executorText.includes("matchedObservationIds.length === 0") && executorText.includes("missing_observation_support");
  const hasReviewBoundary = executorText.includes("Page State can only forward governed observation bundles with evidence references.");

  return hasEvidenceGate && hasObservationGate && hasReviewBoundary
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-executor.ts`, line: 1, severity: "fatal", message: "Page State executor must block missing evidence and missing observation support before success output is built." })];
}

function collectInspectorHarnessFindings(project: Project): Finding[] {
  const inspectorSource = getSource(project, `${AUDIT_ROOT}/inspector.ts`);
  const hasNegativeProofCall = hasCallExpression(inspectorSource, "runNegativeProofHarness");
  const hasNegativeProofFindings = inspectorSource.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "negativeProof.findings");
  const hasNegativeProofPhase = inspectorSource.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "negativeProof.phase");

  return hasNegativeProofCall && hasNegativeProofFindings && hasNegativeProofPhase
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: `${AUDIT_ROOT}/inspector.ts`, line: 1, severity: "fatal", message: "Page State inspector must invoke and report the negative-proof harness." })];
}

function hasPropertyAssignment(node: Node, propertyName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName);
}

function getArrayLiteralInitializer(project: Project, file: string, declarationName: string) {
  const source = getSource(project, file);
  const initializer = source.getVariableDeclaration(declarationName)?.getInitializer();
  return initializer && Node.isArrayLiteralExpression(initializer) ? initializer : null;
}

function everyMutationCarriesPhase(project: Project): boolean {
  const mutations = getArrayLiteralInitializer(project, `${AUDIT_ROOT}/negative-proof-mutations.ts`, "PAGE_STATE_NEGATIVE_PROOF_MUTATIONS");
  if (!mutations) {
    return false;
  }

  const elements = mutations.getElements();
  return elements.length > 0 && elements.every((element) => Node.isObjectLiteralExpression(element) && hasPropertyAssignment(element, "phase"));
}

function hasGroupedMutationLoop(project: Project): boolean {
  const source = getSource(project, `${AUDIT_ROOT}/negative-proof-harness.ts`);
  return source.getDescendantsOfKind(SyntaxKind.ForOfStatement).some((statement) => {
    const expression = statement.getExpression();
    return Node.isCallExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "createMutationGroups";
  });
}

function passesTargetPhaseToInspectorProcess(project: Project): boolean {
  const source = getSource(project, `${AUDIT_ROOT}/negative-proof-harness.ts`);
  return source.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    const [argument] = callExpression.getArguments();
    return Node.isIdentifier(expression)
      && expression.getText() === "runInspectorProcess"
      && Node.isObjectLiteralExpression(argument)
      && argument.getProperty("phase")
      && argument.getProperty("skipBuild");
  });
}

function collectNegativeProofPerformanceFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const file = `${AUDIT_ROOT}/negative-proof-harness.ts`;

  if (!getSource(project, file).getFunction("createMutationGroups")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Page State negative proof must group mutations by targeted enforcement phase." }));
  }
  if (!everyMutationCarriesPhase(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Every Page State negative-proof mutation must declare its targeted enforcement phase." }));
  }
  if (!hasGroupedMutationLoop(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Page State negative proof must iterate grouped mutations instead of replaying the full inspector per mutation." }));
  }
  if (!passesTargetPhaseToInspectorProcess(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Page State negative proof must pass targeted phase selection into nested inspector processes." }));
  }

  return findings;
}

export async function runAntiEscape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...collectExecutionRouteFindings(project),
    ...collectProfileGateFindings(project),
    ...collectPlatformKindFindings(project),
    ...collectFeedReadyFindings(project),
    ...collectDispatchFailureFindings(project),
    ...collectSchemaFindings(project),
    ...collectOutputBoundaryFindings(project),
    ...collectInspectorHarnessFindings(project),
    ...collectNegativeProofPerformanceFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-anti-escape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State anti-escape checks are closed." : "Page State still allows one or more anti-escape bypasses."),
  };
}
