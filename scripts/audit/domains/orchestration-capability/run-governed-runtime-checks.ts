import { Node, SyntaxKind } from "ts-morph";

import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createFinding, createPhase, fileExists, pathFromRepoRoot, readTextFile, type Finding } from "./inspection-core.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpressionPath } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { inspectStartMissionCommandBoundary } from "./start-mission-boundary-checks.js";

const NEGATIVE_PROOF_HARNESS_PATH = "scripts/audit/domains/orchestration-capability/negative-proof-harness.ts";
const LAW_PATH = ".github/instructions/cursor-rules/modules/module-orchestration-capability.instructions.md";
const BLUEPRINT_PATH = "docs/法案辅助文件/GrassEye Orchestration 总指挥能力组施工图.md";
const INTERNAL_TYPES_PATH = "src/capabilities/orchestration/internal.ts";
const LOOP_ITERATION_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts";
const RESUME_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-resume.ts";
const PROOF_BUILDER_PATH = "src/capabilities/orchestration/runtime/orchestration-proof-builder.ts";
const STEP_DISPATCHER_PATH = "src/capabilities/orchestration/runtime/step-dispatcher.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const MAP_VALIDATION_GATE_PATH = "src/capabilities/orchestration/runtime/map-validation-gate.ts";
const WORKBENCH_ORCHESTRATION_PATH = "src/lib/local-runtime/workbench-orchestration.ts";
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

function getTypeAliasPropertyNames(sourceFile: ReturnType<typeof getSourceFileOrThrow>, aliasName: string): Set<string> {
  const typeAlias = sourceFile.getTypeAlias(aliasName);
  const typeNode = typeAlias?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) {
    return new Set();
  }

  return new Set(
    typeNode
      .getProperties()
      .filter((property) => Node.isPropertySignature(property))
      .map((property) => property.getName()),
  );
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

function getRuntimeEventTypes(sourceFile: ReturnType<typeof getSourceFileOrThrow>): Set<string> {
  return new Set(
    sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((callExpression) => {
        const expression = callExpression.getExpression();
        return Node.isIdentifier(expression) && expression.getText() === "recordMissionRuntimeEvent";
      })
      .flatMap((callExpression) => {
        const [firstArgument] = callExpression.getArguments();
        if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
          return [];
        }

        const property = firstArgument.getProperty("eventType");
        if (!property || !Node.isPropertyAssignment(property)) {
          return [];
        }

        const initializer = property.getInitializer();
        return initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
          ? [initializer.getLiteralText()]
          : [];
      }),
  );
}

function functionHasProperties(sourceFile: ReturnType<typeof getSourceFileOrThrow>, functionName: string, propertyNames: string[]): boolean {
  const fn = sourceFile.getFunction(functionName);
  if (!fn) {
    return false;
  }

  const foundNames = new Set(
    fn
      .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .map((property) => property.getName()),
  );

  return propertyNames.every((propertyName) => foundNames.has(propertyName));
}

function functionContainsStringLiterals(sourceFile: ReturnType<typeof getSourceFileOrThrow>, functionName: string, literalValues: string[]): boolean {
  const fn = sourceFile.getFunction(functionName);
  if (!fn) {
    return false;
  }

  const stringLiterals = new Set(
    fn
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((literal) => literal.getLiteralText()),
  );

  return literalValues.every((literalValue) => stringLiterals.has(literalValue));
}

function hasSuccessProofClosure(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  const fn = sourceFile.getFunction("buildTransitionSuccessOutcome");
  if (!fn) {
    return false;
  }

  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "toMissionControlState") {
      return false;
    }

    const objectLiteral = callExpression.getArguments().find((argument) => Node.isObjectLiteralExpression(argument));
    if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) {
      return false;
    }

    const lastRuntimeProofRef = objectLiteral.getProperty("lastRuntimeProofRef");
    const runtimeProofRefs = objectLiteral.getProperty("runtimeProofRefs");
    if (!lastRuntimeProofRef || !Node.isPropertyAssignment(lastRuntimeProofRef) || !runtimeProofRefs || !Node.isPropertyAssignment(runtimeProofRefs)) {
      return false;
    }

    const lastRuntimeProofRefText = lastRuntimeProofRef.getInitializer()?.getText() ?? "";
    const runtimeProofRefsText = runtimeProofRefs.getInitializer()?.getText() ?? "";
    return lastRuntimeProofRefText.includes("runtimeProofId") && runtimeProofRefsText.includes("runtimeProofId");
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

