import { createId } from "../../lib/local-runtime/ids.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { EvidenceRef } from "../../types/evidence.js";
import type { RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import { StructuredRuntimeEventSchema, type StructuredRuntimeSnapshotSummary } from "../../types/structured-log.js";
import { resolveAgentSkillCategory } from "./runtime-skill-support.js";
import { createForensicsRecordRef } from "./runtime-round-request-builders.js";
import { resolveRuntimeSkillId, updateLatestTrace } from "./runtime-proof-shared.js";

type MissingFrame = {
  frameLabel: "frame_3s" | "frame_6s" | "frame_10s" | "adaptive_first" | "adaptive_mid" | "adaptive_late";
  unavailableReason: string;
};

export type SupplementalRuntimeEventInput = {
  deliveryState: RuntimeDeliveryState;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  taskRunId: string;
  roundId: string;
  step: RoundLifecycleStep;
  eventType: string;
  skillId?: string;
  status: "started" | "success" | "failed" | "skipped" | "review_required";
  reason?: string | null;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  decision?: string | null;
  roundOutcome?: string | null;
  finalizationType?: "browse_ledger" | "evidence_packet" | "failed_record" | null;
  samplingStrategy?: "fixed_3_6_10" | "adaptive_short_video" | "single_frame_fallback" | null;
  expectedFrameCount?: number | null;
  validFrameCount?: number | null;
  fallbackReason?: string | null;
  missingFrames?: MissingFrame[];
  snapshotSummary?: StructuredRuntimeSnapshotSummary | null;
  videoVisitId?: string | null;
  durationMs?: number | null;
  evidenceRefs?: EvidenceRef[];
  actionLogRefs?: string[];
  dataQualityFlags?: string[];
};

function resolveSupplementalReason(input: SupplementalRuntimeEventInput): string {
  return input.reason ?? input.failureReason ?? input.reviewRequiredReason ?? input.eventType;
}

function resolveSupplementalSkillId(input: SupplementalRuntimeEventInput): string {
  return input.skillId ?? resolveRuntimeSkillId(input.step, resolveSupplementalReason(input), input.eventType);
}

function buildParentRefs(input: SupplementalRuntimeEventInput) {
  return [
    ...(input.evidenceRefs ?? []).map((ref) => createForensicsRecordRef({ recordType: "evidence_record", recordId: ref.id, storageRef: ref.filePath ?? null })),
    ...(input.actionLogRefs ?? []).map((refId) => createForensicsRecordRef({ recordType: "structured_action_log", recordId: refId })),
  ];
}

function buildSupplementalEventBase(input: SupplementalRuntimeEventInput, runtimeSkillId: string) {
  return {
    eventId: createId("event"),
    eventType: input.eventType,
    abilityGroupId: "orchestration" as const,
    childCapabilityId: null,
    skillId: runtimeSkillId,
    skillCategory: resolveAgentSkillCategory(runtimeSkillId),
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId ?? null,
    step: input.step,
    previousStep: null,
    nextStep: null,
    status: input.status,
    reason: input.reason ?? null,
    failureReason: input.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? null,
  };
}

function buildSupplementalEventOutcome(input: SupplementalRuntimeEventInput) {
  return {
    decision: input.decision ?? null,
    roundOutcome: input.roundOutcome ?? null,
    finalizationType: input.finalizationType ?? null,
    samplingStrategy: input.samplingStrategy ?? null,
    expectedFrameCount: input.expectedFrameCount ?? null,
    validFrameCount: input.validFrameCount ?? null,
    fallbackReason: input.fallbackReason ?? null,
    missingFrames: input.missingFrames ?? [],
    snapshotSummary: input.snapshotSummary ?? null,
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs ?? null,
  };
}

function buildSupplementalEventRefs(input: SupplementalRuntimeEventInput) {
  return {
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: input.evidenceRefs ?? [],
    actionLogRefs: input.actionLogRefs ?? [],
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
}

function createStructuredSupplementalEvent(input: SupplementalRuntimeEventInput, runtimeSkillId: string) {
  return StructuredRuntimeEventSchema.parse({
    ...buildSupplementalEventBase(input, runtimeSkillId),
    ...buildSupplementalEventOutcome(input),
    ...buildSupplementalEventRefs(input),
  });
}

export async function emitSupplementalRuntimeEvent(input: SupplementalRuntimeEventInput): Promise<void> {
  const runtimeSkillId = resolveSupplementalSkillId(input);
  const structuredRuntimeEvent = createStructuredSupplementalEvent(input, runtimeSkillId);

  await input.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "emit-supplemental-runtime-event",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId ?? null,
    sourceRecordRefs: [],
    parentRefs: buildParentRefs(input),
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: input.dataQualityFlags ?? [],
    payload: { structuredRuntimeEvent },
  });

  updateLatestTrace(input.deliveryState, {
    step: input.step,
    status: input.status,
    detail: input.reviewRequiredReason ?? input.failureReason ?? input.reason ?? null,
  });
}