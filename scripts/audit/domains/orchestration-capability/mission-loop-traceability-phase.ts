import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, hasCallExpressionPath, type createAuditProject } from "./inspection-ast-helpers.js";
import {
  functionContainsStringLiterals,
  getRuntimeEventTypes,
  getTypeAliasPropertyNames,
  hasCallObjectProperty,
  hasSuccessProofClosure,
} from "./mission-loop-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";

const INTERNAL_TYPES_PATH = "src/capabilities/orchestration/internal.ts";
const LOOP_ITERATION_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts";
const TRANSITION_SUCCESS_OUTCOME_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-transition-success-outcome.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const WORKBENCH_ORCHESTRATION_PATH = "src/lib/local-runtime/workbench-orchestration.ts";

const REQUIRED_RUNTIME_EVENT_TYPES = [
  "MAP_STEP_SELECTED",
  "STEP_PRECONDITION_CHECKED",
  "STEP_DISPATCH_STARTED",
  "STEP_TRANSITION_EVALUATED",
] as const;

const TERMINAL_EVENT_TYPES = [
  "MISSION_FAILED",
  "MISSION_FINALIZED",
  "MISSION_REVIEW_REQUIRED",
  "MISSION_STOPPED",
] as const;

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (input: { lawId: string; file: string; message: string; detail?: string }): Finding =>
  createFinding({
    lawId: input.lawId,
    file: input.file,
    line: 1,
    severity: "fatal",
    message: input.message,
    ...(input.detail ? { detail: input.detail } : {}),
  });

const createRuntimePhase = (findings: Finding[]) =>
  createPhase(
    "mission-loop-traceability",
    findings.length === 0 ? "PASS" : "CODE VIOLATION",
    findings.length === 0,
    findings.length === 0
      ? "Mission loop persists governed runtime events, action logs, and success-path proof refs through the Orchestration-to-Forensics boundary."
      : "Mission loop still lacks governed Forensics wiring, required runtime events, action-log persistence, or success-path proof closure.",
  );

const collectForensicsBoundaryFindings = (input: {
  internalSource: ReturnType<typeof getSourceFileOrThrow>;
  abilityGroupSource: ReturnType<typeof getSourceFileOrThrow>;
  workbenchOrchestrationSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];
  const runtimeContextFields = getTypeAliasPropertyNames(input.internalSource, "OrchestrationRuntimeContext");
  const abilityGroupInputFields = getTypeAliasPropertyNames(input.abilityGroupSource, "CreateOrchestrationAbilityGroupInput");

  if (!runtimeContextFields.has("forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: INTERNAL_TYPES_PATH, message: "Orchestration runtime context must expose a governed Forensics writer so mission-loop proof can be persisted through the public Forensics contract." }));
  }
  if (!abilityGroupInputFields.has("forensics") || !hasCallObjectProperty(input.abilityGroupSource, "createOrchestrationRuntimeContext", "forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: config.ABILITY_GROUP_PATH, message: "Orchestration ability-group wiring must pass a governed Forensics surface into the runtime context." }));
  }
  if (!hasCallObjectProperty(input.workbenchOrchestrationSource, "createOrchestrationAbilityGroup", "forensics")) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: WORKBENCH_ORCHESTRATION_PATH, message: "Workbench orchestration wiring must connect the runtime Forensics ability group to Orchestration." }));
  }

  return findings;
};

const collectRuntimeEventFindings = (loopIterationSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const findings: Finding[] = [];
  const runtimeEventTypes = getRuntimeEventTypes(loopIterationSource);
  const missingEventTypes = REQUIRED_RUNTIME_EVENT_TYPES.filter((eventType) => !runtimeEventTypes.has(eventType));

  if (missingEventTypes.length > 0) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, message: "Mission loop must emit governed step-selection, gate, dispatch, transition, and terminal runtime events after command acceptance.", detail: missingEventTypes.join(", ") }));
  }
  if (!hasCallExpressionPath(loopIterationSource, ["recordTerminalOutcome"]) || !functionContainsStringLiterals(loopIterationSource, "getTerminalEventType", [...TERMINAL_EVENT_TYPES])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, message: "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types." }));
  }
  if (!hasCallExpressionPath(loopIterationSource, ["recordPostActionVerificationActionLog"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: LOOP_ITERATION_PATH, message: "Mission loop must record governed action logs when post-action verification closes an action step." }));
  }

  return findings;
};

const collectStepTraceRecorderFindings = (stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const findings: Finding[] = [];

  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredRuntimeEvent"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured runtime events through the governed Forensics writer." }));
  }
  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredActionLog"])) {
    findings.push(createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-005-V3", file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured action logs through the governed Forensics writer." }));
  }

  return findings;
};

const collectSuccessProofFindings = (transitionSuccessSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] =>
  hasSuccessProofClosure(transitionSuccessSource)
    ? []
    : [createFatalFinding({ lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3", file: TRANSITION_SUCCESS_OUTCOME_PATH, message: "Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state." })];

export const inspectMissionLoopTraceability = (project: ReturnType<typeof createAuditProject>): PhaseResult => {
  const internalSource = getSourceFileOrThrow(project, INTERNAL_TYPES_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, config.ABILITY_GROUP_PATH);
  const loopIterationSource = getSourceFileOrThrow(project, LOOP_ITERATION_PATH);
  const transitionSuccessSource = getSourceFileOrThrow(project, TRANSITION_SUCCESS_OUTCOME_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const workbenchOrchestrationSource = getSourceFileOrThrow(project, WORKBENCH_ORCHESTRATION_PATH);
  const findings = [
    ...collectForensicsBoundaryFindings({ internalSource, abilityGroupSource, workbenchOrchestrationSource }),
    ...collectRuntimeEventFindings(loopIterationSource),
    ...collectStepTraceRecorderFindings(stepTraceRecorderSource),
    ...collectSuccessProofFindings(transitionSuccessSource),
  ];

  return { findings, phase: createRuntimePhase(findings) };
};