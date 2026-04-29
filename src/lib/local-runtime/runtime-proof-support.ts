import { createId } from "../../lib/local-runtime/ids.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { EvidenceRef } from "../../types/evidence.js";
import type { RoundLifecycleEventStatus, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema, type StructuredRuntimeSnapshotSummary } from "../../types/structured-log.js";
import { resolveAgentSkillCategory, resolveRuntimeStepSkillId } from "./runtime-skill-support.js";
import { deriveRoundStepActionPurpose } from "./runtime-action-purpose.js";
import { createRoundLifecycleEvent } from "./runtime-round-lifecycle-event.js";
import { createForensicsRecordRef } from "./runtime-round-request-builders.js";

const COMPLETED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  task_start: "task_started",
  single_video_round_start: "single_video_round_started",
  review_required: "review_required",
  stop: "task_stopped",
  branch: "branch_decision_completed",
  record_video_evidence: "record_video_evidence_completed",
};

const ENTERED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  scroll_next_video: "scroll_next_video_started",
  wait_video_stable: "next_video_wait_started",
};

function toStructuredRuntimeEventType(step: RoundLifecycleStep, status: RoundLifecycleEventStatus): string {
  if (status === "entered") return ENTERED_EVENT_TYPES[step] ?? `${step}_started`;
  return COMPLETED_EVENT_TYPES[step] ?? `${step}_${status}`;
}

function toStructuredRuntimeStatus(step: RoundLifecycleStep, status: RoundLifecycleEventStatus): "started" | "success" | "failed" | "skipped" | "review_required" {
  if (status === "entered") return "started";
  if (step === "review_required") return "review_required";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  return "success";
}

export function resolveRuntimeSkillId(step: RoundLifecycleStep, detail: string, eventType?: string): string {
  if (step === "branch") return detail === "product_yes_high_confidence" ? "branch_product_yes" : detail === "product_no_high_confidence" ? "branch_product_no" : "branch_uncertain";
  if (step === "detect_login_or_safety" && detail.includes("login")) return "detect_login_state";
  return resolveRuntimeStepSkillId(step, eventType);
}

function updateLatestTrace(deliveryState: RuntimeDeliveryState, input: { step: RoundLifecycleStep; status: string; detail: string | null }): void {
  deliveryState.latestRoundTraceStep = input.step;
  deliveryState.latestRoundTraceStatus = input.status;
  deliveryState.latestRoundTraceDetail = input.detail;
}

export async function recordRoundLifecycleStep(input: {
  deliveryState: RuntimeDeliveryState;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  taskRunId: string;
  roundId: string;
  step: RoundLifecycleStep;
  status: RoundLifecycleEventStatus;
  detail: string;
  videoVisitId: string | null | undefined;
}): Promise<void> {
  const lifecycleEvent = createRoundLifecycleEvent({ sessionId: input.taskRunId, taskRunId: input.taskRunId, roundId: input.roundId, step: input.step, status: input.status, detail: input.detail, videoVisitId: input.videoVisitId ?? null });
  const structuredEventType = toStructuredRuntimeEventType(input.step, input.status);
  const runtimeSkillId = resolveRuntimeSkillId(input.step, input.detail, structuredEventType);
  const runtimeSkillCategory = resolveAgentSkillCategory(runtimeSkillId);
  await input.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "record-round-lifecycle-step",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId ?? null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: lifecycleEvent.eventId,
        eventType: structuredEventType,
        abilityGroupId: "orchestration",
        childCapabilityId: null,
        skillId: runtimeSkillId,
        skillCategory: runtimeSkillCategory,
        sessionId: input.taskRunId,
        roundId: input.roundId,
        videoVisitId: input.videoVisitId ?? null,
        step: input.step,
        previousStep: input.deliveryState.latestRoundTraceStep as RoundLifecycleStep | null,
        nextStep: null,
        status: toStructuredRuntimeStatus(input.step, input.status),
        reason: input.detail,
        failureReason: input.status === "failed" ? input.detail : null,
        reviewRequiredReason: input.step === "review_required" || input.step === "finalize_failed_or_review_record" ? input.detail : null,
        createdAt: lifecycleEvent.createdAt,
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      }),
      roundLifecycleEvent: lifecycleEvent,
    },
  });

  if (input.status !== "entered") {
    await input.forensicsPersistenceAbilityGroup.writeStructuredActionLog({
      abilityGroupId: "forensics-persistence",
      childCapabilityId: "write-structured-action-log",
      recordType: "structured_action_log",
      requestedBy: "orchestration",
      sourceAbilityGroupId: "orchestration",
      sourceChildCapabilityId: "record-round-lifecycle-step",
      sessionId: input.taskRunId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId ?? null,
      sourceRecordRefs: [],
      parentRefs: [createForensicsRecordRef({ recordType: "structured_runtime_event", recordId: lifecycleEvent.eventId })],
      artifactRefs: [],
      persistencePolicy: { mode: "append", allowPartialRefs: true },
      dataQualityFlags: [],
      payload: {
        structuredActionLog: StructuredActionLogSchema.parse({
          actionLogId: lifecycleEvent.eventId,
          abilityGroupId: "orchestration",
          childCapabilityId: null,
          skillId: runtimeSkillId,
          skillCategory: runtimeSkillCategory,
          sessionId: input.taskRunId,
          roundId: input.roundId,
          videoVisitId: input.videoVisitId ?? null,
          step: input.step,
          actionType: input.step,
          actionPurpose: deriveRoundStepActionPurpose(input.step),
          triggerSource: "runtime_policy",
          inputRefs: [],
          outputRefs: [],
          beforeEvidenceId: null,
          afterEvidenceId: null,
          result: toStructuredRuntimeStatus(input.step, input.status),
          failureReason: input.status === "failed" ? input.detail : null,
          reviewRequiredReason: input.step === "review_required" || input.step === "finalize_failed_or_review_record" ? input.detail : null,
          evidenceRefs: [],
          createdAt: lifecycleEvent.createdAt,
        }),
      },
    });
  }

  updateLatestTrace(input.deliveryState, { step: input.step, status: input.status, detail: input.detail });
}

