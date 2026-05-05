import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  BOUNDARY_POLICY_PATH,
  CHILD_EXECUTORS_PATH,
  COMMAND_CHILD_EXECUTOR_PATH,
  COMMAND_GATE_PATH,
  COMMAND_OUTCOMES_PATH,
  COMMAND_PAYLOAD_PATH,
  DISPATCH_FAILURE_PATH,
  EXECUTOR_PATH,
  IDEMPOTENCY_GATE_PATH,
  PROOF_BUILDER_PATH,
  READ_CHILD_EXECUTOR_PATH,
  READ_GATE_PATH,
  READ_PROOF_GATE_PATH,
  RESULT_BUILDER_PATH,
  TIMEOUT_GATE_PATH,
  TRANSPORT_SCHEMA_PATH,
  TRANSPORT_SEMANTIC_GATE_PATH,
} = commanderConsoleInspectionConstants;
const { countOccurrences, hasPassthrough } = commanderConsoleInspectionUtils;

type RuntimeCheckResult = {
  findings: Finding[];
  readGatePassthrough: boolean;
  childExecutorReceiptCount: number;
};

const createFatalFinding = (lawId: string, file: string, message: string): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message });

const hasNamedImport = (sourceFile: import("ts-morph").SourceFile, moduleSuffix: string, importName: string) => {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.endsWith(moduleSuffix)
      && declaration.getNamedImports().some((namedImport) => namedImport.getName() === importName);
  });
};

const collectAbilityGroupFindings = (abilityGroupSource: import("ts-morph").SourceFile): Finding[] => {
  const invalid = !hasCallExpression(abilityGroupSource, "executeCommanderConsoleChild")
    || abilityGroupSource.getFullText().includes("dispatchHumanCommand")
    || hasImportModuleSpecifier(abilityGroupSource, "ports/")
    || abilityGroupSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;

  return invalid
    ? [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2", ABILITY_GROUP_PATH, "ability-group.ts must stay thin and route only through registry plus runtime executor.")]
    : [];
};

const isCommandGateValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return hasCallExpression(sourceFile, "safeParse")
    && text.includes("buildTransportPayload")
    && text.includes("buildCommandIdempotencyKey")
    && text.includes("timeoutMs: input.maxDurationMs")
    && text.includes("Child ${input.childCapabilityId} only owns ${expectedCommandType}.")
    && text.includes("emergency-stop must dispatch with emergency priority.");
};

const isCommandPayloadValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("buildStartMissionPayloadInput")
    && text.includes("StartMissionTransportPayloadSchema")
    && text.includes("safeParsePayload")
    && text.includes('createHash("sha256")');
};

const isTransportSchemaValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return countOccurrences(text, "!value.requestedPlatformId || !value.selectedMapId") >= 2
    && text.includes("start-mission requires both requestedPlatformId and selectedMapId")
    && text.includes("start-mission payload requires both requestedPlatformId and selectedMapId");
};

const isReadGateValid = (sourceFile: import("ts-morph").SourceFile, readGatePassthrough: boolean) => {
  return hasCallExpression(sourceFile, "safeParse")
    && !readGatePassthrough
    && sourceFile.getFullText().includes("operatorRef is required.");
};

const collectGateFindings = (input: {
  commandGateSource: import("ts-morph").SourceFile;
  commandPayloadSource: import("ts-morph").SourceFile;
  readGateSource: import("ts-morph").SourceFile;
  transportSchemaSource: import("ts-morph").SourceFile;
}): { findings: Finding[]; readGatePassthrough: boolean } => {
  const findings: Finding[] = [];
  if (!isCommandGateValid(input.commandGateSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_GATE_PATH, "commander-command-gate.ts must enforce explicit start inputs, safe payload parsing, timeoutMs, and idempotencyKey generation."));
  }

  if (!isCommandPayloadValid(input.commandPayloadSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_PAYLOAD_PATH, "commander-command-payload.ts must parse command payloads and build deterministic idempotency keys."));
  }

  if (!isTransportSchemaValid(input.transportSchemaSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TRANSPORT_SCHEMA_PATH, "Commander transport schema must require both requestedPlatformId and selectedMapId for start-mission commands and payloads."));
  }

  const readGatePassthrough = hasPassthrough(input.readGateSource);
  if (!isReadGateValid(input.readGateSource, readGatePassthrough)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2", READ_GATE_PATH, "commander-read-gate.ts must stay strict and must not accept passthrough input."));
  }

  return { findings, readGatePassthrough };
};

const isExecutorSurfaceValid = (sourceFile: import("ts-morph").SourceFile) => {
  return [
    "createMissingChildOutcome",
    "buildCommanderRuntimeProof",
    "buildCommanderConsoleResult",
    "input.child.inputSchema.safeParse",
    "input.child.outputSchema.safeParse",
  ].every((fragment) => sourceFile.getFullText().includes(fragment));
};

