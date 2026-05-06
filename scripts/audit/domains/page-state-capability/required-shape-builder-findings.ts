import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { CHILDREN, ROOT } from "./constants.js";

const LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT = "src/lib/local-runtime/workbench-page-state-dispatch-input.ts";
const LOCAL_RUNTIME_ABILITY_EXECUTOR = "src/lib/local-runtime/workbench-ability-command-executor.ts";

function hasPropertyPath(sourceFile: SourceFile, path: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === path);
}

function hasChildOutputSchemaParse(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) =>
    expression.getName() === "parse" && expression.getExpression().getText().endsWith("ChildOutputSchema"),
  );
}

function hasPropertyAssignmentInitializer(sourceFile: SourceFile, propertyName: string, expectedInitializer: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && property.getInitializer()?.getText() === expectedInitializer,
  );
}

function hasCallWithArguments(sourceFile: SourceFile, calleeName: string, argumentTexts: readonly string[]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    const calleeMatches = Node.isIdentifier(expression)
      ? expression.getText() === calleeName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;

    return calleeMatches
      && callExpression.getArguments().length === argumentTexts.length
      && callExpression.getArguments().every((argument, index) => argument.getText() === argumentTexts[index]);
  });
}

function collectBuilderParseFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-proof-builder.ts`);
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builder.ts`);
  const dispatchFailure = getSource(project, `${ROOT}/runtime/page-state-dispatch-failure.ts`);
  const findings: Finding[] = [];

  if (!hasCallExpressionPath(proofBuilder, ["PageStateRuntimeProofSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-proof-builder.ts`, line: 1, severity: "fatal", message: "Page State proof builder must parse its public proof schema." }));
  }
  if (!hasCallExpressionPath(resultBuilder, ["PageStateAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builder.ts`, line: 1, severity: "fatal", message: "Page State result builder must parse its public result schema." }));
  }
  if (!hasCallExpressionPath(dispatchFailure, ["PageStateAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Invalid input failure must terminate as a governed result envelope." }));
  }

  return findings;
}

function collectProofBuilderPathFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-proof-builder.ts`);
  const proofPaths = [
    "input.request.runId",
    "input.request.stepId",
    "input.request.mapPackageId",
    "input.request.mapPackageVersion",
    "input.request.selectedMapId",
    "input.request.selectedMapVersion",
    "input.request.activationSnapshotRef",
    "input.request.capabilityCallId",
    "input.request.nerveBusEnvelopeId",
    "input.request.inputRef",
    "input.trace.payloadBudgetDecision",
  ] as const;

  return proofPaths.flatMap((path) =>
    hasPropertyPath(proofBuilder, path)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-proof-builder.ts`, line: 1, severity: "fatal", message: `Page State proof builder must propagate ${path}.` })],
  );
}

function collectProofBuilderAssignmentFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-proof-builder.ts`);
  const proofAssignments = [
    { propertyName: "runId", expectedInitializer: "input.request.runId" },
    { propertyName: "activationSnapshotRef", expectedInitializer: "input.request.activationSnapshotRef" },
    { propertyName: "capabilityCallId", expectedInitializer: "input.request.capabilityCallId" },
    { propertyName: "nerveBusEnvelopeId", expectedInitializer: "input.request.nerveBusEnvelopeId" },
  ] as const;

  return proofAssignments.flatMap((assignment) =>
    hasPropertyAssignmentInitializer(proofBuilder, assignment.propertyName, assignment.expectedInitializer)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-proof-builder.ts`, line: 1, severity: "fatal", message: `Page State proof builder must propagate ${assignment.expectedInitializer}.` })],
  );
}

function collectResultBuilderPathFindings(project: Project): Finding[] {
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builder.ts`);
  const resultPaths = [
    "input.request.stepId",
    "input.request.mapPackageId",
    "input.request.mapPackageVersion",
    "input.request.selectedMapId",
    "input.request.selectedMapVersion",
    "input.request.activationSnapshotRef",
    "input.request.capabilityCallId",
    "input.request.nerveBusEnvelopeId",
  ] as const;

  return resultPaths.flatMap((path) =>
    hasPropertyPath(resultBuilder, path)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builder.ts`, line: 1, severity: "fatal", message: `Page State result builder must propagate ${path}.` })],
  );
}

function collectChildOutputParseFindings(project: Project): Finding[] {
  return [...CHILDREN].flatMap((childId) => {
    const implementationSource = getSource(project, `${ROOT}/children/${childId}/implementation.ts`);
    return hasChildOutputSchemaParse(implementationSource)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Page State child implementation must terminate through its ChildOutputSchema.parse boundary." })];
  });
}

function collectDetectSafetyPageNormalEvidenceFindings(project: Project): Finding[] {
  const file = `${ROOT}/children/detect-safety-page/implementation.ts`;
  const implementationSource = getSource(project, file);
  const normalEvidenceFunction = implementationSource.getFunction("collectNormalSafetyEvidence");
  const absentMarkerFunction = implementationSource.getFunction("isAbsentPageMarker");
  const resolverFunction = implementationSource.getFunction("resolveDetectSafetyPageOutput");
  if (!normalEvidenceFunction || !absentMarkerFunction || !resolverFunction) {
    return [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file, line: 1, severity: "fatal", message: "detect-safety-page must bind governed negative captcha/safety-wall observations for page_normal success." })];
  }

  const normalEvidenceCollectsAbsentMarkers = normalEvidenceFunction.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "filter"
      && callExpression.getArguments().some((argument) => Node.isIdentifier(argument) && argument.getText() === "isAbsentPageMarker");
  });
  const normalEvidenceCollectsPlatformCapture = normalEvidenceFunction.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "findPlatformCaptures";
  });
  const normalBranchUsesEvidenceCollector = resolverFunction.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "collectNormalSafetyEvidence";
  });

  return normalEvidenceCollectsAbsentMarkers && normalEvidenceCollectsPlatformCapture && normalBranchUsesEvidenceCollector
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file, line: 1, severity: "fatal", message: "detect-safety-page must bind governed negative captcha/safety-wall observations for page_normal success." })];
}

