import type { ForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import type { RoundLifecycleEventStatus, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { resolveAgentSkillCategory } from "./runtime-skill-support.js";
import { deriveRoundStepActionPurpose } from "./runtime-action-purpose.js";
import { createRoundLifecycleEvent } from "./runtime-round-lifecycle-event.js";
import { createForensicsRecordRef } from "./runtime-round-request-builders.js";
import {
  resolveRuntimeSkillId,
  toStructuredRuntimeEventType,
  toStructuredRuntimeStatus,
  updateLatestTrace,
} from "./runtime-proof-shared.js";

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
  const runtimeStatus = toStructuredRuntimeStatus(input.step, input.status);
  const reviewRequiredReason = input.step === "review_required" || input.step === "finalize_failed_or_review_record" ? input.detail : null;

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
        status: runtimeStatus,
        reason: input.detail,
        failureReason: input.status === "failed" ? input.detail : null,
        reviewRequiredReason,
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
          result: runtimeStatus,
          failureReason: input.status === "failed" ? input.detail : null,
          reviewRequiredReason,
          evidenceRefs: [],
          createdAt: lifecycleEvent.createdAt,
        }),
      },
    });
  }

  updateLatestTrace(input.deliveryState, { step: input.step, status: input.status, detail: input.detail });
}
