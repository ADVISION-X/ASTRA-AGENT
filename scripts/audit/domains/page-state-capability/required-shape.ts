import { Node, SyntaxKind, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { isThinAbilityGroup } from "./ability-group-shape.js";
import { missingCanonicalFiles } from "./canonical-files.js";
import { CHILDREN, ROOT } from "./constants.js";

const INPUT_CHAIN_FIELDS = [
  "abilityGroupId",
  "requestedBy",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "inputRef",
  "idempotencyKey",
] as const;

const RUNTIME_PROOF_CHAIN_FIELDS = [
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "payloadBudgetDecision",
] as const;

const RESULT_CHAIN_FIELDS = [
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const EXECUTION_ROUTE_SOURCES = {
  gatePageStateInput: `${ROOT}/runtime/page-state-preflight.ts`,
  gatePageStatePayloadBudget: `${ROOT}/runtime/page-state-preflight.ts`,
  gateObservationSources: `${ROOT}/runtime/page-state-preflight.ts`,
  gateObservationProofBinding: `${ROOT}/runtime/page-state-preflight.ts`,
  gateSnapshotFreshness: `${ROOT}/runtime/page-state-preflight.ts`,
  gatePlatformProfile: `${ROOT}/runtime/page-state-preflight.ts`,
  gatePageStateOutputBoundary: `${ROOT}/runtime/state-classification-gate.ts`,
  classifyPageState: `${ROOT}/runtime/page-state-success-result.ts`,
  decideProceed: `${ROOT}/runtime/page-state-success-result.ts`,
  createPageStateFingerprint: `${ROOT}/runtime/page-state-success-result.ts`,
  buildPageStateRuntimeProof: `${ROOT}/runtime/page-state-success-result.ts`,
  buildPageStateResult: `${ROOT}/runtime/page-state-success-result.ts`,
} as const;

const LOCAL_RUNTIME_PAGE_STATE_DISPATCH_INPUT = "src/lib/local-runtime/workbench-page-state-dispatch-input.ts";
const LOCAL_RUNTIME_ABILITY_EXECUTOR = "src/lib/local-runtime/workbench-ability-command-executor.ts";

function resolveZodObjectLiteral(node: Node | undefined): ObjectLiteralExpression | null {
  if (!node || !Node.isCallExpression(node)) {
    return null;
  }

  const expression = node.getExpression();
  if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "z" && expression.getName() === "object") {
    const [argument] = node.getArguments();
    return Node.isObjectLiteralExpression(argument) ? argument : null;
  }

  return Node.isPropertyAccessExpression(expression) ? resolveZodObjectLiteral(expression.getExpression()) : null;
}

function getSchemaFields(project: Project, schemaName: string): Set<string> {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const initializer = schemaSource.getVariableDeclaration(schemaName)?.getInitializer();
  const objectLiteral = resolveZodObjectLiteral(initializer);
  if (!objectLiteral) {
    return new Set<string>();
  }

  return new Set(objectLiteral.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return [property.getName()];
    }
    return [];
  }));
}

function hasPropertyPath(sourceFile: SourceFile, path: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === path);
}

function countPropertyAssignments(sourceFile: SourceFile, propertyName: string): number {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).filter((property) => property.getName() === propertyName).length;
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

function getMissingRequiredFields(fieldSet: Set<string>, requiredFields: readonly string[]): string[] {
  return requiredFields.filter((field) => !fieldSet.has(field));
}

function mapMissingFieldFindings(input: { file: string; lawId: string; scope: string; missingFields: readonly string[] }): Finding[] {
  return input.missingFields.map((field) => createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scope} must include ${field}.` }));
}

function createMissingFieldFindings(input: { file: string; lawId: string; scope: string; fieldSet: Set<string>; requiredFields: readonly string[] }): Finding[] {
  return mapMissingFieldFindings({
    file: input.file,
    lawId: input.lawId,
    scope: input.scope,
    missingFields: getMissingRequiredFields(input.fieldSet, input.requiredFields),
  });
}

const inspectMissingCanonicalFiles = async (): Promise<Finding[]> => {
  const missingFiles = await missingCanonicalFiles();
  return missingFiles.map((file) =>
    createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Required page-state canonical file is missing." }),
  );
};

const inspectAbilityGroupShape = (project: Project): Finding[] => {
  const abilityGroupSource = getSource(project, `${ROOT}/ability-group.ts`);
  return isThinAbilityGroup(abilityGroupSource)
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V2", file: `${ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "Page State ability-group must stay a thin entrypoint." })];
};

