import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, hasCallExpressionPath, type createAuditProject } from "./inspection-ast-helpers.js";
import {
  getNamedFunctionLike,
  getTypeAliasPropertyNames,
  hasCallObjectProperty,
  hasSuccessProofClosure,
} from "./mission-loop-ast-helpers.js";

const INTERNAL_TYPES_PATH = "src/capabilities/orchestration/internal.ts";
const ABILITY_GROUP_PATH = "src/capabilities/orchestration/ability-group.ts";
const LOOP_ITERATION_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts";
const TRANSITION_SUCCESS_OUTCOME_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-transition-success-outcome.ts";
const LOOP_EVENTS_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts";
const LOOP_EVENTS_SHARED_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-event-shared.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const WORKBENCH_ORCHESTRATION_PATH = "src/lib/local-runtime/workbench-orchestration.ts";
const REQUIRED_RUNTIME_EVENT_TYPES = ["RUNTIME_STEP_SELECTED", "STEP_PRECONDITION_CHECKED", "STEP_DISPATCH_STARTED", "CAPABILITY_CALL_STARTED", "STEP_TRANSITION_EVALUATED"] as const;
const TERMINAL_RUNTIME_EVENT_TYPES = ["MISSION_FAILED", "MISSION_FINALIZED", "MISSION_REVIEW_REQUIRED", "MISSION_STOPPED"] as const;

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (input: { file: string; message: string }): Finding => createFinding({
  lawId: input.message.includes("Mission Step Trace") || input.message.includes("joint")
    ? "GRASSEYE-ORCHESTRATION-CAPABILITY-011-V1"
    : "GRASSEYE-ORCHESTRATION-CAPABILITY-008-V3",
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

const collectPostActionVerificationActionLogFinding = (
  loopIterationSource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => !hasCallExpressionPath(loopIterationSource, ["recordPostActionVerificationActionLog"])
  ? [createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Mission loop must record governed action logs when post-action verification closes an action step." })]
  : [];

const collectVideoVisitTraceFindings = (
  stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => {
  const recorderText = stepTraceRecorderSource.getFullText();
  return recorderText.includes("videoVisitId: null") || !recorderText.includes("resolveVideoVisitId") || !recorderText.includes("video-visit") || !recorderText.includes("state.currentRoundIndex")
    ? [createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Mission-loop structured runtime events must bind videoVisitId from missionId and currentRoundIndex; null/no-video trace records hide same-video loops from Forensics and audit." })]
    : [];
};

const collectForensicsPersistenceFindings = (
  stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => {
  const findings: Finding[] = [];
  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredRuntimeEvent"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured runtime events through the governed Forensics writer." }));
  }
  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredActionLog"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured action logs through the governed Forensics writer." }));
  }
  return findings;
};

const collectTransitionRoundBoundaryFinding = (input: {
  transitionSuccessSource: ReturnType<typeof getSourceFileOrThrow>;
  transitionStateText: string;
  roundBoundaryText: string;
}): Finding[] => {
  const guardsRoundIncrementByInitialStep = input.roundBoundaryText.includes("nextStepId === input.initialStepId")
    && input.roundBoundaryText.includes("currentStepId !== input.initialStepId");
  const guardsClickNextVideoCaptureBoundary = input.roundBoundaryText.includes("press-next-video-key")
    && input.roundBoundaryText.includes("observe-current-video-page-state");
  const usesPerStepRoundIncrement = input.transitionStateText.includes("currentRoundIndex: input.state.currentRoundIndex + 1");

  return !hasSuccessProofClosure(input.transitionSuccessSource)
    ? [createFatalFinding({ file: TRANSITION_SUCCESS_OUTCOME_PATH, message: "Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state." })]
    : !guardsRoundIncrementByInitialStep || !guardsClickNextVideoCaptureBoundary || usesPerStepRoundIncrement
      ? [createFatalFinding({ file: TRANSITION_SUCCESS_OUTCOME_PATH, message: "Transition success state must increment currentRoundIndex only at governed round boundaries: map initial-step return or press-next-video-key returning to observe-current-video-page-state." })]
      : [];
};

