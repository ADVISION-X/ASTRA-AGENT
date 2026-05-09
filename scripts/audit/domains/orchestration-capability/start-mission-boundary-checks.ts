import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, type createAuditProject } from "./inspection-ast-helpers.js";

const WORKBENCH_HUMAN_COMMAND_START_MISSION_PATH = "src/lib/local-runtime/workbench-human-command-start-mission.ts";
const WORKBENCH_HUMAN_COMMAND_DEBUG_EVENTS_PATH = "src/lib/local-runtime/workbench-human-command-debug-events.ts";
const WORKBENCH_MISSION_COMMAND_PREFLIGHT_PATH = "src/lib/local-runtime/workbench-mission-command-preflight.ts";
const WORKBENCH_STATUS_PATH = "src/lib/local-runtime/workbench-status.ts";

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

const createRuntimePhase = (findings: Finding[]) => createPhase(
  "start-mission-command-boundary",
  findings.length === 0 ? "PASS" : "CODE VIOLATION",
  findings.length === 0,
  findings.length === 0
    ? "Human command start preserves envelope.runId, emits start-boundary logs, and preflight dry-runs MissionCommandSchema before dispatch."
    : "Human command start or preflight can still lose runId, omit start-boundary logs, or discover MissionCommandSchema failures after dispatch.",
);

export function inspectStartMissionCommandBoundary(project: ReturnType<typeof createAuditProject>): PhaseResult {
  const humanCommandSource = getSourceFileOrThrow(project, WORKBENCH_HUMAN_COMMAND_START_MISSION_PATH);
  const debugEventsSource = getSourceFileOrThrow(project, WORKBENCH_HUMAN_COMMAND_DEBUG_EVENTS_PATH);
  const commandPreflightSource = getSourceFileOrThrow(project, WORKBENCH_MISSION_COMMAND_PREFLIGHT_PATH);
  const handleStartMission = humanCommandSource.getVariableDeclaration("handleStartMission")?.getInitializer();
  const startMissionCalls = handleStartMission?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => callExpression.getExpression().getText().endsWith("orchestrationAbilityGroup.startMission")) ?? [];
  const getCallStart = (expressionSuffix: string): number => {
    return handleStartMission?.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => callExpression.getExpression().getText().endsWith(expressionSuffix))?.getStart() ?? -1;
  };
  const callPreservesEnvelopeRunId = startMissionCalls.some((callExpression) =>
    callExpression.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "runId" && property.getInitializer()?.getText() === "envelope.runId"),
  );
  const emitsStartBoundaryLogs = ["ORCHESTRATION_START_RECEIVED", "MISSION_ACTIVATION_SNAPSHOT_FROZEN", "COMMAND_ACCEPTED"].every((eventType) =>
    debugEventsSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === eventType),
  );
  const startReceivedCallStart = getCallStart("recordOrchestrationStartReceived");
  const activationFrozenCallStart = getCallStart("recordMissionActivationSnapshotFrozen");
  const commandAcceptedCallStart = getCallStart("recordCommandAccepted");
  const startMissionCallStart = getCallStart("orchestrationAbilityGroup.startMission");
  const preservesBoundaryOrder = startReceivedCallStart >= 0
    && activationFrozenCallStart > startReceivedCallStart
    && commandAcceptedCallStart > activationFrozenCallStart
    && startMissionCallStart > commandAcceptedCallStart;
  const preflightDryRunsMissionCommand = commandPreflightSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "MissionCommandSchema.safeParse");
  const findings: Finding[] = [];

  if (!callPreservesEnvelopeRunId) {
    findings.push(createFatalFinding({ file: WORKBENCH_HUMAN_COMMAND_START_MISSION_PATH, message: "Human command start boundary must pass HumanCommandEnvelope.runId into Orchestration startMission." }));
  }
  if (!preflightDryRunsMissionCommand) {
    findings.push(createFatalFinding({ file: WORKBENCH_STATUS_PATH, message: "MissionStartPreflight must dry-run MissionCommandSchema before Nerve Bus dispatch." }));
  }
  if (!emitsStartBoundaryLogs) {
    findings.push(createFatalFinding({ file: WORKBENCH_HUMAN_COMMAND_START_MISSION_PATH, message: "Human command start boundary must emit ORCHESTRATION_START_RECEIVED, MISSION_ACTIVATION_SNAPSHOT_FROZEN, and COMMAND_ACCEPTED structured runtime events." }));
  }
  if (!preservesBoundaryOrder) {
    findings.push(createFatalFinding({ file: WORKBENCH_HUMAN_COMMAND_START_MISSION_PATH, message: "Human command start boundary must emit start-received, activation-snapshot-frozen, and command-accepted before Orchestration startMission begins." }));
  }

  return { findings, phase: createRuntimePhase(findings) };
}