const inspectContractShape = (project: Project): Finding[] => {
  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  return contractSource.getInterface("PageStateChildCapability")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V2", file: `${ROOT}/contract.ts`, line: 1, severity: "fatal", message: "Page State contract must not expose child execute interface." })]
    : [];
};

const inspectSchemaShape = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const childIds = getZodEnumValues(schemaSource, "PageStateChildCapabilityIdSchema");

  if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema child ids must match the frozen child registry." }));
  }

  if (!schemaSource.getVariableDeclaration("PageStateAbilityInputSchema") || !schemaSource.getVariableDeclaration("PageStateRuntimeProofSchema") || !schemaSource.getVariableDeclaration("PageStateAbilityResultSchema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must expose governed input/result/proof shapes." }));
  }

  if (countPropertyAssignments(schemaSource, "sourceProofRef") < 7) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must retain sourceProofRef on snapshot and every governed observation shape." }));
  }

  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateAbilityInputSchema", fieldSet: getSchemaFields(project, "PageStateAbilityInputSchema"), requiredFields: INPUT_CHAIN_FIELDS }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateSnapshotSchema", fieldSet: getSchemaFields(project, "PageStateSnapshotSchema"), requiredFields: ["currentUrl", "sourceProofRef"] }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateOpenHandoffPolicySchema", fieldSet: getSchemaFields(project, "PageStateOpenHandoffPolicySchema"), requiredFields: ["openProofRef", "browserSessionRef", "platformProfileId"] }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", scope: "PageStateRuntimeProofSchema", fieldSet: getSchemaFields(project, "PageStateRuntimeProofSchema"), requiredFields: RUNTIME_PROOF_CHAIN_FIELDS }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", scope: "PageStateAbilityResultSchema", fieldSet: getSchemaFields(project, "PageStateAbilityResultSchema"), requiredFields: RESULT_CHAIN_FIELDS }));

  return findings;
};

function inspectExecutorEntry(project: Project): Finding[] {
  const executorSource = getSource(project, `${ROOT}/runtime/page-state-executor.ts`);
  const executorRoutes = [
    { callee: "runPageStatePreflight", message: "Page State executor must route through runPageStatePreflight." },
    { callee: "buildPageStateSuccessResult", message: "Page State executor must route through buildPageStateSuccessResult." },
  ] as const;

  return executorRoutes.flatMap((route) =>
    hasCallExpression(executorSource, route.callee)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/runtime/page-state-executor.ts`, line: 1, severity: "fatal", message: route.message })],
  );
}

const inspectExecutorShape = (project: Project): Finding[] => {
  const routeFindings = Object.entries(EXECUTION_ROUTE_SOURCES).flatMap(([callee, file]) => {
    const source = getSource(project, file);
    return hasCallExpression(source, callee)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file, line: 1, severity: "fatal", message: `Page State execution chain must route through ${callee}.` })];
  });

  return [...inspectExecutorEntry(project), ...routeFindings];
};

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

const inspectBuilderShape = (project: Project): Finding[] => {
  return [
    ...collectBuilderParseFindings(project),
    ...collectProofBuilderPathFindings(project),
    ...collectProofBuilderAssignmentFindings(project),
    ...collectResultBuilderPathFindings(project),
    ...collectChildOutputParseFindings(project),
    ...collectLocalRuntimeDispatchBuilderFindings(project),
    ...collectLocalRuntimeExecutorFindings(project),
    ...collectNonSuccessParityFindings(project),
  ];
};

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingCanonicalFiles()),
    ...inspectAbilityGroupShape(project),
    ...inspectContractShape(project),
    ...inspectSchemaShape(project),
    ...inspectExecutorShape(project),
    ...inspectBuilderShape(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State V2 canonical package shape is present." : "Page State V2 canonical package shape is incomplete."),
  };
}