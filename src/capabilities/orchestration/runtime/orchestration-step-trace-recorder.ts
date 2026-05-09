import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import { resolveRuntimeStepForOperationalStep } from "./orchestration-step-trace-mapper.js";
import {
  buildStructuredActionLog,
  buildStructuredActionLogWriteInput,
  buildStructuredRuntimeEvent,
  resolveActionRef,
  resolvePostActionVerificationRef,
  type ActionLogInput,
  type RuntimeEventInput,
} from "./orchestration-step-trace-payloads.js";
import { isPostActionVerificationStep } from "./orchestration-post-action-verification.js";
import {
  buildJointCheckpoint,
  resolveJointStage,
  resolveStepInputTrace,
  resolveStepOutputTrace,
} from "./orchestration-step-trace-fields.js";
import { buildRuntimeResourceEvents } from "./orchestration-runtime-resource-events.js";

type PersistedActionLogRecord = {
  actionLogId: string;
  actionRef: string;
};

const RUNTIME_EVENT_WRITE_TIMEOUT_MS = 250;
const RUNTIME_EVENT_WRITE_DEGRADED_COOLDOWN_MS = 30_000;
let runtimeEventWriteDegradedUntilMs = 0;

function describeRuntimeEventWriteError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function warnRuntimeEventWriteIssue(input: RuntimeEventInput, issue: string): void {
  console.warn(
    `[GRASSEYE][RUNTIME][WARN] orchestration runtime event write degraded for step="${input.step.stepId}" eventType="${input.eventType}": ${issue}`,
  );
}

function logRuntimeEventFallback(input: RuntimeEventInput, reason: string): void {
  const level = input.status === "failed" ? "FAIL" : input.status === "success" ? "PASS" : "EVENT";
  const failureReason = input.failureReason ? ` failureReason=${JSON.stringify(input.failureReason)}` : "";
  const reviewRequiredReason = input.reviewRequiredReason ? ` reviewRequiredReason=${JSON.stringify(input.reviewRequiredReason)}` : "";
  const durationMs = input.durationMs === null || input.durationMs === undefined ? "" : ` durationMs=${input.durationMs}`;
  const failureSnapshot = input.failureSnapshot;
  const snapshotRefs = failureSnapshot
    ? ` failedStepId=${JSON.stringify(failureSnapshot.failedStepId)} failedJointStage=${JSON.stringify(failureSnapshot.failedJointStage)} lastSuccessfulStepId=${JSON.stringify(failureSnapshot.lastSuccessfulStepId)} lastSuccessfulResultRef=${JSON.stringify(failureSnapshot.lastSuccessfulResultRef)} screenshotEvidenceRef=${JSON.stringify(failureSnapshot.screenshotEvidenceRef)} aiResultRef=${JSON.stringify(failureSnapshot.aiResultRef)} visualTargetResultRef=${JSON.stringify(failureSnapshot.visualTargetResultRef)} geometryGuardResultRef=${JSON.stringify(failureSnapshot.geometryGuardResultRef)} clickResultRef=${JSON.stringify(failureSnapshot.clickResultRef)} postActionVerificationResultRef=${JSON.stringify(failureSnapshot.postActionVerificationResultRef)} commentsEvidenceRef=${JSON.stringify(failureSnapshot.commentsEvidenceRef)}`
    : "";
  console.warn(
    `[GRASSEYE][RUNTIME][${level}] runtime ${input.eventType} ${input.status} ${input.reason}${failureReason}${reviewRequiredReason}${durationMs} ownerResponsible="${input.ownerResponsible}" actionableMessage="${input.actionableMessage}" stepId=${input.step.stepId} childCapabilityId=${input.step.childCapabilityId} jointStage=${input.jointStage ?? "none"} missingInputRefKeys=${JSON.stringify(input.missingInputRefKeys ?? [])}${snapshotRefs} degradedForensics="${reason}"`,
  );
}

function warnStructuredActionLogWriteIssue(input: ActionLogInput, error: unknown): void {
  console.warn(
    `[GRASSEYE][RUNTIME][WARN] orchestration structured action log write degraded for step="${input.step.stepId}" childCapabilityId="${input.step.childCapabilityId}": ${describeRuntimeEventWriteError(error)}`,
  );
}

function markRuntimeEventWriteDegraded(): void {
  runtimeEventWriteDegradedUntilMs = Date.now() + RUNTIME_EVENT_WRITE_DEGRADED_COOLDOWN_MS;
}

function isRuntimeEventWriteDegraded(): boolean {
  return Date.now() < runtimeEventWriteDegradedUntilMs;
}

async function writeStructuredRuntimeEventWithoutBlockingLoop(
  input: RuntimeEventInput,
  request: Parameters<OrchestrationRuntimeContext["forensics"]["writeStructuredRuntimeEvent"]>[0],
): Promise<void> {
  if (isRuntimeEventWriteDegraded()) {
    logRuntimeEventFallback(input, "forensics_write_circuit_open");
    return;
  }
  try {
    await input.context.forensics.writeStructuredRuntimeEvent(request);
  } catch {
    markRuntimeEventWriteDegraded();
    logRuntimeEventFallback(input, "forensics_write_circuit_open");
  }
}

function resolveSessionId(state: MissionState): string {
  return state.missionId ?? state.activeTaskRunId ?? "unknown-session";
}

