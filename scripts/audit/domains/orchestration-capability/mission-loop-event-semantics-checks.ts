import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, hasCallExpressionPath, type createAuditProject } from "./inspection-ast-helpers.js";
import { getTypeAliasPropertyNames, hasCallObjectProperty, hasSuccessProofClosure } from "./mission-loop-ast-helpers.js";

const INTERNAL_TYPES_PATH = "src/capabilities/orchestration/internal.ts";
const ABILITY_GROUP_PATH = "src/capabilities/orchestration/ability-group.ts";
const LOOP_ITERATION_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts";
const LOOP_EVENTS_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts";
const LOOP_EVENTS_SHARED_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-event-shared.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const WORKBENCH_ORCHESTRATION_PATH = "src/lib/local-runtime/workbench-orchestration.ts";
const REQUIRED_RUNTIME_EVENT_TYPES = ["MAP_STEP_SELECTED", "STEP_PRECONDITION_CHECKED", "STEP_DISPATCH_STARTED", "CAPABILITY_CALL_STARTED", "STEP_TRANSITION_EVALUATED"] as const;
const TERMINAL_RUNTIME_EVENT_TYPES = ["MISSION_FAILED", "MISSION_FINALIZED", "MISSION_REVIEW_REQUIRED", "MISSION_STOPPED"] as const;

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (input: { file: string; message: string }): Finding => createFinding({
  lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3",
  file: input.file,
  line: 1,
  severity: "fatal",
  message: input.message,
});

const createSemanticsPhase = (findings: Finding[]) => createPhase(
  "mission-loop-event-semantics",
  findings.length === 0 ? "PASS" : "CODE VIOLATION",
  findings.length === 0,
  findings.length === 0
    ? "Mission loop traceability, round semantics, and PAV start events remain explicitly enforced after the file split."
    : "Mission loop can still lose split-aware traceability, consume maxRounds as a step budget, or skip explicit PAV start proof.",
);

const collectRuntimeEventTypes = (sourceFiles: Array<ReturnType<typeof getSourceFileOrThrow>>): Set<string> =>
  new Set(
    sourceFiles.flatMap((sourceFile) =>
      sourceFile
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((literal) => literal.getLiteralText()),
    ),
  );

  const hasDispatchRecorderCall = (dispatchStartedText: string, recorderName: string): boolean => dispatchStartedText.includes(recorderName);

  const shouldReportCapabilityStartFinding = (missingEventTypes: string[], hasCapabilityCallStart: boolean): boolean =>
    missingEventTypes.length > 0 || !hasCapabilityCallStart;

const collectForensicsWiringFindings = (input: {
  internalSource: ReturnType<typeof getSourceFileOrThrow>;
  abilityGroupSource: ReturnType<typeof getSourceFileOrThrow>;
  workbenchOrchestrationSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];
  const runtimeContextFields = getTypeAliasPropertyNames(input.internalSource, "OrchestrationRuntimeContext");
  const abilityGroupInputFields = getTypeAliasPropertyNames(input.abilityGroupSource, "CreateOrchestrationAbilityGroupInput");

  if (!runtimeContextFields.has("forensics")) {
    findings.push(createFatalFinding({ file: INTERNAL_TYPES_PATH, message: "Orchestration runtime context must expose a governed Forensics writer so mission-loop proof remains persisted after file splits." }));
  }
  if (!abilityGroupInputFields.has("forensics") || !hasCallObjectProperty(input.abilityGroupSource, "createOrchestrationRuntimeContext", "forensics")) {
    findings.push(createFatalFinding({ file: ABILITY_GROUP_PATH, message: "Orchestration ability-group wiring must pass a governed Forensics surface into the runtime context after mission-loop refactors." }));
  }
  if (!hasCallObjectProperty(input.workbenchOrchestrationSource, "createOrchestrationAbilityGroup", "forensics")) {
    findings.push(createFatalFinding({ file: WORKBENCH_ORCHESTRATION_PATH, message: "Workbench orchestration wiring must connect the runtime Forensics ability group to Orchestration." }));
  }

  return findings;
};

