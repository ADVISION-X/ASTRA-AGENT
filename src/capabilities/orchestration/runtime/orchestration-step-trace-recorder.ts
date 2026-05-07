import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import {
  resolveVerifiedActionStep,
} from "./orchestration-step-trace-mapper.js";
import {
  buildStructuredActionLog,
  buildStructuredActionLogWriteInput,
  buildStructuredRuntimeEvent,
  resolveActionRef,
  resolvePostActionVerificationRef,
  type ActionLogInput,
  type RuntimeEventInput,
  type StepResultRecord,
} from "./orchestration-step-trace-payloads.js";

type PersistedActionLogRecord = {
  actionLogId: string;
  actionRef: string;
  postActionVerificationRef: string;
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
  console.log(
    `[GRASSEYE][RUNTIME][${level}] runtime ${input.eventType} ${input.status} ${input.reason}${failureReason}${reviewRequiredReason}${durationMs} ownerResponsible="${input.ownerResponsible}" actionableMessage="${input.actionableMessage}" stepId=${input.step.stepId} childCapabilityId=${input.step.childCapabilityId} degradedForensics="${reason}"`,
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
  _request: Parameters<OrchestrationRuntimeContext["forensics"]["writeStructuredRuntimeEvent"]>[0],
): Promise<void> {
  markRuntimeEventWriteDegraded();
  logRuntimeEventFallback(input, isRuntimeEventWriteDegraded() ? "forensics_write_circuit_open" : "forensics_write_skipped_for_mission_loop");
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

function resolvePayloadRefValue(payloadRefs: MissionState["payloadRefs"], key: string): string | null {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function collectStepInputRefs(step: OperationalStep, state: MissionState): string[] {
  return [...new Set(step.inputRefs.map((key) => resolvePayloadRefValue(state.payloadRefs, key)).filter((value): value is string => Boolean(value)))];
}

function collectResultOutputRefs(stepResult?: StepResultRecord | null, outputRefs?: string[]): string[] {
  return [
    ...(outputRefs ?? []),
    ...(stepResult?.resultRef ? [stepResult.resultRef] : []),
    ...(stepResult?.outputRef ? [stepResult.outputRef] : []),
  ];
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

export async function recordMissionRuntimeEvent(input: RuntimeEventInput): Promise<void> {
  const structuredRuntimeEvent = buildStructuredRuntimeEvent(input);
  const mapChain = resolveMapChain(input.state, input.mapRecord);

  await writeStructuredRuntimeEventWithoutBlockingLoop(input, {
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: input.step.childCapabilityId,
    missionId: input.state.missionId ?? null,
    runId: resolveRunId(input.state),
    sessionId: resolveSessionId(input.state),
    roundId: resolveRoundId(input.state),
    videoVisitId: resolveVideoVisitId(input.state),
    stepId: input.step.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: mapChain.selectedMapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.capabilityCallId ?? null,
    inputRefs: [...new Set([...(input.inputRefs ?? []), ...collectStepInputRefs(input.step, input.state)])],
    outputRefs: [...new Set(input.outputRefs ?? [])],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    actionRef: input.actionRef ?? null,
    postActionVerificationRef: input.postActionVerificationRef ?? null,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { structuredRuntimeEvent },
  });
}

export async function recordPostActionVerificationActionLog(input: ActionLogInput): Promise<PersistedActionLogRecord | null> {
  const runtimeStep = resolveVerifiedActionStep(input.step);
  if (!runtimeStep) {
    return null;
  }

  const actionRef = resolveActionRef(input.state, input.stepResult);
  const postActionVerificationRef = resolvePostActionVerificationRef(input.stepResult);
  if (!actionRef || !postActionVerificationRef) {
    return null;
  }

  const structuredActionLog = buildStructuredActionLog(input, runtimeStep);
  const mapChain = resolveMapChain(input.state, input.mapRecord);
  const result = await input.context.forensics.writeStructuredActionLog(
    buildStructuredActionLogWriteInput({
      actionRef,
      postActionVerificationRef,
      actionLogInput: input,
      mapChain,
      structuredActionLog,
    }),
  );

  if (result.status === "failed") {
    return null;
  }

  return {
    actionLogId: structuredActionLog.actionLogId,
    actionRef,
    postActionVerificationRef,
  };
}
