import { SyntaxKind } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  BOUNDARY_POLICY_PATH,
  CHILD_EXECUTORS_PATH,
  COMMAND_GATE_PATH,
  DISPATCH_FAILURE_PATH,
  EXECUTOR_PATH,
  PROOF_BUILDER_PATH,
  READ_GATE_PATH,
  RESULT_BUILDER_PATH,
} = commanderConsoleInspectionConstants;
const { countOccurrences, hasPassthrough } = commanderConsoleInspectionUtils;

type RuntimeCheckResult = {
  findings: Finding[];
  readGatePassthrough: boolean;
  childExecutorReceiptCount: number;
};

const collectAbilityGroupFindings = (abilityGroupSource: import("ts-morph").SourceFile): Finding[] => {
  const invalid = !hasCallExpression(abilityGroupSource, "executeCommanderConsoleChild")
    || abilityGroupSource.getFullText().includes("dispatchHumanCommand")
    || hasImportModuleSpecifier(abilityGroupSource, "ports/")
    || abilityGroupSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;

  return invalid
    ? [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "ability-group.ts must stay thin and route only through registry plus runtime executor." })]
    : [];
};

const collectGateFindings = (input: {
  commandGateSource: import("ts-morph").SourceFile;
  readGateSource: import("ts-morph").SourceFile;
}): { findings: Finding[]; readGatePassthrough: boolean } => {
  const findings: Finding[] = [];
  const commandGateValid = [
    "StartMissionTransportPayloadSchema.parse",
    "PauseMissionTransportPayloadSchema.parse",
    "ResumeMissionTransportPayloadSchema.parse",
    "StopMissionTransportPayloadSchema.parse",
    "EmergencyStopTransportPayloadSchema.parse",
    "ApproveCandidateTransportPayloadSchema.parse",
    "RejectCandidateTransportPayloadSchema.parse",
    "MarkReviewRequiredTransportPayloadSchema.parse",
    "CommandTransportResultSchema.parse",
  ].every((fragment) => input.commandGateSource.getFullText().includes(fragment))
    && input.commandGateSource.getFullText().includes("Child ${input.childCapabilityId} only owns ${expectedCommandType}.")
    && input.commandGateSource.getFullText().includes("emergency-stop must dispatch with emergency priority.");
  if (!commandGateValid) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-001-V1", file: COMMAND_GATE_PATH, line: 1, severity: "fatal", message: "commander-command-gate.ts must be command-specific and must parse both transport payloads and transport results." }));
  }

  const readGatePassthrough = hasPassthrough(input.readGateSource);
  if (!hasCallExpression(input.readGateSource, "safeParse") || readGatePassthrough || !input.readGateSource.getFullText().includes("operatorRef is required.")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: READ_GATE_PATH, line: 1, severity: "fatal", message: "commander-read-gate.ts must stay strict and must not accept passthrough input." }));
  }

  return { findings, readGatePassthrough };
};

const collectExecutorSurfaceFindings = (input: {
  executorSource: import("ts-morph").SourceFile;
  resultBuilderSource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];
  const executorValid = [
    "createMissingChildOutcome",
    "buildCommanderRuntimeProof",
    "buildCommanderConsoleResult",
    "input.child.inputSchema.safeParse",
    "input.child.outputSchema.safeParse",
  ].every((fragment) => input.executorSource.getFullText().includes(fragment));
  if (!executorValid) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Commander executor must own missing-child fallback, schema gates, runtime proof, and public result building." }));
  }
  if (!input.resultBuilderSource.getFullText().includes("CommanderCommandReceiptSchema.parse") || !input.resultBuilderSource.getFullText().includes("CommanderConsoleResultSchema.parse")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Commander result builders must parse governed receipts and public result envelopes." }));
  }

  return findings;
};

const collectProofAndBoundaryFindings = (input: {
  proofBuilderSource: import("ts-morph").SourceFile;
  dispatchFailureSource: import("ts-morph").SourceFile;
  boundaryPolicySource: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!input.proofBuilderSource.getFullText().includes("RuntimeProofSchema.parse") || !input.proofBuilderSource.getFullText().includes("hardStopDecision") || input.proofBuilderSource.getFullText().includes("Date.parse")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Commander proof builder must parse RuntimeProofSchema and preserve hard-stop proof fields." }));
  }
  if (!input.dispatchFailureSource.getFullText().includes("dispatch_child_missing") || input.dispatchFailureSource.getFullText().includes("throw new Error")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: DISPATCH_FAILURE_PATH, line: 1, severity: "fatal", message: "Missing-child dispatch failures must be governed and non-throwing." }));
  }
  if (!input.boundaryPolicySource.getFullText().includes("buildCommanderEvidenceRef") || !input.boundaryPolicySource.getFullText().includes("transport_missing_envelope")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: BOUNDARY_POLICY_PATH, line: 1, severity: "fatal", message: "Commander boundary policy must build structured evidence refs and envelope quality flags." }));
  }

  return findings;
};

const collectChildExecutorFindings = (childExecutorsSource: import("ts-morph").SourceFile): { findings: Finding[]; childExecutorReceiptCount: number } => {
  const childExecutorReceiptCount = countOccurrences(childExecutorsSource.getFullText(), "output: receipt,");
  const findings = childExecutorReceiptCount < 3 || !childExecutorsSource.getFullText().includes("hard-stop-dispatch-failed")
    ? [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: CHILD_EXECUTORS_PATH, line: 1, severity: "fatal", message: "Commander child executors must emit governed command receipts on failure and preserve hard-stop/not-found policy decisions." })]
    : [];
  return { findings, childExecutorReceiptCount };
};

export function runCommanderRuntimeChecks(project: import("ts-morph").Project): RuntimeCheckResult {
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const commandGateSource = getSourceFileOrThrow(project, COMMAND_GATE_PATH);
  const readGateSource = getSourceFileOrThrow(project, READ_GATE_PATH);
  const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
  const dispatchFailureSource = getSourceFileOrThrow(project, DISPATCH_FAILURE_PATH);
  const boundaryPolicySource = getSourceFileOrThrow(project, BOUNDARY_POLICY_PATH);
  const childExecutorsSource = getSourceFileOrThrow(project, CHILD_EXECUTORS_PATH);

  const gateResult = collectGateFindings({ commandGateSource, readGateSource });
  const childExecutorResult = collectChildExecutorFindings(childExecutorsSource);

  return {
    findings: [
      ...collectAbilityGroupFindings(abilityGroupSource),
      ...gateResult.findings,
      ...collectExecutorSurfaceFindings({ executorSource, resultBuilderSource }),
      ...collectProofAndBoundaryFindings({ proofBuilderSource, dispatchFailureSource, boundaryPolicySource }),
      ...childExecutorResult.findings,
    ],
    readGatePassthrough: gateResult.readGatePassthrough,
    childExecutorReceiptCount: childExecutorResult.childExecutorReceiptCount,
  };
}