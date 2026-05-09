import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";

import { createFinding, createPhase, listFilesRecursive, pathFromRepoRoot, toRepoRelativePath, type Finding } from "./inspection-core.js";
import { getSourceFileOrThrow, hasImportModuleSpecifier, type createAuditProject } from "./inspection-ast-helpers.js";

const STRUCTURED_LOG_PATH = "src/types/structured-log.ts";
const RUNTIME_EVENT_PAYLOAD_PATH = "src/capabilities/orchestration/runtime/orchestration-runtime-event-payload.ts";
const STEP_TRACE_RECORDER_PATH = "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts";
const LOOP_EVENTS_PATH = "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts";
const COMMANDER_DEBUG_PATH = "src/lib/local-runtime/workbench-commander-debug.ts";
const NERVE_BUS_ROOT = "src/capabilities/nerve-bus";
const FORENSICS_ROOT = "src/capabilities/forensics-persistence";
const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans";
const TRACE_FIELDS_MARKER = "orchestration-step-trace-fields";
const FAILURE_SNAPSHOT_MARKER = "orchestration-failure-snapshot";
const REQUIRED_RUNTIME_EVENT_FIELDS = [
  "targetAbilityGroupId",
  "expectedInputRefKeys",
  "resolvedInputRefKeys",
  "missingInputRefKeys",
  "outputRefAliases",
  "producedOutputRefs",
  "jointStage",
  "jointCheckpoint",
  "failureSnapshot",
] as const;
const REQUIRED_FAILURE_SNAPSHOT_FIELDS = [
  "failedStepId",
  "failedJointStage",
  "failureReason",
  "lastSuccessfulStepId",
  "lastSuccessfulResultRef",
  "screenshotEvidenceRef",
  "aiResultRef",
  "visualTargetResultRef",
  "geometryGuardResultRef",
  "clickResultRef",
  "postActionVerificationResultRef",
  "commentsEvidenceRef",
] as const;

type PhaseResult = {
  findings: Finding[];
  phase: ReturnType<typeof createPhase>;
};

const createFatalFinding = (file: string, message: string): Finding => createFinding({
  lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-011-V1",
  file,
  line: 1,
  severity: "fatal",
  message,
});

const createObservabilityPhase = (findings: Finding[]) => createPhase(
  "mission-debug-observability",
  findings.length === 0 ? "PASS" : "CODE VIOLATION",
  findings.length === 0,
  findings.length === 0
    ? "Mission Step Trace, Joint Chain Checkpoint, and Failure Snapshot remain owner-local, complete, and machine-enforced before real-platform debugging."
    : "Mission debug observability can still lose trace fields, drop failure snapshots, or leak joint debug semantics across owner boundaries.",
);

const collectMissingPropertyFindings = (
  fields: Set<string>,
  requiredFields: readonly string[],
  file: string,
  messagePrefix: string,
): Finding[] => {
  const missingFields = requiredFields.filter((field) => !fields.has(field));
  return missingFields.length === 0 ? [] : [createFatalFinding(file, `${messagePrefix}: ${missingFields.join(", ")}.`)];
};

const collectSchemaFindings = (structuredLogSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const runtimeEventFields = getZodObjectPropertyNames(structuredLogSource, "StructuredRuntimeEventSchema");
  const failureSnapshotFields = getZodObjectPropertyNames(structuredLogSource, "StructuredFailureSnapshotSchema");
  const text = structuredLogSource.getFullText();
  const missingSchemaTokens = ["StructuredJointCheckpointSchema", "StructuredFailureSnapshotSchema", "StructuredJointCheckpointStatusSchema"]
    .filter((token) => !text.includes(token));

  return [
    ...collectMissingPropertyFindings(runtimeEventFields, REQUIRED_RUNTIME_EVENT_FIELDS, STRUCTURED_LOG_PATH, "StructuredRuntimeEventSchema is missing mission debug fields"),
    ...collectMissingPropertyFindings(failureSnapshotFields, REQUIRED_FAILURE_SNAPSHOT_FIELDS, STRUCTURED_LOG_PATH, "StructuredFailureSnapshotSchema is missing failure snapshot fields"),
    ...(missingSchemaTokens.length === 0 ? [] : [createFatalFinding(STRUCTURED_LOG_PATH, `Mission debug schemas are missing required declarations or exports: ${missingSchemaTokens.join(", ")}.`)]),
  ];
};

const collectRuntimeWiringFindings = (
  runtimeEventPayloadSource: ReturnType<typeof getSourceFileOrThrow>,
  stepTraceRecorderSource: ReturnType<typeof getSourceFileOrThrow>,
): Finding[] => {
  const payloadText = runtimeEventPayloadSource.getFullText();
  const recorderText = stepTraceRecorderSource.getFullText();
  const missingRecorderTokens = ["resolveJointStage", "resolveStepInputTrace", "resolveStepOutputTrace", "buildJointCheckpoint"]
    .filter((token) => !recorderText.includes(token));
  const missingFallbackTokens = [
    "jointStage=",
    "missingInputRefKeys=",
    "failedStepId",
    "failedJointStage",
    "lastSuccessfulResultRef",
    "screenshotEvidenceRef",
    "aiResultRef",
    "visualTargetResultRef",
    "geometryGuardResultRef",
    "clickResultRef",
    "postActionVerificationResultRef",
    "commentsEvidenceRef",
  ]
    .filter((token) => !recorderText.includes(token));

  return [
    ...(payloadText.includes("targetAbilityGroupId: input.step.targetAbilityGroupId ?? null")
      ? []
      : [createFatalFinding(RUNTIME_EVENT_PAYLOAD_PATH, "Mission Step Trace must write step.targetAbilityGroupId into structured runtime event targetAbilityGroupId.")]),
    ...(missingRecorderTokens.length === 0
      ? []
      : [createFatalFinding(STEP_TRACE_RECORDER_PATH, `recordMissionRuntimeEvent is missing mission trace helper wiring: ${missingRecorderTokens.join(", ")}.`)]),
    ...(missingFallbackTokens.length === 0
      ? []
      : [createFatalFinding(STEP_TRACE_RECORDER_PATH, `Forensics fallback is missing mission failure summary fields: ${missingFallbackTokens.join(", ")}.`)]),
  ];
};

