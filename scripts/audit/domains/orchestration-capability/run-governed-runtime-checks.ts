import { SyntaxKind } from "ts-morph";

import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createFinding, createPhase, fileExists, pathFromRepoRoot, readTextFile, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow } from "./inspection-ast-helpers.js";
import { inspectForensicsRetentionBoundary } from "./forensics-retention-boundary-phase.js";
import { inspectAiPromptContractTaskTypeDispatch } from "./ai-prompt-contract-tasktype-dispatch-checks.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { inspectMissionLoopTraceability } from "./mission-loop-traceability-phase.js";
import { inspectPersistentMissionRefChain } from "./persistent-mission-ref-chain-phase.js";
import { inspectStartMissionCommandBoundary } from "./start-mission-boundary-checks.js";
import { inspectAiStepTimeoutChain, inspectRoundAndVideoVisitChain } from "./run-governed-runtime-step-checks.js";
import { collectChildRunnerFindings, collectExecuteBoundaryFindings, collectForbiddenRoutingFindings } from "./run-governed-runtime-public-surface-checks.js";

const RESUME_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-resume.ts";
const PROOF_BUILDER_PATH = "src/capabilities/orchestration/runtime/orchestration-proof-builder.ts";
const STEP_DISPATCHER_PATH = "src/capabilities/orchestration/runtime/step-dispatcher.ts";
const MAP_VALIDATION_GATE_PATH = "src/capabilities/orchestration/runtime/map-validation-gate.ts";
const FORBIDDEN_HUMAN_REVIEW_CHILD_PATH = "src/capabilities/orchestration/children/request-human-review/implementation.ts";
const FROZEN_STATE_FIELDS = [
  "activationSnapshotRef",
  "selectedMapVersion",
  "mapPackageVersion",
  "capabilityCatalogVersion",
  "runLockId",
  "cancellationTokenRef",
  "resumeCheckpointRef",
] as const;
const FROZEN_PROOF_FIELDS = [
  "runId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "promptContractVersion",
  "capabilityCatalogVersion",
] as const;
const CHILD_OUTPUT_SCHEMA_NAMES = [
  "StartMissionChildOutputSchema",
  "PauseMissionChildOutputSchema",
  "ResumeMissionChildOutputSchema",
  "StopMissionChildOutputSchema",
  "EmergencyStopChildOutputSchema",
  "ExecuteMapStepChildOutputSchema",
  "EvaluateStepTransitionChildOutputSchema",
  "FinalizeMissionChildOutputSchema",
] as const;
const DIRECT_EXECUTOR_IMPORTS = new Set([
  "executeMissionCommand",
  "pauseMissionCommand",
  "resumeMissionCommand",
  "stopMissionCommand",
  "emergencyStopMissionCommand",
]);

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

function collectLineNumber(text: string, needle: string): number {
  const lines = text.split("\n");
  const lineIndex = lines.findIndex((line) => line.includes(needle));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
}

function createFatalFinding(input: { lawId: string; file: string; line: number; message: string; detail?: string }): Finding {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line,
    severity: "fatal",
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  });
}

function createRuntimePhase(name: string, findings: Finding[], passSummary: string, failSummary: string) {
  return createPhase(name, findings.length === 0 ? "PASS" : "CODE VIOLATION", findings.length === 0, findings.length === 0 ? passSummary : failSummary);
}

function inspectGovernedPublicSurface(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const findings: Finding[] = [];

  collectExecuteBoundaryFindings(project, findings);
  collectChildRunnerFindings(project, findings);
  collectForbiddenRoutingFindings(project, findings);

  return {
    findings,
    phase: createRuntimePhase(
      "governed-public-surface",
      findings,
      "Orchestration public execute surface is typed and the ability-group no longer bypasses the governed execute pipeline.",
      "Orchestration public surface is still broad, untyped, or bypasses the governed execute pipeline.",
    ),
  };
}

