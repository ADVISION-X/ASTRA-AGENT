import { randomUUID } from "node:crypto";

import type { MissionState } from "../contract.js";
import type { OrchestrationForensicsPort } from "../internal.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import type { ForensicsStructuredActionLogInput } from "../../forensics-persistence/contract.js";
import {
  StructuredActionLogSchema,
  type StructuredActionLog,
} from "../../../types/structured-log.js";
import {
  resolveRuntimeActionPurpose,
  resolveRuntimeStepForOperationalStep,
} from "./orchestration-step-trace-mapper.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
export { buildStructuredRuntimeEvent, type RuntimeEventInput } from "./orchestration-runtime-event-payload.js";

export type StepResultRecord = {
  status: "success" | "failed" | "review_required";
  childCapabilityId?: string;
  envelopeId?: string | null;
  resultRef?: string | null;
  outputRef?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  payloadRefs: MissionState["payloadRefs"];
};

export type ActionLogInput = {
  context: { forensics: OrchestrationForensicsPort };
  state: MissionState;
  mapRecord: ActiveOperationalMapRecord | null;
  step: OperationalStep;
  stepResult: StepResultRecord;
  createdAt: string;
  durationMs?: number | null;
};

type TraceMapChain = {
  bindingPackageId: string | null;
  bindingPackageVersion: string | null;
  selectedBindingId: string | null;
  bindingVersion: string | null;
  bindingSnapshotRef: string | null;
};

const resolveSessionId = (state: MissionState): string => state.missionId ?? state.activeTaskRunId ?? "unknown-session";

const resolveRunId = (state: MissionState): string => state.activeTaskRunId ?? `${resolveSessionId(state)}:run`;

const resolveRoundId = (state: MissionState): string => String(state.currentRoundIndex);

const resolveVideoVisitId = (state: MissionState): string | null => state.missionId
  ? `${state.missionId}:video-visit:${state.currentRoundIndex}`
  : null;

const resolvePayloadRefValue = (payloadRefs: MissionState["payloadRefs"], key: string): string | null => {
  const payloadKey = key as keyof MissionState["payloadRefs"];
  const value = payloadRefs[payloadKey];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const resolveActionRef = (state: MissionState, stepResult: StepResultRecord): string | null => {
  const stepResultRef = ["actionResultRef", "textInputResultRef", "scrollResultRef"]
    .map((key) => resolvePayloadRefValue(stepResult.payloadRefs, key))
    .find((value) => value !== null);
  if (stepResultRef) {
    return stepResultRef;
  }

  return ["actionResultRef", "textInputResultRef", "scrollResultRef", "abilityResultRef"]
    .map((key) => resolvePayloadRefValue(state.payloadRefs, key))
    .find((value) => value !== null) ?? state.lastResultRef ?? null;
};

export const resolvePostActionVerificationRef = (stepResult: StepResultRecord): string | null =>
  resolvePayloadRefValue(stepResult.payloadRefs, "postActionVerificationRef")
  ?? resolvePayloadRefValue(stepResult.payloadRefs, "postScrollVerificationRef")
  ?? stepResult.resultRef
  ?? stepResult.outputRef
  ?? null;

export const buildStructuredActionLog = (
  input: ActionLogInput,
  runtimeStep: NonNullable<ReturnType<typeof resolveRuntimeStepForOperationalStep>>,
): StructuredActionLog =>
  StructuredActionLogSchema.parse({
    actionLogId: randomUUID(),
    abilityGroupId: "orchestration",
    childCapabilityId: input.step.childCapabilityId,
    skillId: null,
    skillCategory: null,
    sessionId: resolveSessionId(input.state),
    roundId: resolveRoundId(input.state),
    videoVisitId: resolveVideoVisitId(input.state),
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

export const buildStructuredActionLogWriteInput = (input: {
  actionRef: string;
  postActionVerificationRef: string;
  actionLogInput: ActionLogInput;
  mapChain: TraceMapChain;
  structuredActionLog: StructuredActionLog;
}): ForensicsStructuredActionLogInput => ({
  abilityGroupId: "forensics-persistence",
  childCapabilityId: "write-structured-action-log",
  recordType: "structured_action_log",
  requestedBy: "orchestration",
  sourceAbilityGroupId: "orchestration",
  sourceChildCapabilityId: input.actionLogInput.step.childCapabilityId,
  missionId: input.actionLogInput.state.missionId ?? null,
  runId: resolveRunId(input.actionLogInput.state),
  sessionId: resolveSessionId(input.actionLogInput.state),
  roundId: resolveRoundId(input.actionLogInput.state),
  videoVisitId: resolveVideoVisitId(input.actionLogInput.state),
  stepId: input.actionLogInput.step.stepId,
  bindingPackageId: input.mapChain.bindingPackageId,
  bindingPackageVersion: input.mapChain.bindingPackageVersion,
  selectedBindingId: input.mapChain.selectedBindingId,
  bindingVersion: input.mapChain.bindingVersion,
  bindingSnapshotRef: input.mapChain.bindingSnapshotRef,
  capabilityCallId: input.actionLogInput.stepResult.envelopeId ?? null,
  inputRefs: [input.actionRef],
  outputRefs: [input.postActionVerificationRef],
  sourceRecordRefs: [],
  parentRefs: [],
  artifactRefs: [],
  actionRef: input.actionRef,
  postActionVerificationRef: input.postActionVerificationRef,
  persistencePolicy: { mode: "append", allowPartialRefs: true },
  dataQualityFlags: [],
  payload: { structuredActionLog: input.structuredActionLog },
});
