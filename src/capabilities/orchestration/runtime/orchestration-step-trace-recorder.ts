import { randomUUID } from "node:crypto";

import type { MissionState } from "../contract.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { OrchestrationRuntimeContext } from "./orchestration-runtime-context.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import {
  StructuredActionLogSchema,
  StructuredRuntimeEventSchema,
  type StructuredActionLog,
} from "../../../types/structured-log.js";
import {
  resolveRuntimeActionPurpose,
  resolveRuntimeStepForOperationalStep,
  resolveVerifiedActionStep,
} from "./orchestration-step-trace-mapper.js";

type RuntimeEventStatus = "started" | "success" | "failed" | "review_required";

type RuntimeEventInput = {
  context: OrchestrationRuntimeContext;
  state: MissionState;
  mapRecord: ActiveOperationalMapRecord | null;
  step: OperationalStep;
  eventType: string;
  status: RuntimeEventStatus;
  reason?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  actionableMessage?: string | null;
  ownerResponsible?: string | null;
  decision?: string | null;
  durationMs?: number | null;
  capabilityCallId?: string | null;
  refs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  proofRefs?: string[];
  actionLogRefs?: string[];
  createdAt?: string;
};

type StepResultRecord = {
  status: "success" | "failed" | "review_required";
  childCapabilityId: string;
  envelopeId?: string | null;
  resultRef?: string | null;
  outputRef?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  payloadRefs: MissionState["payloadRefs"];
};

type ActionLogInput = {
  context: OrchestrationRuntimeContext;
  state: MissionState;
  mapRecord: ActiveOperationalMapRecord | null;
  step: OperationalStep;
  stepResult: StepResultRecord;
  createdAt: string;
  durationMs?: number | null;
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

function buildRuntimeEvent(input: RuntimeEventInput) {
  const sessionId = resolveSessionId(input.state);
  const runId = resolveRunId(input.state);
  const roundId = resolveRoundId(input.state);
  const step = resolveRuntimeStepForOperationalStep(input.step);

  return StructuredRuntimeEventSchema.parse({
    eventId: randomUUID(),
    eventType: input.eventType,
    level: "INFO",
    phase: "mission-loop",
    component: "orchestration",
    owner: "Orchestration",
    abilityGroupId: "orchestration",
    childCapabilityId: input.step.childCapabilityId,
    sessionId,
    runId,
    missionId: input.state.missionId ?? null,
    roundId,
    videoVisitId: null,
    mapId: input.state.mapId ?? null,
    stepId: input.step.stepId,
    taskTemplateId: null,
    traceId: runId,
    spanId: input.capabilityCallId ?? null,
    attemptId: `${sessionId}:${input.step.stepId}:${input.state.sequenceNo}`,
    activationSnapshotRef: input.state.activationSnapshotRef ?? null,
    capabilityCallId: input.capabilityCallId ?? null,
    step,
    previousStep: null,
    nextStep: null,
    status: input.status,
    reason: input.reason ?? null,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    actionableMessage: input.actionableMessage ?? null,
    ownerResponsible: input.ownerResponsible ?? "Orchestration",
    decision: input.decision ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    durationMs: input.durationMs ?? null,
    refs: input.refs ?? [],
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: [],
    proofRefs: input.proofRefs ?? [],
    artifactRefs: [],
    actionLogRefs: input.actionLogRefs ?? [],
    dataQualityFlags: [],
  });
}

export async function recordMissionRuntimeEvent(input: RuntimeEventInput): Promise<void> {
  const structuredRuntimeEvent = buildRuntimeEvent(input);
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
    videoVisitId: null,
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
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { structuredRuntimeEvent },
  });
}

function resolveActionRef(state: MissionState, stepResult: StepResultRecord): string | null {
  return (
    resolvePayloadRefValue(stepResult.payloadRefs, "actionResultRef")
    ?? resolvePayloadRefValue(stepResult.payloadRefs, "textInputResultRef")
    ?? resolvePayloadRefValue(stepResult.payloadRefs, "scrollResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "actionResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "textInputResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "scrollResultRef")
    ?? resolvePayloadRefValue(state.payloadRefs, "abilityResultRef")
    ?? state.lastResultRef
    ?? null
  );
}

function resolvePostActionVerificationRef(stepResult: StepResultRecord): string | null {
  return (
    resolvePayloadRefValue(stepResult.payloadRefs, "postActionVerificationRef")
    ?? resolvePayloadRefValue(stepResult.payloadRefs, "postScrollVerificationRef")
    ?? stepResult.resultRef
    ?? stepResult.outputRef
    ?? null
  );
}

function buildStructuredActionLog(input: ActionLogInput, runtimeStep: ReturnType<typeof resolveVerifiedActionStep>): StructuredActionLog {
  return StructuredActionLogSchema.parse({
    actionLogId: randomUUID(),
    abilityGroupId: "orchestration",
    childCapabilityId: input.step.childCapabilityId,
    skillId: null,
    skillCategory: null,
    sessionId: resolveSessionId(input.state),
    roundId: resolveRoundId(input.state),
    videoVisitId: null,
    browserProfileRef: null,
    loginState: null,
    step: runtimeStep,
    actionType: runtimeStep,
    actionPurpose: resolveRuntimeActionPurpose(runtimeStep),
    triggerSource: "runtime_policy",
    inputRefs: [],
    outputRefs: [],
    beforeEvidenceId: null,
    afterEvidenceId: null,
    targetDescriptor: input.step.stepId,
    visualTargetId: null,
    targetType: null,
    boundingBox: null,
    confidence: null,
    geometryStatus: null,
    verificationResult: null,
    result: input.stepResult.status,
    failureReason: input.stepResult.failureReason ?? null,
    reviewRequiredReason: input.stepResult.reviewRequiredReason ?? null,
    evidenceRefs: [],
    createdAt: input.createdAt,
    durationMs: input.durationMs ?? null,
  });
}

export async function recordPostActionVerificationActionLog(input: ActionLogInput): Promise<string | null> {
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

  await input.context.forensics.writeStructuredActionLog({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-action-log",
    recordType: "structured_action_log",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: input.step.childCapabilityId,
    missionId: input.state.missionId ?? null,
    runId: resolveRunId(input.state),
    sessionId: resolveSessionId(input.state),
    roundId: resolveRoundId(input.state),
    videoVisitId: null,
    stepId: input.step.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: mapChain.selectedMapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.stepResult.envelopeId ?? null,
    inputRefs: [actionRef],
    outputRefs: [postActionVerificationRef],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    actionRef,
    postActionVerificationRef,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: { structuredActionLog },
  });

  return structuredActionLog.actionLogId;
}