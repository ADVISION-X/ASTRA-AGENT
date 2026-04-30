import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { createId } from "./ids.js";
import type { WorkbenchBaseRuntime } from "./workbench-contract.js";

export const recordCommanderDebugEvent = async (
  runtime: WorkbenchBaseRuntime,
  input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
    missionId?: string | null;
    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
  },
): Promise<void> => {
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "commander-console",
    sourceAbilityGroupId: "commander-console",
    sourceChildCapabilityId: "issue-human-command-debug",
    sessionId: input.traceId,
    roundId: input.attemptId,
    videoVisitId: null,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: StructuredRuntimeEventSchema.parse({
        eventId: createId("event"),
        eventType: input.eventType,
        level: "DEBUG",
        phase: "mission-command",
        component: "commander-console",
        owner: "Commander Console",
        abilityGroupId: "commander-console",
        childCapabilityId: "issue-human-command",
        skillId: null,
        skillCategory: null,
        sessionId: input.traceId,
        missionId: input.missionId ?? null,
        roundId: input.attemptId,
        videoVisitId: null,
        mapId: input.mapId ?? null,
        taskTemplateId: input.taskTemplateId ?? null,
        traceId: input.traceId,
        spanId: input.spanId,
        attemptId: input.attemptId,
        browserProfileRef: runtime.browserSessionConfig.profileRef,
        loginState: runtime.browserController.getSessionState().loginState,
        step: "task_start",
        previousStep: null,
        nextStep: null,
        status: input.status,
        reason: input.reason ?? null,
        failureReason: input.failureReason ?? null,
        reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? input.reason ?? null : null,
        actionableMessage: input.actionableMessage ?? null,
        ownerResponsible: input.ownerResponsible ?? null,
        decision: input.decision ?? null,
        roundOutcome: null,
        finalizationType: null,
        samplingStrategy: null,
        expectedFrameCount: null,
        validFrameCount: null,
        fallbackReason: null,
        missingFrames: [],
        snapshotSummary: null,
        createdAt: new Date().toISOString(),
        durationMs: input.durationMs ?? null,
        refs: [],
        inputRefs: [],
        outputRefs: [],
        evidenceRefs: [],
        proofRefs: [],
        artifactRefs: [],
        actionLogRefs: [],
        dataQualityFlags: [],
      }),
    },
  });
};