const isResultBuilderValid = (sourceFile: import("ts-morph").SourceFile) => sourceFile.getFullText().includes("CommanderCommandReceiptSchema.parse")
  && sourceFile.getFullText().includes("CommanderConsoleResultSchema.parse");

const collectExecutorSurfaceFindings = (input: {
  executorSource: import("ts-morph").SourceFile;
  resultBuilderSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  if (!isExecutorSurfaceValid(input.executorSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2", EXECUTOR_PATH, "Commander executor must own missing-child fallback, schema gates, runtime proof, and public result building."));
  }
  if (!isResultBuilderValid(input.resultBuilderSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2", RESULT_BUILDER_PATH, "Commander result builders must parse governed receipts and public result envelopes."));
  }

  return findings;
};

const isProofBuilderValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("RuntimeProofSchema.parse")
    && text.includes("hardStopDecision")
    && text.includes("timeoutDecision")
    && text.includes("idempotencyDecision")
    && !text.includes("Date.parse");
};

const isDispatchFailureValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("dispatch_child_missing") && !text.includes("throw new Error");
};

const isBoundaryPolicyValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("buildCommanderEvidenceRef") && text.includes("transport_missing_envelope");
};

const collectProofAndBoundaryFindings = (input: {
  proofBuilderSource: import("ts-morph").SourceFile;
  dispatchFailureSource: import("ts-morph").SourceFile;
  boundaryPolicySource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!isProofBuilderValid(input.proofBuilderSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", PROOF_BUILDER_PATH, "Commander proof builder must parse RuntimeProofSchema and preserve hard-stop, timeout, and idempotency proof fields."));
  }
  if (!isDispatchFailureValid(input.dispatchFailureSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-008-V2", DISPATCH_FAILURE_PATH, "Missing-child dispatch failures must be governed and non-throwing."));
  }
  if (!isBoundaryPolicyValid(input.boundaryPolicySource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", BOUNDARY_POLICY_PATH, "Commander boundary policy must build structured evidence refs and envelope quality flags."));
  }

  return findings;
};

const isTimeoutGateValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("Promise.race")
    && text.includes("timed-out-review-required")
    && text.includes("within-timeout");
};

const isIdempotencyGateValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes('if (input.policy === "hard-stop-non-dedupe") {')
    && text.includes("input.state.completed.has(gateKey)")
    && text.includes("input.state.inflight.get(gateKey)")
    && text.includes("reused-inflight-result")
    && text.includes("reused-cached-result");
};

const isTransportSemanticGateValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("if (input.result.commandId !== input.command.commandId) {")
    && text.includes('if (input.result.status === "accepted" && !input.result.envelopeRef) {')
    && text.includes('if (input.result.status === "failed" && !input.result.failureReason) {')
    && text.includes('if (input.result.status === "review_required" && !input.result.reviewRequiredReason) {')
	    && text.includes('if (result.status !== "accepted" || result.resultEnvelopeRef) {');
};

const getObjectLiteralPropertyNamesFromVariable = (sourceFile: import("ts-morph").SourceFile, variableName: string): Set<string> => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
  const objectCall = initializer && Node.isCallExpression(initializer) && initializer.getExpression().getText().endsWith(".object")
    ? initializer
    : initializer?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText().endsWith(".object"));
  const objectLiteral = objectCall?.getArguments()[0] ?? null;
  if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) {
    return new Set();
  }
  return new Set(objectLiteral.getProperties().flatMap((property) => Node.isPropertyAssignment(property) ? [property.getName()] : []));
};

const getVariableFunctionBody = (sourceFile: import("ts-morph").SourceFile, variableName: string) => {
  const initializer = sourceFile.getVariableDeclaration(variableName)?.getInitializer();
  return initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))
    ? initializer.getBody()
    : null;
};

const hasRunIdPropertyFromTransport = (sourceFile: import("ts-morph").SourceFile, functionName: string): boolean => {
  const body = getVariableFunctionBody(sourceFile, functionName);
  if (!body) {
    return false;
  }
  return body.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== "runId") {
      return false;
    }
    const initializer = property.getInitializer();
    return Boolean(initializer && initializer.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "input.transport.runId"));
  });
};

const hasRunIdNullInsideFunction = (sourceFile: import("ts-morph").SourceFile, functionName: string): boolean => {
  const body = getVariableFunctionBody(sourceFile, functionName);
  if (!body) {
    return false;
  }
  return body.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "runId" && property.getInitializer()?.getKind() === SyntaxKind.NullKeyword);
};