async function inspectForbiddenHumanReviewChildDeleted(): Promise<PhaseResult> {
  const exists = await fileExists(pathFromRepoRoot(FORBIDDEN_HUMAN_REVIEW_CHILD_PATH));
  const findings = exists
    ? [createFatalFinding({
      lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1",
      file: FORBIDDEN_HUMAN_REVIEW_CHILD_PATH,
      line: 1,
      message: "request-human-review child must stay physically deleted; automated agents cannot route into human review.",
    })]
    : [];
  return {
    findings,
    phase: createRuntimePhase(
      "human-review-child-removed",
      findings,
      "request-human-review is physically absent from the Orchestration child surface.",
      "request-human-review still exists in the Orchestration child surface.",
    ),
  };
}

async function inspectFrozenActivation(project: ReturnType<typeof createAuditProject>): Promise<PhaseResult> {
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const missionStateFields = getZodObjectPropertyNames(schemaSource, "MissionStateSchema");
  const missingStateFields = FROZEN_STATE_FIELDS.filter((fieldName) => !missionStateFields.has(fieldName));
  const resumeText = await readTextFile(pathFromRepoRoot(RESUME_PATH));
  const proofBuilderText = await readTextFile(pathFromRepoRoot(PROOF_BUILDER_PATH));
  const missingProofFields = FROZEN_PROOF_FIELDS.filter((fieldName) => !proofBuilderText.includes(fieldName));
  const findings: Finding[] = [];

  if (missingStateFields.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, message: "MissionState must freeze activation snapshot, map version, and loop-governance fields.", detail: missingStateFields.join(", ") }));
  }
  if (resumeText.includes("getActiveMapRecord(state.mapId)")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: RESUME_PATH, line: collectLineNumber(resumeText, "getActiveMapRecord(state.mapId)"), message: "Resume must not reread the floating active map registry by state.mapId; it must resume from a frozen activation snapshot." }));
  }
  if (missingProofFields.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: PROOF_BUILDER_PATH, line: 1, message: "Runtime proof builder must emit frozen activation snapshot fields for replayable orchestration proof.", detail: missingProofFields.join(", ") }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "frozen-activation-snapshot",
      findings,
      "Mission state and runtime proof both freeze activation snapshot state, and resume avoids floating active-map lookup.",
      "Mission state, runtime proof, or resume logic still permit floating active-map drift.",
    ),
  };
}

function inspectUnifiedChildEnvelope(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const initializerTexts = CHILD_OUTPUT_SCHEMA_NAMES
    .map((name) => schemaSource.getVariableDeclaration(name)?.getInitializer()?.getText() ?? null)
    .filter((value): value is string => Boolean(value));
  const uniqueInitializers = [...new Set(initializerTexts)];
  const findings: Finding[] = [];

  if (uniqueInitializers.length > 1) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, message: "All orchestration child outputs must converge on one governed result envelope schema.", detail: uniqueInitializers.join(", ") }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "unified-child-envelope",
      findings,
      "All orchestration children share one governed output envelope.",
      "Orchestration children still return mixed output shapes instead of one governed envelope.",
    ),
  };
}

function inspectRuntimeProofRunIdChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const schemaSource = getSourceFileOrThrow(project, config.SCHEMA_PATH);
  const proofBuilderSource = getSourceFileOrThrow(project, PROOF_BUILDER_PATH);
  const runtimeProofFields = getZodObjectPropertyNames(schemaSource, "RuntimeProofSchema");
  const buildProofInput = proofBuilderSource.getTypeAlias("BuildProofInput");
  const buildProofInputFields = new Set(buildProofInput?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.PropertySignature).map((signature) => signature.getName()) ?? []);
  const identityFunction = proofBuilderSource.getFunction("buildOrchestrationProofIdentityFields");
  const emitsRunId = Boolean(identityFunction?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    return property.getName() === "runId" && property.getInitializer()?.getText() === "input.runId";
  }));
  const findings: Finding[] = [];

  if (!runtimeProofFields.has("runId")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.SCHEMA_PATH, line: 1, message: "Orchestration RuntimeProofSchema must require runId so Commander/Nerve Bus/Orchestration proof chains cannot lose run identity." }));
  }
  if (!buildProofInputFields.has("runId") || !emitsRunId) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: PROOF_BUILDER_PATH, line: 1, message: "Orchestration runtime proof builder must accept and emit input.runId at symbol level." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "runtime-proof-runid-chain",
      findings,
      "Orchestration runtime proof schema and builder preserve runId.",
      "Orchestration runtime proof schema or builder can still drop runId.",
    ),
  };
}