function collectLocalRuntimeDispatchBuilderFindings(project: Project): Finding[] {
  const builder = getSource(project, LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT);
  const findings: Finding[] = [];
  const requiredAssignments = [
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "abilityGroupId", expectedInitializer: '"page-state"', message: 'Local runtime page-state dispatch must stamp abilityGroupId: "page-state".' },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "runId", expectedInitializer: "envelope.runId", message: "Local runtime page-state dispatch must propagate envelope.runId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "sessionId", expectedInitializer: "envelope.sessionId", message: "Local runtime page-state dispatch must propagate envelope.sessionId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "stepId", expectedInitializer: "envelope.stepId", message: "Local runtime page-state dispatch must propagate envelope.stepId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "mapPackageId", expectedInitializer: "envelope.mapPackageId", message: "Local runtime page-state dispatch must propagate envelope.mapPackageId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "mapPackageVersion", expectedInitializer: "envelope.mapPackageVersion", message: "Local runtime page-state dispatch must propagate envelope.mapPackageVersion." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "selectedMapId", expectedInitializer: "envelope.selectedMapId", message: "Local runtime page-state dispatch must propagate envelope.selectedMapId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "selectedMapVersion", expectedInitializer: "envelope.selectedMapVersion", message: "Local runtime page-state dispatch must propagate envelope.selectedMapVersion." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "activationSnapshotRef", expectedInitializer: "envelope.activationSnapshotRef", message: "Local runtime page-state dispatch must propagate envelope.activationSnapshotRef." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "capabilityCallId", expectedInitializer: "envelope.capabilityCallId", message: "Local runtime page-state dispatch must propagate envelope.capabilityCallId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "nerveBusEnvelopeId", expectedInitializer: "envelope.nerveBusEnvelopeId", message: "Local runtime page-state dispatch must propagate envelope.nerveBusEnvelopeId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "inputRef", expectedInitializer: "envelope.inputRef", message: "Local runtime page-state dispatch must propagate envelope.inputRef." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "idempotencyKey", expectedInitializer: "envelope.idempotencyKey", message: "Local runtime page-state dispatch must propagate envelope.idempotencyKey." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "browserSessionRef", expectedInitializer: "session.browserProfileRef", message: "Local runtime page-state dispatch must bind openHandoff.browserSessionRef to the active browser session." },
  ] as const;

  for (const assignment of requiredAssignments) {
    if (!hasPropertyAssignmentInitializer(builder, assignment.propertyName, assignment.expectedInitializer)) {
      findings.push(createFinding({ lawId: assignment.lawId, file: LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT, line: 1, severity: "fatal", message: assignment.message }));
    }
  }

  if (!hasCallExpression(builder, "resolvePageStateChildCapabilityId")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", file: LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Local runtime page-state dispatch must derive childCapabilityId from envelope.commandName." }));
  }

  if (!hasCallExpression(builder, "buildPageStateObservations")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V2", file: LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Local runtime page-state dispatch must emit governed observations for observation-required Page State steps." }));
  }

  return findings;
}

function collectLocalRuntimeExecutorFindings(project: Project): Finding[] {
  const executor = getSource(project, LOCAL_RUNTIME_ABILITY_EXECUTOR);
  return hasCallWithArguments(executor, "buildPageStateDispatchInput", ["runtime", "envelope", "inputPayload"])
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", file: LOCAL_RUNTIME_ABILITY_EXECUTOR, line: 1, severity: "fatal", message: "Local runtime executor must pass inputPayload into buildPageStateDispatchInput." })];
}

function collectNonSuccessParityFindings(project: Project): Finding[] {
  const successResult = getSource(project, `${ROOT}/runtime/page-state-success-result.ts`);
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builder.ts`);
  const findings: Finding[] = [];

  if (!successResult.getFullText().includes('const diagnosticPayloadRef = outcome.status === "success"')) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-success-result.ts`, line: 1, severity: "fatal", message: "Page State success-result builder must retain diagnosticPayloadRef for non-success outcomes." }));
  }

  if (!hasPropertyAssignmentInitializer(resultBuilder, "observationRefs", "input.output?.observationRefs ?? [...input.runtimeProof.observationRefs]")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builder.ts`, line: 1, severity: "fatal", message: "Page State result builder must retain runtime proof observationRefs on failed or review_required results." }));
  }

  if (!hasPropertyAssignmentInitializer(resultBuilder, "pageStateFingerprint", "input.output?.pageStateFingerprint ?? input.runtimeProof.pageStateFingerprint")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builder.ts`, line: 1, severity: "fatal", message: "Page State result builder must retain runtime proof pageStateFingerprint on failed or review_required results." }));
  }

  return findings;
}

export function collectBuilderSpecificFindings(project: Project): Finding[] {
  return [
    ...collectBuilderParseFindings(project),
    ...collectProofBuilderPathFindings(project),
    ...collectProofBuilderAssignmentFindings(project),
    ...collectResultBuilderPathFindings(project),
    ...collectChildOutputParseFindings(project),
    ...collectDetectSafetyPageNormalEvidenceFindings(project),
    ...collectLocalRuntimeDispatchBuilderFindings(project),
    ...collectLocalRuntimeExecutorFindings(project),
    ...collectNonSuccessParityFindings(project),
  ];
}