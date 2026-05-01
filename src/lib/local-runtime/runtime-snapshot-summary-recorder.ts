import { createId } from "../../lib/local-runtime/ids.js";
import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import { StructuredRuntimeEventSchema, type StructuredRuntimeSnapshotSummary } from "../../types/structured-log.js";
import { resolveAgentSkillCategory } from "./runtime-skill-support.js";
import { resolveRuntimeSkillId, updateLatestTrace } from "./runtime-proof-shared.js";

export type RuntimeSnapshotSummaryInput = {
  deliveryState: RuntimeDeliveryState;
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
  taskRunId: string;
  roundId: string;
  step: RoundLifecycleStep;
  reason: string;
  reviewRequiredReason: string;
  snapshotSummary: StructuredRuntimeSnapshotSummary;
  videoVisitId?: string | null;
};

function buildSnapshotEventBase(input: RuntimeSnapshotSummaryInput, runtimeSkillId: string) {
  return {
    eventId: createId("event"),
    eventType: "runtime_snapshot_summary",
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
    status: "review_required" as const,
    reason: input.reason,
    failureReason: null,
    reviewRequiredReason: input.reviewRequiredReason,
  };
}

function buildSnapshotEventRefs(input: RuntimeSnapshotSummaryInput) {
  return {
    snapshotSummary: input.snapshotSummary,
    createdAt: new Date().toISOString(),
    durationMs: null,
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: [],
    actionLogRefs: [],
    dataQualityFlags: ["review_required"],
  };
}

function createSnapshotEvent(input: RuntimeSnapshotSummaryInput, runtimeSkillId: string) {
  return StructuredRuntimeEventSchema.parse({
    ...buildSnapshotEventBase(input, runtimeSkillId),
    ...buildSnapshotEventRefs(input),
  });
}

export async function emitRuntimeSnapshotSummary(input: RuntimeSnapshotSummaryInput): Promise<void> {
  const runtimeSkillId = resolveRuntimeSkillId(input.step, input.reason, "runtime_snapshot_summary");
  const snapshotEvent = createSnapshotEvent(input, runtimeSkillId);

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
    payload: { snapshotEvent },
  });

  updateLatestTrace(input.deliveryState, {
    step: input.step,
    status: "review_required",
    detail: input.reviewRequiredReason,
  });
}