function resolveRunId(state: MissionState): string {
  return state.activeTaskRunId ?? `${resolveSessionId(state)}:run`;
}

function resolveRoundId(state: MissionState): string {
  return String(state.currentRoundIndex);
}

function resolveVideoVisitId(state: MissionState): string | null {
  return state.missionId
    ? `${state.missionId}:video-visit:${state.currentRoundIndex}`
    : null;
}

function resolveMapChain(state: MissionState, mapRecord: ActiveOperationalMapRecord | null) {
  return {
    mapPackageId: state.mapPackageId ?? mapRecord?.packageId ?? null,
    mapPackageVersion: state.mapPackageVersion ?? mapRecord?.packageVersion ?? null,
    selectedMapId: state.mapId ?? mapRecord?.mapId ?? null,
    selectedMapVersion: state.selectedMapVersion ?? mapRecord?.mapVersion ?? null,
    activationSnapshotRef: state.activationSnapshotRef ?? mapRecord?.activationSnapshotRef ?? null,
  };
}

function enrichRuntimeEventInput(input: RuntimeEventInput): RuntimeEventInput {
  const inputTrace = resolveStepInputTrace(input.step, input.state);
  const outputTrace = resolveStepOutputTrace(input.step, input.stepResult ?? null);
  const checkpointState = input.stepResult
    ? { ...input.state, payloadRefs: input.stepResult.payloadRefs }
    : input.state;
  return {
    ...input,
    expectedInputRefKeys: input.expectedInputRefKeys ?? inputTrace.expectedInputRefKeys,
    inputRefs: input.inputRefs ?? inputTrace.resolvedInputRefs,
    resolvedInputRefKeys: input.resolvedInputRefKeys ?? inputTrace.resolvedInputRefKeys,
    missingInputRefKeys: input.missingInputRefKeys ?? inputTrace.missingInputRefKeys,
    outputRefAliases: input.outputRefAliases ?? outputTrace.outputRefAliases,
    outputRefs: input.outputRefs ?? outputTrace.producedOutputRefs,
    producedOutputRefs: input.producedOutputRefs ?? outputTrace.producedOutputRefs,
    jointStage: input.jointStage ?? resolveJointStage(input.step),
    jointCheckpoint: input.jointCheckpoint ?? buildJointCheckpoint(checkpointState),
  };
}

function buildStructuredRuntimeEventWriteRequest(
  eventInput: RuntimeEventInput,
  structuredRuntimeEvent: ReturnType<typeof buildStructuredRuntimeEvent>,
): Parameters<OrchestrationRuntimeContext["forensics"]["writeStructuredRuntimeEvent"]>[0] {
  const mapChain = resolveMapChain(eventInput.state, eventInput.mapRecord);
  return {
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: eventInput.step.childCapabilityId,
    missionId: eventInput.state.missionId ?? null,
    runId: resolveRunId(eventInput.state),
    sessionId: resolveSessionId(eventInput.state),
    roundId: resolveRoundId(eventInput.state),
    videoVisitId: resolveVideoVisitId(eventInput.state),
    stepId: eventInput.step.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: mapChain.selectedMapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: eventInput.capabilityCallId ?? null,
    inputRefs: [...new Set(eventInput.inputRefs ?? [])],
    outputRefs: [...new Set(eventInput.outputRefs ?? [])],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    actionRef: eventInput.actionRef ?? null,
    postActionVerificationRef: eventInput.postActionVerificationRef ?? null,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { structuredRuntimeEvent },
  };
}

async function persistStructuredRuntimeEvent(eventInput: RuntimeEventInput): Promise<void> {
  const structuredRuntimeEvent = buildStructuredRuntimeEvent(eventInput);
  await writeStructuredRuntimeEventWithoutBlockingLoop(
    eventInput,
    buildStructuredRuntimeEventWriteRequest(eventInput, structuredRuntimeEvent),
  );
}

export async function recordMissionRuntimeEvent(input: RuntimeEventInput): Promise<void> {
  const eventInput = enrichRuntimeEventInput(input);
  await persistStructuredRuntimeEvent(eventInput);

  const runtimeResourceEvents = await buildRuntimeResourceEvents(eventInput);
  for (const runtimeResourceEvent of runtimeResourceEvents) {
    await persistStructuredRuntimeEvent(runtimeResourceEvent);
  }
}

export async function recordPostActionVerificationActionLog(input: ActionLogInput): Promise<PersistedActionLogRecord | null> {
  if (!isPostActionVerificationStep(input.step)) {
    return null;
  }

  const actionRef = resolveActionRef(input.state, input.stepResult);
  const postActionVerificationRef = resolvePostActionVerificationRef(input.stepResult);
  if (!actionRef || !postActionVerificationRef) {
    return null;
  }

  const mapChain = resolveMapChain(input.state, input.mapRecord);
  const structuredActionLog = buildStructuredActionLog(input, resolveRuntimeStepForOperationalStep(input.step));
  try {
    await input.context.forensics.writeStructuredActionLog(
      buildStructuredActionLogWriteInput({
        actionRef,
        postActionVerificationRef,
        actionLogInput: input,
        mapChain,
        structuredActionLog,
      }),
    );
    return { actionLogId: structuredActionLog.actionLogId, actionRef };
  } catch (error) {
    warnStructuredActionLogWriteIssue(input, error);
    return null;
  }
}
