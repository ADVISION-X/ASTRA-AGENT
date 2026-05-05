import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, hasCallExpressionPath, type createAuditProject } from "./inspection-ast-helpers.js";

const INTERNAL_TYPES_PATH = "src/capabilities/orchestration/internal.ts";
const ABILITY_GROUP_PATH = "src/capabilities/orchestration/ability-group.ts";
const LOOP_ITERATION_PATH = "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts";
const LOOP_EVENTS_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const WORKBENCH_ORCHESTRATION_PATH = "src/lib/local-runtime/workbench-orchestration.ts";

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

export function inspectMissionLoopEventSemantics(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const internalSource = getSourceFileOrThrow(project, INTERNAL_TYPES_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const loopIterationSource = getSourceFileOrThrow(project, LOOP_ITERATION_PATH);
  const loopEventsSource = getSourceFileOrThrow(project, LOOP_EVENTS_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const workbenchOrchestrationSource = getSourceFileOrThrow(project, WORKBENCH_ORCHESTRATION_PATH);
  const buildTransitionSuccessState = loopIterationSource.getFunction("buildTransitionSuccessState");
  const transitionStateText = buildTransitionSuccessState?.getFullText() ?? "";
  const recordDispatchStarted = loopEventsSource.getFunction("recordDispatchStarted");
  const dispatchStartedText = recordDispatchStarted?.getFullText() ?? "";
  const runtimeEventTypes = new Set(
    loopEventsSource
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((literal) => literal.getLiteralText()),
  );
  const emitsPavStartedEvent = loopEventsSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "POST_ACTION_VERIFICATION_STARTED");
  const guardsRoundIncrementByInitialStep = transitionStateText.includes("nextStepId === input.map.initialStepId")
    && transitionStateText.includes("details.currentStepId !== input.map.initialStepId");
  const usesPerStepRoundIncrement = transitionStateText.includes("currentRoundIndex: input.state.currentRoundIndex + 1");
  const dispatchCallsPavStart = dispatchStartedText.includes("recordPostActionVerificationStarted");
  const runtimeContextFields = getTypeAliasPropertyNames(internalSource, "OrchestrationRuntimeContext");
  const abilityGroupInputFields = getTypeAliasPropertyNames(abilityGroupSource, "CreateOrchestrationAbilityGroupInput");
  const findings: Finding[] = [];

  if (!runtimeContextFields.has("forensics")) {
    findings.push(createFatalFinding({ file: INTERNAL_TYPES_PATH, message: "Orchestration runtime context must expose a governed Forensics writer so mission-loop proof remains persisted after file splits." }));
  }
  if (!abilityGroupInputFields.has("forensics") || !hasCallObjectProperty(abilityGroupSource, "createOrchestrationRuntimeContext", "forensics")) {
    findings.push(createFatalFinding({ file: ABILITY_GROUP_PATH, message: "Orchestration ability-group wiring must pass a governed Forensics surface into the runtime context after mission-loop refactors." }));
  }
  if (!hasCallObjectProperty(workbenchOrchestrationSource, "createOrchestrationAbilityGroup", "forensics")) {
    findings.push(createFatalFinding({ file: WORKBENCH_ORCHESTRATION_PATH, message: "Workbench orchestration wiring must connect the runtime Forensics ability group to Orchestration." }));
  }
  const requiredEventTypes = [
    "MAP_STEP_SELECTED",
    "STEP_PRECONDITION_CHECKED",
    "STEP_DISPATCH_STARTED",
    "STEP_TRANSITION_EVALUATED",
  ];
  const missingEventTypes = requiredEventTypes.filter((eventType) => !runtimeEventTypes.has(eventType));
  if (missingEventTypes.length > 0) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop must emit governed step-selection, gate, dispatch, and transition runtime events after command acceptance." }));
  }
  if (!runtimeEventTypes.has("MISSION_FAILED") || !runtimeEventTypes.has("MISSION_FINALIZED") || !runtimeEventTypes.has("MISSION_REVIEW_REQUIRED") || !runtimeEventTypes.has("MISSION_STOPPED")) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types." }));
  }
  if (!hasCallExpressionPath(loopIterationSource, ["recordPostActionVerificationActionLog"])) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Mission loop must record governed action logs when post-action verification closes an action step." }));
  }
  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredRuntimeEvent"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured runtime events through the governed Forensics writer." }));
  }
  if (!hasCallExpressionPath(stepTraceRecorderSource, ["input", "context", "forensics", "writeStructuredActionLog"])) {
    findings.push(createFatalFinding({ file: STEP_TRACE_RECORDER_PATH, message: "Step trace recorder must persist structured action logs through the governed Forensics writer." }));
  }
  if (!hasSuccessProofClosure(loopIterationSource)) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Transition success path must persist lastRuntimeProofRef and runtimeProofRefs before Commander reads mission state." }));
  }

  if (!guardsRoundIncrementByInitialStep || usesPerStepRoundIncrement) {
    findings.push(createFatalFinding({ file: LOOP_ITERATION_PATH, message: "Transition success state must increment currentRoundIndex only when the governed loop explicitly returns to map.initialStepId." }));
  }
  if (!emitsPavStartedEvent || !dispatchCallsPavStart) {
    findings.push(createFatalFinding({ file: LOOP_EVENTS_PATH, message: "Mission loop dispatch must emit POST_ACTION_VERIFICATION_STARTED before awaiting the governed verification result." }));
  }

  return { findings, phase: createSemanticsPhase(findings) };
}