const collectRuntimeEventCoverageFindings = (input: {
  loopIterationSource: ReturnType<typeof getSourceFileOrThrow>;
  loopEventsSource: ReturnType<typeof getSourceFileOrThrow>;
  runtimeEventTypes: Set<string>;
  dispatchStartedText: string;
}): Finding[] => {
  const findings: Finding[] = [];
  const missingEventTypes = REQUIRED_RUNTIME_EVENT_TYPES.filter((eventType) => !input.runtimeEventTypes.has(eventType));
  const missingTerminalEventTypes = TERMINAL_RUNTIME_EVENT_TYPES.filter((eventType) => !input.runtimeEventTypes.has(eventType));
  const hasCapabilityCallStart = hasDispatchRecorderCall(input.dispatchStartedText, "recordCapabilityCallStarted");
  const hasPavStartedDispatch = hasDispatchRecorderCall(input.dispatchStartedText, "recordPostActionVerificationStarted");
  const emitsPavStartedEvent = input.loopEventsSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "POST_ACTION_VERIFICATION_STARTED");
  const missingPavStartSignals = Number(!emitsPavStartedEvent) + Number(!hasPavStartedDispatch);

  if (shouldReportCapabilityStartFinding(missingEventTypes, hasCapabilityCallStart)) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop dispatch must emit CAPABILITY_CALL_STARTED when a governed ability enters owner execution." }));
  }
  if (missingTerminalEventTypes.length > 0) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types." }));
  }
  if (missingPavStartSignals > 0) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop dispatch must emit POST_ACTION_VERIFICATION_STARTED before awaiting the governed verification result." }));
  }

  return findings;
};

const collectLoopStateFindings = (input: {
  loopIterationSource: ReturnType<typeof getSourceFileOrThrow>;
  stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>;
  transitionStateText: string;
}): Finding[] => {
  const findings: Finding[] = [];
  const guardsRoundIncrementByInitialStep = input.transitionStateText.includes("nextStepId === input.map.initialStepId")
    && input.transitionStateText.includes("details.currentStepId !== input.map.initialStepId");
  const usesPerStepRoundIncrement = input.transitionStateText.includes("currentRoundIndex: input.state.currentRoundIndex + 1");

  if (!hasCallExpressionPath(input.loopIterationSource, ["recordPostActionVerificationActionLog"])) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Mission loop must record governed action logs when post-action verification closes an action step." }));
  }
  if (!hasCallExpressionPath(input.stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredRuntimeEvent"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured runtime events through the governed Forensics writer." }));
  }
  if (!hasCallExpressionPath(input.stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredActionLog"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured action logs through the governed Forensics writer." }));
  }
  if (!hasSuccessProofClosure(input.loopIterationSource)) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state." }));
  }
  if (!guardsRoundIncrementByInitialStep || usesPerStepRoundIncrement) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Transition success state must increment currentRoundIndex only when the governed loop explicitly returns to map.initialStepId." }));
  }

  return findings;
};

export function inspectMissionLoopEventSemantics(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const internalSource = getSourceFileOrThrow(project, INTERNAL_TYPES_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const loopIterationSource = getSourceFileOrThrow(project, LOOP_ITERATION_PATH);
  const loopEventsSource = getSourceFileOrThrow(project, LOOP_EVENTS_PATH);
  const loopEventsSharedSource = getSourceFileOrThrow(project, LOOP_EVENTS_SHARED_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const workbenchOrchestrationSource = getSourceFileOrThrow(project, WORKBENCH_ORCHESTRATION_PATH);
  const buildTransitionSuccessState = loopIterationSource.getFunction("buildTransitionSuccessState");
  const transitionStateText = buildTransitionSuccessState?.getFullText() ?? "";
  const recordDispatchStarted = loopEventsSource.getFunction("recordDispatchStarted");
  const dispatchStartedText = recordDispatchStarted?.getFullText() ?? "";
  const runtimeEventTypes = collectRuntimeEventTypes([loopEventsSource, loopEventsSharedSource]);
  const findings = [
    ...collectForensicsWiringFindings({ internalSource, abilityGroupSource, workbenchOrchestrationSource }),
    ...collectRuntimeEventCoverageFindings({ loopIterationSource, loopEventsSource, runtimeEventTypes, dispatchStartedText }),
    ...collectLoopStateFindings({ loopIterationSource, stepTraceRecorderSource, transitionStateText }),
  ];

  return { findings, phase: createSemanticsPhase(findings) };
}