import { randomUUID } from "node:crypto";

import type { MissionState } from "../contract.js";
import type { OrchestrationForensicsPort } from "../internal.js";
import type { ActiveOperationalMapRecord } from "../ports/orchestration-map-store-port.js";
import {
  StructuredRuntimeEventSchema,
  type StructuredFailureSnapshot,
  type StructuredJointCheckpoint,
  type StructuredJointStage,
  type StructuredRuntimeEvent,
  type StructuredRuntimeResourceSummary,
} from "../../../types/structured-log.js";
import { resolveRuntimeStepForOperationalStep } from "./orchestration-step-trace-mapper.js";
import type { OperationalStep } from "./step-dispatch-shared.js";
import type { StepResultRecord } from "./orchestration-step-trace-payloads.js";

type RuntimeEventProofSummary = Partial<Pick<
  StructuredRuntimeEvent,
  | "screenshotEvidenceId"
  | "artifactRef"
  | "artifactStorageRef"
  | "outputHash"
  | "artifactHash"
  | "byteSize"
  | "width"
  | "height"
  | "coordinateSpace"
  | "runtimeProofRef"
  | "promptInputRef"
  | "aiInputArtifactRef"
  | "aiInputStorageRef"
  | "sourceScreenshotEvidenceId"
  | "sourceStorageRef"
  | "preparedImageHash"
  | "preparedImageWidth"
  | "preparedImageHeight"
>>;

type RuntimeEventInput = {
  context: { forensics: OrchestrationForensicsPort };
  state: MissionState;
  mapRecord: ActiveOperationalMapRecord | null;
  step: OperationalStep;
  eventType: string;
  status: "started" | "success" | "failed" | "review_required";
  reason?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  actionableMessage?: string | null;
  ownerResponsible?: string | null;
  decision?: string | null;
  durationMs?: number | null;
  level?: StructuredRuntimeEvent["level"];
  capabilityCallId?: string | null;
  refs?: string[];
  inputRefs?: string[];
  outputRefs?: string[];
  proofRefs?: string[];
  actionLogRefs?: string[];
  actionRef?: string | null;
  postActionVerificationRef?: string | null;
  resourceSummary?: StructuredRuntimeResourceSummary | null;
  expectedInputRefKeys?: string[];
  resolvedInputRefKeys?: string[];
  missingInputRefKeys?: string[];
  outputRefAliases?: string[];
  producedOutputRefs?: string[];
  jointStage?: StructuredJointStage;
  jointCheckpoint?: StructuredJointCheckpoint | null;
  failureSnapshot?: StructuredFailureSnapshot | null;
  stepResult?: StepResultRecord | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  proofSummary?: RuntimeEventProofSummary;
};

const resolveSessionId = (state: MissionState): string => state.missionId ?? state.activeTaskRunId ?? "unknown-session";
const resolveRunId = (state: MissionState): string => state.activeTaskRunId ?? `${resolveSessionId(state)}:run`;
const resolveRoundId = (state: MissionState): string => String(state.currentRoundIndex);
const resolveVideoVisitId = (state: MissionState): string | null => state.missionId ? `${state.missionId}:video-visit:${state.currentRoundIndex}` : null;
const toEvidenceRef = (id: string, summary: string) => ({ id, kind: "ai-result" as const, summary });

const buildRuntimeEventIdentity = (input: RuntimeEventInput) => {
  const sessionId = resolveSessionId(input.state);
  const runId = resolveRunId(input.state);
  return {
    sessionId,
    runId,
    roundId: resolveRoundId(input.state),
    step: resolveRuntimeStepForOperationalStep(input.step),
    missionId: input.state.missionId ?? null,
    mapId: input.state.mapId ?? null,
    traceId: runId,
    attemptId: `${sessionId}:${input.step.stepId}:${input.state.sequenceNo}`,
  };
};

const buildRuntimeEventRefs = (input: RuntimeEventInput) => ({
  refs: input.refs ?? [],
  inputRefs: (input.inputRefs ?? []).map((id) => toEvidenceRef(id, "input")),
  outputRefs: (input.outputRefs ?? []).map((id) => toEvidenceRef(id, "output")),
  evidenceRefs: [],
  proofRefs: input.proofRefs ?? [],
  artifactRefs: [],
  actionLogRefs: input.actionLogRefs ?? [],
  dataQualityFlags: [],
});

const buildRuntimeEventDebugFields = (input: RuntimeEventInput) => ({
  expectedInputRefKeys: input.expectedInputRefKeys ?? [],
  resolvedInputRefKeys: input.resolvedInputRefKeys ?? [],
  missingInputRefKeys: input.missingInputRefKeys ?? [],
  outputRefAliases: input.outputRefAliases ?? [],
  producedOutputRefs: input.producedOutputRefs ?? [],
  jointStage: input.jointStage ?? "none",
  jointCheckpoint: input.jointCheckpoint ?? null,
  failureSnapshot: input.failureSnapshot ?? null,
});

const buildRuntimeEventTiming = (input: RuntimeEventInput) => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return { startedAt: input.startedAt ?? createdAt, endedAt: input.endedAt ?? createdAt, createdAt, durationMs: input.durationMs ?? null };
};

export const buildStructuredRuntimeEvent = (input: RuntimeEventInput) =>
  StructuredRuntimeEventSchema.parse({
    eventId: randomUUID(),
    eventType: input.eventType,
    level: input.level ?? "INFO",
    phase: "mission-loop",
    component: "orchestration",
    owner: "Orchestration",
    abilityGroupId: "orchestration",
    targetAbilityGroupId: input.step.targetAbilityGroupId ?? null,
    capabilityGroupId: input.step.targetAbilityGroupId ?? null,
    childCapabilityId: input.step.childCapabilityId,
    videoVisitId: resolveVideoVisitId(input.state),
    stepId: input.step.stepId,
    taskTemplateId: null,
    spanId: input.capabilityCallId ?? null,
    activationSnapshotRef: input.state.activationSnapshotRef ?? null,
    capabilityCallId: input.capabilityCallId ?? null,
    actionRef: input.actionRef ?? null,
    postActionVerificationRef: input.postActionVerificationRef ?? null,
    previousStep: null,
    nextStep: null,
    status: input.status,
    reason: input.reason ?? null,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
    actionableMessage: input.actionableMessage ?? null,
    ownerResponsible: input.ownerResponsible ?? "Orchestration",
    decision: input.decision ?? null,
    resourceSummary: input.resourceSummary ?? null,
    ...buildRuntimeEventTiming(input),
    ...buildRuntimeEventDebugFields(input),
    ...(input.proofSummary ?? {}),
    ...buildRuntimeEventIdentity(input),
    ...buildRuntimeEventRefs(input),
  });

export type { RuntimeEventInput };