function inspectTypedFailureBoundary(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const findings: Finding[] = [];

  for (const filePath of [
    "src/capabilities/orchestration/runtime/orchestration-executor.ts",
    "src/capabilities/orchestration/children/finalize-mission/implementation.ts",
  ] as const) {
    const sourceFile = getSourceFileOrThrow(project, filePath);
    for (const throwStatement of sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement)) {
      findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: filePath, line: throwStatement.getStartLineNumber(), message: "Orchestration public boundary and child execution must convert failures into typed envelopes rather than throwing." }));
    }
  }

  return {
    findings,
    phase: createRuntimePhase(
      "typed-failure-boundary",
      findings,
      "Orchestration public and child boundaries convert failures into typed results without naked throws.",
      "Orchestration still contains naked throws across public or child execution boundaries.",
    ),
  };
}

function inspectPostActionVerificationChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const mapValidationSource = getSourceFileOrThrow(project, MAP_VALIDATION_GATE_PATH);
  const stepDispatcherSource = getSourceFileOrThrow(project, STEP_DISPATCHER_PATH);
  const findings: Finding[] = [];
  const hasMapValidationCall = mapValidationSource.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => callExpression.getExpression().getText() === "ensurePostActionVerificationPolicy");
  const hasStepDispatchCall = stepDispatcherSource.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => callExpression.getExpression().getText() === "ensurePostActionVerificationDispatchGate");

  if (!hasMapValidationCall) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: MAP_VALIDATION_GATE_PATH, line: 1, message: "Map validation gate must enforce postActionVerification policy on state-changing action steps." }));
  }
  if (!hasStepDispatchCall) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCHER_PATH, line: 1, message: "Step dispatcher must force post-action verification after state-changing action steps." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "post-action-verification-chain",
      findings,
      "Orchestration validates and dispatches post-action verification for state-changing action steps.",
      "Orchestration still allows action steps to complete without mandatory post-action verification chaining.",
    ),
  };
}

export async function runOrchestrationGovernedRuntimeChecks(project: ReturnType<typeof createAuditProject>) {
  const phaseResults = await Promise.all([
    Promise.resolve(inspectGovernedPublicSurface(project)),
    inspectForbiddenHumanReviewChildDeleted(),
    inspectFrozenActivation(project),
    Promise.resolve(inspectUnifiedChildEnvelope(project)),
    Promise.resolve(inspectRuntimeProofRunIdChain(project)),
    Promise.resolve(inspectPersistentMissionRefChain(project)),
    Promise.resolve(inspectTypedFailureBoundary(project)),
    Promise.resolve(inspectPostActionVerificationChain(project)),
    Promise.resolve(inspectRoundAndVideoVisitChain(project)),
    Promise.resolve(inspectAiStepTimeoutChain(project)),
    inspectAiPromptContractTaskTypeDispatch(),
    Promise.resolve(inspectMissionLoopTraceability(project)),
    Promise.resolve(inspectStartMissionCommandBoundary(project)),
    inspectForensicsRetentionBoundary(),
  ]);

  return {
    findings: phaseResults.flatMap((result) => result.findings),
    phases: phaseResults.map((result) => result.phase),
  };
}
