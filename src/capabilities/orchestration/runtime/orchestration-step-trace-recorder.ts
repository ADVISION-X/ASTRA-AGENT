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

  await input.context.forensics.writeStructuredRuntimeEvent({
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