const collectTransportRunIdFindings = (input: {
  transportSchemaSource: import("ts-morph").SourceFile;
  transportSemanticGateSource: import("ts-morph").SourceFile;
  commandOutcomesSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  const transportResultFields = getObjectLiteralPropertyNamesFromVariable(input.transportSchemaSource, "CommandTransportResultSchema");
  if (!transportResultFields.has("runId")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TRANSPORT_SCHEMA_PATH, "Commander transport result schema must require runId before command outcomes can build runtime proof."));
  }
  if (!hasRunIdPropertyFromTransport(input.commandOutcomesSource, "createTransportOutcome")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_OUTCOMES_PATH, "createTransportOutcome must preserve runId from the governed transport result instead of nulling or fabricating it."));
  }
  if (hasRunIdNullInsideFunction(input.commandOutcomesSource, "createTransportOutcome")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_OUTCOMES_PATH, "Dispatched command outcome must not assign runId:null."));
  }
  if (!input.transportSemanticGateSource.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "input.result.runId")) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2", TRANSPORT_SEMANTIC_GATE_PATH, "Commander transport semantic gate must validate transport result runId."));
  }
  return findings;
};

const isReadProofGateValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("input.contract.readModelSource")
    && text.includes("input.contract.proofPolicy.requiresStructuredEvidenceRefs && input.evidenceRefs.length === 0")
    && text.includes("input.contract.evidencePolicy.targetRecordRequired && !input.targetRecordRef")
    && text.includes("input.contract.evidencePolicy.proofRefRequired && input.evidenceRefs.some((evidenceRef) => !evidenceRef.proofRef)")
    && text.includes("input.evidenceRefs.some((evidenceRef) => !input.contract.evidencePolicy.recordTypes.includes(evidenceRef.recordType))");
};

const isCommandOutcomesValid = (sourceFile: import("ts-morph").SourceFile) => {
  const text = sourceFile.getFullText();
  return text.includes("hard-stop-dispatch-failed")
    && text.includes("hard-stop-review-required")
    && text.includes("timeout_guarded")
    && text.includes("transport_guarded");
};

