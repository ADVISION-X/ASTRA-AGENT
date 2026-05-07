import { Node, SyntaxKind, type CallExpression, type ObjectLiteralElementLike, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

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

function hasPropertyAssignmentInitializerFromSet(sourceFile: SourceFile, propertyName: string, expectedInitializers: readonly string[]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && expectedInitializers.includes(property.getInitializer()?.getText() ?? ""),
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

function hasMatchingCallee(callExpression: CallExpression, calleeName: string): boolean {
  const expression = callExpression.getExpression();
  return Node.isIdentifier(expression)
    ? expression.getText() === calleeName
    : Node.isPropertyAccessExpression(expression) && expression.getName() === calleeName;
}

function getFirstObjectLiteralArgument(callExpression: CallExpression): ObjectLiteralExpression | null {
  const [firstArgument] = callExpression.getArguments();
  return firstArgument && Node.isObjectLiteralExpression(firstArgument)
    ? firstArgument
    : null;
}

function propertyMatchesExpectedInitializers(property: ObjectLiteralElementLike, propertyName: string, expectedInitializers: readonly string[]): boolean {
  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getName() === propertyName && expectedInitializers.includes(property.getName());
  }

  return Node.isPropertyAssignment(property)
    && property.getName() === propertyName
    && expectedInitializers.includes(property.getInitializer()?.getText() ?? "");
}

function hasObjectLiteralCallPropertyInitializer(sourceFile: SourceFile, calleeName: string, propertyName: string, expectedInitializers: readonly string[]): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    if (!hasMatchingCallee(callExpression, calleeName)) {
      return false;
    }

    const objectLiteral = getFirstObjectLiteralArgument(callExpression);
    if (!objectLiteral) {
      return false;
    }

    return objectLiteral.getProperties().some((property) =>
      propertyMatchesExpectedInitializers(property, propertyName, expectedInitializers),
    );
  });
}

function collectBuilderParseFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-runtime-proof-builder.ts`);
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builders.ts`);
  const findings: Finding[] = [];

  if (!hasCallExpression(proofBuilder, "buildPageStateHash")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-runtime-proof-builder.ts`, line: 1, severity: "fatal", message: "Page State proof builder must derive governed hashes for snapshot and observations." }));
  }
  if (!hasCallExpressionPath(resultBuilder, ["PageStateAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: "Page State result builder must parse its public result schema." }));
  }

  return findings;
}

function collectProofBuilderPathFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-runtime-proof-builder.ts`);
  const proofPaths = [
    "request?.runId",
    "request?.stepId",
    "request?.mapPackageId",
    "request?.mapPackageVersion",
    "request?.selectedMapId",
    "request?.selectedMapVersion",
    "request?.activationSnapshotRef",
    "request?.capabilityCallId",
    "request?.nerveBusEnvelopeId",
    "request?.inputRef",
  ] as const;

  return proofPaths.flatMap((path) =>
    hasPropertyPath(proofBuilder, path)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-runtime-proof-builder.ts`, line: 1, severity: "fatal", message: `Page State proof builder must propagate ${path}.` })],
  );
}

function collectProofBuilderAssignmentFindings(project: Project): Finding[] {
  const proofBuilder = getSource(project, `${ROOT}/runtime/page-state-runtime-proof-builder.ts`);
  const proofAssignments = [
    { propertyName: "runId", expectedInitializer: "request?.runId ?? null" },
    { propertyName: "activationSnapshotRef", expectedInitializer: "request?.activationSnapshotRef ?? null" },
    { propertyName: "capabilityCallId", expectedInitializer: "request?.capabilityCallId ?? null" },
    { propertyName: "nerveBusEnvelopeId", expectedInitializer: "request?.nerveBusEnvelopeId ?? null" },
  ] as const;

  return proofAssignments.flatMap((assignment) =>
    hasPropertyAssignmentInitializer(proofBuilder, assignment.propertyName, assignment.expectedInitializer)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-runtime-proof-builder.ts`, line: 1, severity: "fatal", message: `Page State proof builder must propagate ${assignment.expectedInitializer}.` })],
  );
}

function collectResultBuilderPathFindings(project: Project): Finding[] {
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builders.ts`);
  const resultPaths = [
    "request.stepId",
    "request.mapPackageId",
    "request.mapPackageVersion",
    "request.selectedMapId",
    "request.selectedMapVersion",
    "request.activationSnapshotRef",
    "request.capabilityCallId",
    "request.nerveBusEnvelopeId",
  ] as const;

  return resultPaths.flatMap((path) =>
    hasPropertyPath(resultBuilder, path)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: `Page State result builder must propagate ${path}.` })],
  );
}

function collectChildOutputParseFindings(project: Project): Finding[] {
  const implementationSource = getSource(project, `${ROOT}/children/page-state-observation-child.ts`);
  return implementationSource.getFunction("buildChildObservation") && implementationSource.getFunction("createObservePageSurfaceCapability")
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/children/page-state-observation-child.ts`, line: 1, severity: "fatal", message: "Page State observation child must terminate through the governed observation packaging boundary." })];
}