function inspectMissionLoopTraceability(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const internalSource = getSourceFileOrThrow(project, INTERNAL_TYPES_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const loopIterationSource = getSourceFileOrThrow(project, LOOP_ITERATION_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const workbenchOrchestrationSource = getSourceFileOrThrow(project, WORKBENCH_ORCHESTRATION_PATH);
  const findings: Finding[] = [];

  const runtimeContextFields = getTypeAliasPropertyNames(internalSource, "OrchestrationRuntimeContext");
  if (!runtimeContextFields.has("forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: INTERNAL_TYPES_PATH, line: 1, message: "Orchestration runtime context must expose a governed Forensics writer so mission-loop proof can be persisted through the public Forensics contract." }));
  }

  const abilityGroupInputFields = getTypeAliasPropertyNames(abilityGroupSource, "CreateOrchestrationAbilityGroupInput");
  if (!abilityGroupInputFields.has("forensics") || !hasCallObjectProperty(abilityGroupSource, "createOrchestrationRuntimeContext", "forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: config.ABILITY_GROUP_PATH, line: 1, message: "Orchestration ability-group wiring must pass a governed Forensics surface into the runtime context." }));
  }

  if (!hasCallObjectProperty(workbenchOrchestrationSource, "createOrchestrationAbilityGroup", "forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: WORKBENCH_ORCHESTRATION_PATH, line: 1, message: "Workbench orchestration wiring must connect the runtime Forensics ability group to Orchestration." }));
  }

  const requiredEventTypes = [
    "MAP_STEP_SELECTED",
    "STEP_PRECONDITION_CHECKED",
    "STEP_DISPATCH_STARTED",
    "STEP_TRANSITION_EVALUATED",
  ];
  const runtimeEventTypes = getRuntimeEventTypes(loopIterationSource);
  const missingEventTypes = requiredEventTypes.filter((eventType) => !runtimeEventTypes.has(eventType));
  if (missingEventTypes.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, line: 1, message: "Mission loop must emit governed step-selection, gate, dispatch, transition, and terminal runtime events after command acceptance.", detail: missingEventTypes.join(", ") }));
  }

  if (!hasCallExpressionPath(loopIterationSource, ["recordTerminalOutcome"]) || !functionContainsStringLiterals(loopIterationSource, "getTerminalEventType", ["MISSION_FAILED", "MISSION_FINALIZED", "MISSION_REVIEW_REQUIRED", "MISSION_STOPPED"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, line: 1, message: "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types." }));
  }

  if (!hasCallExpressionPath(loopIterationSource, ["recordPostActionVerificationActionLog"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, line: 1, message: "Mission loop must record governed action logs when post-action verification closes an action step." }));
  }

  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredRuntimeEvent"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_TRACE_RECORDER_PATH, line: 1, message: "Step trace recorder must persist structured runtime events through the governed Forensics writer." }));
  }

  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredActionLog"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_TRACE_RECORDER_PATH, line: 1, message: "Step trace recorder must persist structured action logs through the governed Forensics writer." }));
  }

  if (!hasSuccessProofClosure(loopIterationSource)) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3", file: LOOP_ITERATION_PATH, line: 1, message: "Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "mission-loop-traceability",
      findings,
      "Mission loop persists governed runtime events, action logs, and success-path proof refs through the Orchestration-to-Forensics boundary.",
      "Mission loop still lacks governed Forensics wiring, required runtime events, action-log persistence, or success-path proof closure.",
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

async function inspectForensicsRetentionBoundary(): Promise<PhaseResult> {
  const [lawText, blueprintText] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
  ]);
  const requiredLawSnippets = [
    "artifactLifecycleManifestRef",
    "artifactHash",
    "promoted-evidence",
    "quota/backpressure",
  ];
  const requiredBlueprintSnippets = [
    "artifactLifecycleManifestRef / artifactHash",
    "promotion / cleanup",
    "quota/backpressure",
  ];
  const findings: Finding[] = [];

  if (!requiredLawSnippets.every((snippet) => lawText.includes(snippet))) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3", file: LAW_PATH, line: 1, message: "Orchestration Forensics boundary law must encode screenshot retention, self-promotion ban, and quota/backpressure propagation." }));
  }
  if (!requiredBlueprintSnippets.every((snippet) => blueprintText.includes(snippet))) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-007-V3", file: BLUEPRINT_PATH, line: 1, message: "Orchestration blueprint must describe screenshot lifecycle refs, promotion/cleanup routing, and quota/backpressure handling." }));
  }

  return {
    findings,
    phase: createRuntimePhase(
      "forensics-retention-boundary",
      findings,
      "Orchestration law and blueprint both describe screenshot retention refs, promotion routing, and quota/backpressure propagation at the Forensics boundary.",
      "Orchestration law or blueprint still omits screenshot lifecycle refs, promotion routing, or quota/backpressure propagation at the Forensics boundary.",
    ),
  };
}

export async function runOrchestrationGovernedRuntimeChecks() {
  const project = createAuditProject();
  const [publicSurface, frozenActivation, unifiedChildEnvelope, runtimeProofRunIdChain, typedFailureBoundary, postActionVerification, missionLoopTraceability, startMissionCommandBoundary, forensicsRetentionBoundary, negativeProof] = await Promise.all([
    Promise.resolve(inspectGovernedPublicSurface(project)),
    inspectFrozenActivation(project),
    Promise.resolve(inspectUnifiedChildEnvelope(project)),
    Promise.resolve(inspectRuntimeProofRunIdChain(project)),
    Promise.resolve(inspectTypedFailureBoundary(project)),
    Promise.resolve(inspectPostActionVerificationChain(project)),
    Promise.resolve(inspectMissionLoopTraceability(project)),
    Promise.resolve(inspectStartMissionCommandBoundary(project)),
    inspectForensicsRetentionBoundary(),
    inspectNegativeProofReadiness(),
  ]);

  return {
    findings: [
      ...publicSurface.findings,
      ...frozenActivation.findings,
      ...unifiedChildEnvelope.findings,
      ...runtimeProofRunIdChain.findings,
      ...typedFailureBoundary.findings,
      ...postActionVerification.findings,
      ...missionLoopTraceability.findings,
      ...startMissionCommandBoundary.findings,
      ...forensicsRetentionBoundary.findings,
      ...negativeProof.findings,
    ],
    phases: [
      publicSurface.phase,
      frozenActivation.phase,
      unifiedChildEnvelope.phase,
      runtimeProofRunIdChain.phase,
      typedFailureBoundary.phase,
      postActionVerification.phase,
      missionLoopTraceability.phase,
      startMissionCommandBoundary.phase,
      forensicsRetentionBoundary.phase,
      negativeProof.phase,
    ],
  };
}