export async function emitSupplementalRuntimeEvent(input: {
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
  missingFrames?: Array<{ frameLabel: "frame_3s" | "frame_6s" | "frame_10s" | "adaptive_first" | "adaptive_mid" | "adaptive_late"; unavailableReason: string }>;
  snapshotSummary?: StructuredRuntimeSnapshotSummary | null;
  videoVisitId?: string | null;
  durationMs?: number | null;
  evidenceRefs?: EvidenceRef[];
  actionLogRefs?: string[];
  dataQualityFlags?: string[];
}): Promise<void> {
  const runtimeSkillId = input.skillId ?? resolveRuntimeSkillId(input.step, input.reason ?? input.failureReason ?? input.reviewRequiredReason ?? input.eventType, input.eventType);
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
    parentRefs: [
      ...(input.evidenceRefs ?? []).map((ref) => createForensicsRecordRef({ recordType: "evidence_record", recordId: ref.id, storageRef: ref.filePath ?? null })),
      ...(input.actionLogRefs ?? []).map((refId) => createForensicsRecordRef({ recordType: "structured_action_log", recordId: refId })),
    ],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: input.dataQualityFlags ?? [],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: input.eventType,
        abilityGroupId: "orchestration",
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
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: input.evidenceRefs ?? [],
        actionLogRefs: input.actionLogRefs ?? [],
        dataQualityFlags: input.dataQualityFlags ?? [],
      }),
    },
  });

  updateLatestTrace(input.deliveryState, {
    step: input.step,
    status: input.status,
    detail: input.reviewRequiredReason ?? input.failureReason ?? input.reason ?? null,
  });
}

export async function emitRuntimeSnapshotSummary(input: {
  deliveryState: RuntimeDeliveryState;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  taskRunId: string;
  roundId: string;
  step: RoundLifecycleStep;
  reason: string;
  reviewRequiredReason: string;
  snapshotSummary: StructuredRuntimeSnapshotSummary;
  videoVisitId?: string | null;
}): Promise<void> {
  const runtimeSkillId = resolveRuntimeSkillId(input.step, input.reason, "runtime_snapshot_summary");
  await input.forensicsPersistenceAbilityGroup.updateRuntimeSnapshot({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "update-runtime-snapshot",
    recordType: "runtime_snapshot",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: "emit-runtime-snapshot-summary",
    sessionId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId ?? null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: ["review_required"],
    payload: {
      snapshotEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: "runtime_snapshot_summary",
        abilityGroupId: "orchestration",
        childCapabilityId: null,
        skillId: runtimeSkillId,
        skillCategory: resolveAgentSkillCategory(runtimeSkillId),
        sessionId: input.taskRunId,
        roundId: input.roundId,
        videoVisitId: input.videoVisitId ?? null,
        step: input.step,
        previousStep: null,
        nextStep: null,
        status: "review_required",
        reason: input.reason,
        failureReason: null,
        reviewRequiredReason: input.reviewRequiredReason,
        snapshotSummary: input.snapshotSummary,
        createdAt: new Date().toISOString(),
        durationMs: null,
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        actionLogRefs: [],
        dataQualityFlags: ["review_required"],
      }),
    },
  });

  updateLatestTrace(input.deliveryState, {
    step: input.step,
    status: "review_required",
    detail: input.reviewRequiredReason,
  });
}