const collectGateFileFindings = (input: {
  timeoutGateSource: import("ts-morph").SourceFile;
  idempotencyGateSource: import("ts-morph").SourceFile;
  transportSemanticGateSource: import("ts-morph").SourceFile;
  readProofGateSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!isTimeoutGateValid(input.timeoutGateSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", TIMEOUT_GATE_PATH, "Commander timeout gate must race execution and emit governed timeout decisions."));
  }

  if (!isIdempotencyGateValid(input.idempotencyGateSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", IDEMPOTENCY_GATE_PATH, "Commander idempotency gate must preserve dedupe-command, idempotent-read, and hard-stop-non-dedupe behavior."));
  }

  if (!isTransportSemanticGateValid(input.transportSemanticGateSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-005-V2", TRANSPORT_SEMANTIC_GATE_PATH, "Commander transport semantic gate must validate commandId, envelope refs, and failure/review reasons."));
  }

  if (!isReadProofGateValid(input.readProofGateSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V2", READ_PROOF_GATE_PATH, "Commander read proof gate must validate evidenceRefs, targetRecordRef, proofRef, and recordType boundaries."));
  }

  return findings;
};

const hasCommandRuntimeImports = (sourceFile: import("ts-morph").SourceFile) => {
  return hasNamedImport(sourceFile, "commander-timeout-gate.js", "runCommanderTimeoutGate")
    && hasNamedImport(sourceFile, "commander-idempotency-gate.js", "runCommanderIdempotencyGate")
    && hasNamedImport(sourceFile, "commander-transport-semantic-gate.js", "applyCommanderTransportSemanticGate")
    && hasNamedImport(sourceFile, "commander-command-outcomes.js", "createCommandTimeoutOutcome")
    && hasNamedImport(sourceFile, "commander-command-outcomes.js", "createTransportOutcome");
};

const hasCommandRuntimeCalls = (sourceFile: import("ts-morph").SourceFile) => {
  return hasCallExpression(sourceFile, "runCommanderTimeoutGate")
    && hasCallExpression(sourceFile, "runCommanderIdempotencyGate")
    && hasCallExpression(sourceFile, "applyCommanderTransportSemanticGate")
    && hasCallExpression(sourceFile, "createCommandTimeoutOutcome")
    && hasCallExpression(sourceFile, "createTransportOutcome");
};

const hasCommandRuntimeWiring = (sourceFile: import("ts-morph").SourceFile) => {
  return hasCommandRuntimeImports(sourceFile) && hasCommandRuntimeCalls(sourceFile);
};

const collectCommandRuntimeFindings = (input: {
  executorSource: import("ts-morph").SourceFile;
  outcomesSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  if (!hasCommandRuntimeWiring(input.executorSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V2", COMMAND_CHILD_EXECUTOR_PATH, "Command execution must invoke timeout, idempotency, and transport semantic gates and preserve emergency hard-stop proof."));
  }
  if (!isCommandOutcomesValid(input.outcomesSource)) {
    findings.push(createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2", COMMAND_OUTCOMES_PATH, "Command outcome builders must preserve hard-stop and timeout guarded receipt states."));
  }
  return findings;
};

const hasReadRuntimeWiring = (sourceFile: import("ts-morph").SourceFile) => {
  return hasNamedImport(sourceFile, "commander-timeout-gate.js", "runCommanderTimeoutGate")
    && hasNamedImport(sourceFile, "commander-idempotency-gate.js", "runCommanderIdempotencyGate")
    && hasNamedImport(sourceFile, "commander-read-proof-gate.js", "applyCommanderReadProofGate")
    && hasCallExpression(sourceFile, "runCommanderTimeoutGate")
    && hasCallExpression(sourceFile, "runCommanderIdempotencyGate")
    && hasCallExpression(sourceFile, "applyCommanderReadProofGate")
    && sourceFile.getFullText().includes("timed-out-review-required");
};

const collectReadRuntimeFindings = (sourceFile: import("ts-morph").SourceFile): Finding[] => {
  return hasReadRuntimeWiring(sourceFile)
    ? []
    : [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V2", READ_CHILD_EXECUTOR_PATH, "Read execution must invoke timeout, idempotency, and read-proof gates.")];
};

const collectChildExecutorFindings = (childExecutorsSource: import("ts-morph").SourceFile): { findings: Finding[]; childExecutorReceiptCount: number } => {
  const childExecutorReceiptCount = countOccurrences(childExecutorsSource.getFullText(), "output: receipt,");
  const findings = childExecutorReceiptCount < 3 || !childExecutorsSource.getFullText().includes("hard-stop-dispatch-failed")
    ? [createFatalFinding("GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-007-V2", CHILD_EXECUTORS_PATH, "Commander child executors must emit governed command receipts on failure and preserve hard-stop/not-found policy decisions.")]
    : [];
  return { findings, childExecutorReceiptCount };
};

export function runCommanderRuntimeChecks(project: import("ts-morph").Project): RuntimeCheckResult {
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const commandGateSource = getSourceFileOrThrow(project, COMMAND_GATE_PATH);
  const commandPayloadSource = getSourceFileOrThrow(project, COMMAND_PAYLOAD_PATH);
  const readGateSource = getSourceFileOrThrow(project, READ_GATE_PATH);
  const transportSchemaSource = getSourceFileOrThrow(project, TRANSPORT_SCHEMA_PATH);
  const commandChildExecutorSource = getSourceFileOrThrow(project, COMMAND_CHILD_EXECUTOR_PATH);
  const commandOutcomesSource = getSourceFileOrThrow(project, COMMAND_OUTCOMES_PATH);
  const readChildExecutorSource = getSourceFileOrThrow(project, READ_CHILD_EXECUTOR_PATH);
  const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
  const dispatchFailureSource = getSourceFileOrThrow(project, DISPATCH_FAILURE_PATH);
  const boundaryPolicySource = getSourceFileOrThrow(project, BOUNDARY_POLICY_PATH);
  const childExecutorsSource = getSourceFileOrThrow(project, CHILD_EXECUTORS_PATH);
  const timeoutGateSource = getSourceFileOrThrow(project, TIMEOUT_GATE_PATH);
  const idempotencyGateSource = getSourceFileOrThrow(project, IDEMPOTENCY_GATE_PATH);
  const transportSemanticGateSource = getSourceFileOrThrow(project, TRANSPORT_SEMANTIC_GATE_PATH);
  const readProofGateSource = getSourceFileOrThrow(project, READ_PROOF_GATE_PATH);

  const gateResult = collectGateFindings({ commandGateSource, commandPayloadSource, readGateSource, transportSchemaSource });
  const childExecutorResult = collectChildExecutorFindings(childExecutorsSource);

  return {
    findings: [
      ...collectAbilityGroupFindings(abilityGroupSource),
      ...gateResult.findings,
	      ...collectCommandRuntimeFindings({ executorSource: commandChildExecutorSource, outcomesSource: commandOutcomesSource }),
	      ...collectTransportRunIdFindings({ transportSchemaSource, transportSemanticGateSource, commandOutcomesSource }),
      ...collectReadRuntimeFindings(readChildExecutorSource),
      ...collectExecutorSurfaceFindings({ executorSource, resultBuilderSource }),
      ...collectProofAndBoundaryFindings({ proofBuilderSource, dispatchFailureSource, boundaryPolicySource }),
      ...collectGateFileFindings({ timeoutGateSource, idempotencyGateSource, transportSemanticGateSource, readProofGateSource }),
      ...childExecutorResult.findings,
    ],
    readGatePassthrough: gateResult.readGatePassthrough,
    childExecutorReceiptCount: childExecutorResult.childExecutorReceiptCount,
  };
}