function collectDetectSafetyPageNormalEvidenceFindings(project: Project): Finding[] {
  return [];
}

function collectLocalRuntimeDispatchBuilderFindings(project: Project): Finding[] {
  const builder = getSource(project, LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT);
  const findings: Finding[] = [];
  const requiredAssignments = [
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "abilityGroupId", expectedInitializers: ['"page-state"'], message: 'Local runtime page-state dispatch must stamp abilityGroupId: "page-state".' },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "runId", expectedInitializers: ["envelope.runId", "input.envelope.runId"], message: "Local runtime page-state dispatch must propagate envelope.runId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "sessionId", expectedInitializers: ["envelope.sessionId", "input.envelope.sessionId"], message: "Local runtime page-state dispatch must propagate envelope.sessionId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "stepId", expectedInitializers: ["envelope.stepId", "input.envelope.stepId"], message: "Local runtime page-state dispatch must propagate envelope.stepId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "mapPackageId", expectedInitializers: ["envelope.mapPackageId", "input.envelope.mapPackageId"], message: "Local runtime page-state dispatch must propagate envelope.mapPackageId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "mapPackageVersion", expectedInitializers: ["envelope.mapPackageVersion", "input.envelope.mapPackageVersion"], message: "Local runtime page-state dispatch must propagate envelope.mapPackageVersion." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "selectedMapId", expectedInitializers: ["envelope.selectedMapId", "input.envelope.selectedMapId"], message: "Local runtime page-state dispatch must propagate envelope.selectedMapId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "selectedMapVersion", expectedInitializers: ["envelope.selectedMapVersion", "input.envelope.selectedMapVersion"], message: "Local runtime page-state dispatch must propagate envelope.selectedMapVersion." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "activationSnapshotRef", expectedInitializers: ["envelope.activationSnapshotRef", "input.envelope.activationSnapshotRef"], message: "Local runtime page-state dispatch must propagate envelope.activationSnapshotRef." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "capabilityCallId", expectedInitializers: ["envelope.capabilityCallId", "input.envelope.capabilityCallId"], message: "Local runtime page-state dispatch must propagate envelope.capabilityCallId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "nerveBusEnvelopeId", expectedInitializers: ["envelope.nerveBusEnvelopeId", "input.envelope.nerveBusEnvelopeId"], message: "Local runtime page-state dispatch must propagate envelope.nerveBusEnvelopeId." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "inputRef", expectedInitializers: ["envelope.inputRef", "input.envelope.inputRef"], message: "Local runtime page-state dispatch must propagate envelope.inputRef." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "idempotencyKey", expectedInitializers: ["envelope.idempotencyKey", "input.envelope.idempotencyKey"], message: "Local runtime page-state dispatch must propagate envelope.idempotencyKey." },
    { lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", propertyName: "browserSessionRef", expectedInitializers: ["session.browserProfileRef", "input.session.browserProfileRef"], message: "Local runtime page-state dispatch must bind openHandoff.browserSessionRef to the active browser session." },
  ] as const;

  for (const assignment of requiredAssignments) {
    if (!hasPropertyAssignmentInitializerFromSet(builder, assignment.propertyName, assignment.expectedInitializers)) {
      findings.push(createFinding({ lawId: assignment.lawId, file: LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT, line: 1, severity: "fatal", message: assignment.message }));
    }
  }

  if (!hasCallExpression(builder, "resolvePageStateChildCapabilityId")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", file: LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Local runtime page-state dispatch must derive childCapabilityId from envelope.commandName." }));
  }

  const hasGovernedObservationsBuilder = hasCallExpression(builder, "buildPageStateObservations");
  const hasGovernedObservationsForwarding = hasObjectLiteralCallPropertyInitializer(builder, "buildPageStateDispatchPayload", "observations", ["observations"]);
  if (!hasGovernedObservationsBuilder || !hasGovernedObservationsForwarding) {
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
  const resultBuilder = getSource(project, `${ROOT}/runtime/page-state-result-builders.ts`);
  const findings: Finding[] = [];

  if (!resultBuilder.getFullText().includes("diagnosticPayloadRef: artifacts.refs.diagnosticPayloadRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: "Page State result builders must retain diagnosticPayloadRef for non-success outcomes." }));
  }

  if (!resultBuilder.getFullText().includes("observationRefs: artifacts.observationRefs")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: "Page State result builder must retain runtime proof observationRefs on failed or review_required results." }));
  }

  if (!resultBuilder.getFullText().includes("observationFingerprint: runtimeProof.observationFingerprint")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", file: `${ROOT}/runtime/page-state-result-builders.ts`, line: 1, severity: "fatal", message: "Page State result builder must retain runtime proof observationFingerprint on failed or review_required results." }));
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