import { Node, SyntaxKind } from "ts-morph";

import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createFinding, createPhase, fileExists, pathFromRepoRoot, readTextFile, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpressionPath } from "./inspection-ast-helpers.js";
import { inspectForensicsRetentionBoundary } from "./forensics-retention-boundary-phase.js";
import { inspectAiPromptContractTaskTypeDispatch } from "./ai-prompt-contract-tasktype-dispatch-checks.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { inspectMissionLoopTraceability } from "./mission-loop-traceability-phase.js";
import { inspectStartMissionCommandBoundary } from "./start-mission-boundary-checks.js";

const NEGATIVE_PROOF_HARNESS_PATH = "scripts/audit/domains/orchestration-capability/negative-proof-harness.ts";
const RESUME_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-resume.ts";
const PROOF_BUILDER_PATH = "src/capabilities/orchestration/runtime/orchestration-proof-builder.ts";
const STEP_DISPATCHER_PATH = "src/capabilities/orchestration/runtime/step-dispatcher.ts";
const STEP_DISPATCH_SHARED_PATH = "src/capabilities/orchestration/runtime/step-dispatch-shared.ts";
const STEP_DISPATCH_REQUEST_BUILDERS_PATH = "src/capabilities/orchestration/runtime/step-dispatch-request-builders.ts";
const MAP_VALIDATION_GATE_PATH = "src/capabilities/orchestration/runtime/map-validation-gate.ts";
const CHILD_RUNNER_PATH = "src/capabilities/orchestration/runtime/orchestration-child-runner.ts";
const EXECUTOR_PATH = "src/capabilities/orchestration/runtime/orchestration-executor.ts";
const THROW_BOUNDARY_PATHS = [
  EXECUTOR_PATH,
  "src/capabilities/orchestration/children/request-human-review/implementation.ts",
  "src/capabilities/orchestration/children/finalize-mission/implementation.ts",
] as const;
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
  "RequestHumanReviewChildOutputSchema",
  "FinalizeMissionChildOutputSchema",
] as const;
const DIRECT_EXECUTOR_IMPORTS = new Set([
  "executeMissionCommand",
  "pauseMissionCommand",
  "resumeMissionCommand",
  "stopMissionCommand",
  "emergencyStopMissionCommand",
  "submitMissionReviewDecision",
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

function hasCallObjectProperty(sourceFile: ReturnType<typeof getSourceFileOrThrow>, callName: string, propertyName: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== callName) {
      return false;
    }

    const [firstArgument] = callExpression.getArguments();
    return Boolean(firstArgument && Node.isObjectLiteralExpression(firstArgument) && firstArgument.getProperty(propertyName));
  });
}