const collectFailurePathFindings = (loopEventsSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const text = loopEventsSource.getFullText();
  const missingTokens = [
    "buildFailureSnapshot",
    "failureSnapshot:",
    "review_required",
    "outcome.state.status === \"failed\" || outcome.state.status === \"review_required\"",
  ].filter((token) => !text.includes(token));
  return missingTokens.length === 0
    ? []
    : [createFatalFinding(LOOP_EVENTS_PATH, `Failed or review_required mission paths are missing failure snapshot wiring: ${missingTokens.join(", ")}.`)];
};

const loadSourceFiles = async (
  project: ReturnType<typeof createAuditProject>,
  root: string,
): Promise<Array<ReturnType<typeof getSourceFileOrThrow>>> => {
  const filePaths = await listFilesRecursive(pathFromRepoRoot(root), { extensions: [".ts", ".tsx"] });
  return filePaths.map((filePath) => getSourceFileOrThrow(project, toRepoRelativePath(filePath)));
};

const collectForbiddenImportFindings = async (
  project: ReturnType<typeof createAuditProject>,
  root: string,
  message: string,
): Promise<Finding[]> => {
  const sourceFiles = await loadSourceFiles(project, root);
  return sourceFiles.flatMap((sourceFile) => {
    const hasForbiddenImport = hasImportModuleSpecifier(sourceFile, TRACE_FIELDS_MARKER)
      || hasImportModuleSpecifier(sourceFile, FAILURE_SNAPSHOT_MARKER);
    return hasForbiddenImport ? [createFatalFinding(toRepoRelativePath(sourceFile.getFilePath()), message)] : [];
  });
};

const collectForbiddenTokenFindings = async (
  project: ReturnType<typeof createAuditProject>,
  root: string,
  forbiddenToken: string,
  message: string,
): Promise<Finding[]> => {
  const sourceFiles = await loadSourceFiles(project, root);
  return sourceFiles.flatMap((sourceFile) => sourceFile.getFullText().includes(forbiddenToken)
    ? [createFatalFinding(toRepoRelativePath(sourceFile.getFilePath()), message)]
    : []);
};

const collectCommanderDebugFindings = (commanderDebugSource: ReturnType<typeof getSourceFileOrThrow>): Finding[] => {
  const text = commanderDebugSource.getFullText();
  return text.includes("jointStage:") || text.includes("failureSnapshot:")
    ? [createFatalFinding(COMMANDER_DEBUG_PATH, "Commander Debug must not generate jointStage or failureSnapshot fields that impersonate Mission Step Trace.")]
    : [];
};

export async function runMissionDebugObservabilityChecks(project: ReturnType<typeof createAuditProject>): Promise<PhaseResult> {
  const structuredLogSource = getSourceFileOrThrow(project, STRUCTURED_LOG_PATH);
  const runtimeEventPayloadSource = getSourceFileOrThrow(project, RUNTIME_EVENT_PAYLOAD_PATH);
  const stepTraceRecorderSource = getSourceFileOrThrow(project, STEP_TRACE_RECORDER_PATH);
  const loopEventsSource = getSourceFileOrThrow(project, LOOP_EVENTS_PATH);
  const commanderDebugSource = getSourceFileOrThrow(project, COMMANDER_DEBUG_PATH);
  const [
    nerveBusImports,
    nerveBusJointStage,
    forensicsImports,
    forensicsJointStage,
    routePlanImports,
    routePlanFailureSnapshot,
    routePlanJointCheckpoint,
  ] = await Promise.all([
    collectForbiddenImportFindings(project, NERVE_BUS_ROOT, "Nerve Bus must not import Orchestration mission debug helpers."),
    collectForbiddenTokenFindings(project, NERVE_BUS_ROOT, "jointStage", "Nerve Bus must not parse or branch on jointStage."),
    collectForbiddenImportFindings(project, FORENSICS_ROOT, "Forensics must not import Orchestration mission debug helpers."),
    collectForbiddenTokenFindings(project, FORENSICS_ROOT, "jointStage", "Forensics must not decide jointStage semantics."),
    collectForbiddenImportFindings(project, ROUTE_PLAN_ROOT, "Route Plan must not import failure snapshot or joint trace helpers."),
    collectForbiddenTokenFindings(project, ROUTE_PLAN_ROOT, "failureSnapshot", "Route Plan must not construct failureSnapshot."),
    collectForbiddenTokenFindings(project, ROUTE_PLAN_ROOT, "jointCheckpoint", "Route Plan must not interpret or construct jointCheckpoint."),
  ]);

  const findings = [
    ...collectSchemaFindings(structuredLogSource),
    ...collectRuntimeWiringFindings(runtimeEventPayloadSource, stepTraceRecorderSource),
    ...collectFailurePathFindings(loopEventsSource),
    ...collectCommanderDebugFindings(commanderDebugSource),
    ...nerveBusImports,
    ...nerveBusJointStage,
    ...forensicsImports,
    ...forensicsJointStage,
    ...routePlanImports,
    ...routePlanFailureSnapshot,
    ...routePlanJointCheckpoint,
  ];

  return { findings, phase: createObservabilityPhase(findings) };
}