const collectLoopStateFindings = (input: {
  loopIterationSource: ReturnType<typeof getSourceFileOrThrow>;
  transitionSuccessSource: ReturnType<typeof getSourceFileOrThrow>;
  stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>;
  transitionStateText: string;
  roundBoundaryText: string;
}): Finding[] => [
  ...collectPostActionVerificationActionLogFinding(input.loopIterationSource),
  ...collectVideoVisitTraceFindings(input.stepTraceRecorderSource),
  ...collectForensicsPersistenceFindings(input.stepTraceRecorderSource),
  ...collectTransitionRoundBoundaryFinding({
    transitionSuccessSource: input.transitionSuccessSource,
    transitionStateText: input.transitionStateText,
    roundBoundaryText: input.roundBoundaryText,
  }),
];

const collectCapabilityCallIdStabilityFindings = (input: {
  loopIterationSource: ReturnType<typeof getSourceFileOrThrow>;
  loopEventsSource: ReturnType<typeof getSourceFileOrThrow>;
}): Finding[] => {
  const findings: Finding[] = [];
  const forbiddenOverride = "lastResult.envelopeId ?? input.stepDispatchCallId";
  const forbiddenOutcomeOverride = "outcome.lastResult?.envelopeId ?? input.stepDispatchCallId";
  const eventsText = input.loopEventsSource.getFullText();
  const iterationText = input.loopIterationSource.getFullText();

  if (eventsText.includes(forbiddenOverride) || eventsText.includes(forbiddenOutcomeOverride) || iterationText.includes(forbiddenOverride)) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission-loop lifecycle events must keep capabilityCallId as the stable stepDispatchCallId; result envelope ids belong in resultEnvelopeRef/output refs, never capabilityCallId." }));
  }
  if (!eventsText.includes("resultEnvelopeRef=")) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission-loop result events must expose ability result envelope ids as resultEnvelopeRef without replacing the step invocation capabilityCallId." }));
  }

  return findings;
};

export function inspectMissionLoopEventSemantics(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const internalSource = getSourceFileOrThrow(project, INTERNAL_TYPES_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const loopIterationSource = getSourceFileOrThrow(project, LOOP_ITERATION_PATH);
  const transitionSuccessSource = getSourceFileOrThrow(project, TRANSITION_SUCCESS_OUTCOME_PATH);
  const loopEventsSource = getSourceFileOrThrow(project, LOOP_EVENTS_PATH);
  const loopEventsSharedSource = getSourceFileOrThrow(project, LOOP_EVENTS_SHARED_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const workbenchOrchestrationSource = getSourceFileOrThrow(project, WORKBENCH_ORCHESTRATION_PATH);
  const buildTransitionSuccessState = getNamedFunctionLike(transitionSuccessSource, "buildTransitionSuccessState");
  const transitionStateText = buildTransitionSuccessState?.getFullText() ?? "";
  const shouldAdvanceMissionRound = getNamedFunctionLike(transitionSuccessSource, "shouldAdvanceMissionRound");
  const roundBoundaryText = shouldAdvanceMissionRound?.getFullText() ?? "";
  const recordDispatchStarted = loopEventsSource.getFunction("recordDispatchStarted");
  const dispatchStartedText = recordDispatchStarted?.getFullText() ?? "";
  const runtimeEventTypes = collectRuntimeEventTypes([loopEventsSource, loopEventsSharedSource]);
  const findings = [
    ...collectForensicsWiringFindings({ internalSource, abilityGroupSource, workbenchOrchestrationSource }),
    ...collectRuntimeEventCoverageFindings({ loopIterationSource, loopEventsSource, runtimeEventTypes, dispatchStartedText }),
    ...collectLoopStateFindings({ loopIterationSource, transitionSuccessSource, stepTraceRecorderSource, transitionStateText, roundBoundaryText }),
    ...collectCapabilityCallIdStabilityFindings({ loopIterationSource, loopEventsSource }),
  ];

  return { findings, phase: createSemanticsPhase(findings) };
}