function inspectGovernedPublicSurface(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const contractSource = getSourceFileOrThrow(project, config.CONTRACT_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const childRunnerSource = getSourceFileOrThrow(project, CHILD_RUNNER_PATH);
  const findings: Finding[] = [];

  const executeMethod = contractSource.getInterface("OrchestrationAbilityGroup")?.getMethod("execute");
  const executeReturnText = executeMethod?.getReturnTypeNode()?.getText() ?? "";
  if (executeReturnText.includes("unknown")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.CONTRACT_PATH, line: executeMethod?.getStartLineNumber() ?? 1, message: "Orchestration public execute boundary must return a governed typed result, not Promise<unknown>." }));
  }

  const directExecutorImports = abilityGroupSource
    .getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "./runtime/orchestration-executor.js")
    .flatMap((declaration) => declaration.getNamedImports())
    .map((specifier) => specifier.getName())
    .filter((specifier) => DIRECT_EXECUTOR_IMPORTS.has(specifier));
  if (directExecutorImports.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: config.ABILITY_GROUP_PATH, line: 1, message: "Orchestration ability-group public methods must not call granular executor commands directly; retain only governed execute plus thin wrappers.", detail: directExecutorImports.join(", ") }));
  }

  const childRunnerText = childRunnerSource.getFullText();
  if (childRunnerText.includes("runtimeProof: null")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: CHILD_RUNNER_PATH, line: collectLineNumber(childRunnerText, "runtimeProof: null"), message: "Unknown orchestration child failure must carry typed proof and must not return runtimeProof:null." }));
  }
  if ((childRunnerSource.getFunction("executeOrchestrationChild")?.getReturnTypeNode()?.getText() ?? "").includes("unknown")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: CHILD_RUNNER_PATH, line: childRunnerSource.getFunction("executeOrchestrationChild")?.getStartLineNumber() ?? 1, message: "Orchestration child executor pipeline must return a governed envelope, not Promise<unknown>." }));
  }

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

  for (const filePath of THROW_BOUNDARY_PATHS) {
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

  if (!hasCallExpressionPath(mapValidationSource, ["ensurePostActionVerificationPolicy"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: MAP_VALIDATION_GATE_PATH, line: 1, message: "Map validation gate must enforce postActionVerification policy on state-changing action steps." }));
  }
  if (!hasCallExpressionPath(stepDispatcherSource, ["ensurePostActionVerificationDispatchGate"])) {
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

function inspectAiStepTimeoutChain(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const sharedSource = getSourceFileOrThrow(project, STEP_DISPATCH_SHARED_PATH);
  const dispatcherSource = getSourceFileOrThrow(project, STEP_DISPATCHER_PATH);
  const requestBuilderSource = getSourceFileOrThrow(project, STEP_DISPATCH_REQUEST_BUILDERS_PATH);
  const findings: Finding[] = [];

  if (!hasCallExpressionPath(sharedSource, ["Number", "isFinite"]) || !sharedSource.getFullText().includes("step.timeoutPolicy.maxDurationMs")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCH_SHARED_PATH, line: 1, message: "Orchestration must resolve dispatch timeout from the governed map step timeoutPolicy." }));
  }
  if (!hasCallExpressionPath(dispatcherSource, ["dispatchWithTimeout"]) || !dispatcherSource.getFullText().includes("AI dispatch timed out after ${timeoutMs}ms")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCHER_PATH, line: 1, message: "AI step dispatch must be wrapped by the resolved step timeout and return a governed timeout failure." }));
  }
  if (!requestBuilderSource.getFullText().includes("timeoutMs: resolveStepTimeoutMs(input.step)")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-001-V1", file: STEP_DISPATCH_REQUEST_BUILDERS_PATH, line: 1, message: "AI Nerve Bus dispatch request must carry the governed step timeoutPolicy value." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "ai-step-timeout-chain",
      findings,
      "Orchestration applies governed step timeoutPolicy to AI dispatch and timeout terminal failure.",
      "Orchestration still lets AI dispatch ignore the governed step timeoutPolicy.",
    ),
  };
}

async function inspectNegativeProofReadiness(): Promise<PhaseResult> {
  const harnessExists = await fileExists(pathFromRepoRoot(NEGATIVE_PROOF_HARNESS_PATH));
  const findings = harnessExists
    ? []
    : [createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-004-V1", file: NEGATIVE_PROOF_HARNESS_PATH, line: 1, message: "Orchestration capability is missing its owner-local negative-proof harness." })];

  return {
    findings,
    phase: createRuntimePhase(
      "negative-proof-readiness",
      findings,
      "Orchestration owner-local negative-proof harness exists and can be executed by the inspector.",
      "Orchestration owner-local negative-proof harness is missing, so P0 law enforcement is incomplete.",
    ),
  };
}

export async function runOrchestrationGovernedRuntimeChecks() {
  const project = createAuditProject();
  const phaseResults = await Promise.all([
    Promise.resolve(inspectGovernedPublicSurface(project)),
    inspectFrozenActivation(project),
    Promise.resolve(inspectUnifiedChildEnvelope(project)),
    Promise.resolve(inspectRuntimeProofRunIdChain(project)),
    Promise.resolve(inspectTypedFailureBoundary(project)),
    Promise.resolve(inspectPostActionVerificationChain(project)),
    Promise.resolve(inspectAiStepTimeoutChain(project)),
    inspectAiPromptContractTaskTypeDispatch(),
    Promise.resolve(inspectMissionLoopTraceability(project)),
    Promise.resolve(inspectStartMissionCommandBoundary(project)),
    inspectForensicsRetentionBoundary(),
    inspectNegativeProofReadiness(),
  ]);

  return {
    findings: phaseResults.flatMap((result) => result.findings),
    phases: phaseResults.map((result) => result.phase),
  };
}
